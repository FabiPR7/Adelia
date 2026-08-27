import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import type { FloorPlan, FloorPlanElement, TableInput } from '../types'
import {
  createFloorPlanElement,
  getTableMapKey,
  syncFloorPlanWithTables,
} from '../types/company'
import {
  FLOOR_PLAN_CHAIR_PALETTE,
  FLOOR_PLAN_MESA_PALETTE,
  FLOOR_PLAN_PALETTE,
  FLOOR_PLAN_TABLE_VARIANTS,
  computeStoredHeightFromWidth,
  getDefaultTableVariant,
  resolveElementAspectRatio,
  resolveElementImage,
  resolveTableImage,
  type FloorPlanPaletteItem,
} from '../utils/floorPlanAssets'
import { FLOOR_STYLE_OPTIONS, type FloorStyleId } from '../types/company'
import styles from './FloorPlanEditor.module.css'

interface FloorPlanEditorProps {
  tables: TableInput[]
  floorPlan: FloorPlan
  onChange: (floorPlan: FloorPlan) => void
  embedded?: boolean
  readOnly?: boolean
}

type Selection =
  | { kind: 'element'; id: string }
  | { kind: 'table'; tableKey: string }
  | null

type DragKind =
  | { type: 'table'; tableKey: string; offsetX: number; offsetY: number }
  | { type: 'element'; elementId: string; offsetX: number; offsetY: number }
  | {
      type: 'resize'
      target: 'element' | 'table'
      id: string
      axis: 'corner' | 'width' | 'height'
      startWidth: number
      startHeight: number
      startPointerX: number
      startPointerY: number
    }
  | {
      type: 'rotate'
      target: 'element' | 'table'
      id: string
      startRotation: number
      startAngle: number
      centerX: number
      centerY: number
    }
  | {
      type: 'pan'
      startPanX: number
      startPanY: number
      startPointerX: number
      startPointerY: number
    }

const MIN_VIEW_SCALE = 0.25
const MAX_VIEW_SCALE = 3
const MOBILE_BREAKPOINT = 900
const MIN_CANVAS_WIDTH = 320
const MAX_CANVAS_WIDTH = 1200
const MIN_CANVAS_HEIGHT = 240
const MAX_CANVAS_HEIGHT = 900

const FLOOR_STYLE_CLASSES: Record<FloorStyleId, string> = {
  wine: styles.canvasFloorWine,
  wood: styles.canvasFloorWood,
  checker: styles.canvasFloorChecker,
  ceramic: styles.canvasFloorCeramic,
  carpet: styles.canvasFloorCarpet,
  marble: styles.canvasFloorMarble,
  slate: styles.canvasFloorSlate,
}

function clampPercent(value: number, min = 0, max = 98) {
  return Math.min(max, Math.max(min, value))
}

function clampViewScale(scale: number) {
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale))
}

function clampCanvasDimension(
  value: string,
  min: number,
  max: number,
  fallback: number,
) {
  const trimmed = value.trim()

  if (!trimmed) {
    return fallback
  }

  const parsed = Number(trimmed)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function HandleIcon({ children }: { children: ReactNode }) {
  return (
    <svg className={styles.handleIcon} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function RotateIcon() {
  return (
    <HandleIcon>
      <path
        d="M12 4V2M12 4a8 8 0 1 0 7.75 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 4h-3v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HandleIcon>
  )
}

function ResizeIcon() {
  return (
    <HandleIcon>
      <path
        d="M16 4h4v4M20 4l-6 6M8 20H4v-4M4 20l6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HandleIcon>
  )
}

function DeleteIcon() {
  return (
    <HandleIcon>
      <path
        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
        fill="currentColor"
      />
    </HandleIcon>
  )
}

interface SelectionHandlesProps {
  onRotate: (event: PointerEvent<HTMLButtonElement>) => void
  onResize: (event: PointerEvent<HTMLButtonElement>) => void
  onDelete?: (event: PointerEvent<HTMLButtonElement>) => void
}

function SelectionHandles({ onRotate, onResize, onDelete }: SelectionHandlesProps) {
  return (
    <>
      <button
        type="button"
        className={`${styles.objectHandle} ${styles.rotateHandle}`}
        title="Girar"
        aria-label="Girar"
        onPointerDown={onRotate}
      >
        <RotateIcon />
      </button>
      <button
        type="button"
        className={`${styles.objectHandle} ${styles.resizeHandle}`}
        title="Redimensionar"
        aria-label="Redimensionar"
        onPointerDown={onResize}
      >
        <ResizeIcon />
      </button>
      {onDelete && (
        <button
          type="button"
          className={`${styles.objectHandle} ${styles.deleteHandle}`}
          title="Eliminar"
          aria-label="Eliminar"
          onPointerDown={onDelete}
        >
          <DeleteIcon />
        </button>
      )}
    </>
  )
}

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function FloorPlanEditor({ tables, floorPlan, onChange, embedded = false, readOnly = false }: FloorPlanEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{
    startDistance: number
    startScale: number
    startPanX: number
    startPanY: number
    midpointX: number
    midpointY: number
  } | null>(null)
  const dragStateRef = useRef<DragKind | null>(null)
  const [dragState, setDragStateState] = useState<DragKind | null>(null)

  const setDragState = (state: DragKind | null) => {
    dragStateRef.current = state
    setDragStateState(state)
  }
  const [selection, setSelection] = useState<Selection>(null)
  const [floorsOpen, setFloorsOpen] = useState(false)
  const [viewScale, setViewScale] = useState(1)
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 })
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  )
  const [draftWidth, setDraftWidth] = useState(() => String(floorPlan.canvasWidth))
  const [draftHeight, setDraftHeight] = useState(() => String(floorPlan.canvasHeight))

  const syncedPlan = useMemo(
    () => syncFloorPlanWithTables(floorPlan, tables),
    [floorPlan, tables],
  )

  const positionsByKey = useMemo(
    () => new Map(syncedPlan.tablePositions.map((item) => [item.tableKey, item])),
    [syncedPlan.tablePositions],
  )

  const fitToContainer = useCallback(() => {
    const container = scrollContainerRef.current

    if (!container) {
      return
    }

    const padding = 16
    const availableWidth = container.clientWidth - padding
    const availableHeight = container.clientHeight - padding
    const scaleX = availableWidth / syncedPlan.canvasWidth
    const scaleY = availableHeight / syncedPlan.canvasHeight
    const scale = clampViewScale(Math.min(scaleX, scaleY, 1))

    setViewScale(scale)
    setViewPan({ x: 0, y: 0 })
  }, [syncedPlan.canvasHeight, syncedPlan.canvasWidth])

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const syncViewportMode = () => setIsMobileViewport(mediaQuery.matches)

    syncViewportMode()
    mediaQuery.addEventListener('change', syncViewportMode)

    return () => mediaQuery.removeEventListener('change', syncViewportMode)
  }, [])

  useLayoutEffect(() => {
    if (isMobileViewport) {
      fitToContainer()
    }
  }, [fitToContainer, isMobileViewport, syncedPlan.canvasHeight, syncedPlan.canvasWidth])

  useEffect(() => {
    setDraftWidth(String(syncedPlan.canvasWidth))
    setDraftHeight(String(syncedPlan.canvasHeight))
  }, [syncedPlan.canvasHeight, syncedPlan.canvasWidth])

  const pointerToPercent = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return { x: 0, y: 0 }
    }

    const rect = canvas.getBoundingClientRect()

    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }

  const patchPlan = (patch: Partial<FloorPlan>) => {
    onChange({ ...syncedPlan, ...patch })
  }

  const applyCanvasSize = () => {
    const canvasWidth = clampCanvasDimension(
      draftWidth,
      MIN_CANVAS_WIDTH,
      MAX_CANVAS_WIDTH,
      syncedPlan.canvasWidth,
    )
    const canvasHeight = clampCanvasDimension(
      draftHeight,
      MIN_CANVAS_HEIGHT,
      MAX_CANVAS_HEIGHT,
      syncedPlan.canvasHeight,
    )

    setDraftWidth(String(canvasWidth))
    setDraftHeight(String(canvasHeight))
    patchPlan({ canvasWidth, canvasHeight })
  }

  const updateTable = (
    tableKey: string,
    patch: Partial<{ x: number; y: number; width: number; height: number; rotation: number; variant: string }>,
  ) => {
    patchPlan({
      tablePositions: syncedPlan.tablePositions.map((item) =>
        item.tableKey === tableKey ? { ...item, ...patch } : item,
      ),
    })
  }

  const updateElement = (elementId: string, patch: Partial<FloorPlanElement>) => {
    patchPlan({
      elements: syncedPlan.elements.map((item) =>
        item.id === elementId ? { ...item, ...patch } : item,
      ),
    })
  }

  const addElementFromPalette = (item: FloorPlanPaletteItem) => {
    const base = createFloorPlanElement(item.type)
    const width = item.defaultWidth ?? base.width
    const aspect = resolveElementAspectRatio(item.type, item.variantId)
    const height = computeStoredHeightFromWidth(
      width,
      syncedPlan.canvasWidth,
      syncedPlan.canvasHeight,
      aspect,
    )

    const element = {
      ...base,
      variant: item.variantId,
      width,
      height,
    }
    patchPlan({
      elements: [...syncedPlan.elements, element],
    })
    setSelection({ kind: 'element', id: element.id })
  }

  const removeElement = (elementId: string) => {
    patchPlan({
      elements: syncedPlan.elements.filter((item) => item.id !== elementId),
    })

    if (selection?.kind === 'element' && selection.id === elementId) {
      setSelection(null)
    }
  }

  const handleCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (readOnly) {
      return
    }
    setSelection(null)

    if (event.target !== event.currentTarget || activePointersRef.current.size > 1) {
      return
    }

    if (!isMobileViewport && viewScale <= 1) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setDragState({
      type: 'pan',
      startPanX: viewPan.x,
      startPanY: viewPan.y,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
    })
  }

  const handleViewportPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (activePointersRef.current.size === 1 && event.target === event.currentTarget) {
      if (isMobileViewport || viewScale > 1) {
        setSelection(null)
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragState({
          type: 'pan',
          startPanX: viewPan.x,
          startPanY: viewPan.y,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
        })
      }
    }

    if (activePointersRef.current.size !== 2) {
      return
    }

    setDragState(null)
    const points = [...activePointersRef.current.values()]
    const container = scrollContainerRef.current

    if (!container) {
      return
    }

    const rect = container.getBoundingClientRect()
    const midpointX = (points[0].x + points[1].x) / 2 - rect.left
    const midpointY = (points[0].y + points[1].y) / 2 - rect.top

    pinchRef.current = {
      startDistance: pointerDistance(points[0], points[1]),
      startScale: viewScale,
      startPanX: viewPan.x,
      startPanY: viewPan.y,
      midpointX,
      midpointY,
    }
  }

  const handleViewportPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current

    if (drag?.type === 'pan') {
      setViewPan({
        x: drag.startPanX + (event.clientX - drag.startPointerX),
        y: drag.startPanY + (event.clientY - drag.startPointerY),
      })
    }

    if (!activePointersRef.current.has(event.pointerId)) {
      return
    }

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const pinch = pinchRef.current

    if (!pinch || activePointersRef.current.size < 2) {
      return
    }

    const points = [...activePointersRef.current.values()]
    const distance = pointerDistance(points[0], points[1])
    const nextScale = clampViewScale(pinch.startScale * (distance / pinch.startDistance))
    const ratio = nextScale / pinch.startScale

    setViewScale(nextScale)
    setViewPan({
      x: pinch.midpointX - (pinch.midpointX - pinch.startPanX) * ratio,
      y: pinch.midpointY - (pinch.midpointY - pinch.startPanY) * ratio,
    })
  }

  const endViewportPointer = (event: PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId)

    if (activePointersRef.current.size < 2) {
      pinchRef.current = null
    }

    if (dragStateRef.current?.type === 'pan') {
      setDragState(null)
    }
  }

  const handleTablePointerDown = (tableKey: string, event: PointerEvent<HTMLDivElement>) => {
    if (readOnly) {
      return
    }
    event.stopPropagation()
    setSelection({ kind: 'table', tableKey })

    const position = positionsByKey.get(tableKey)

    if (!position) {
      return
    }

    const pointer = pointerToPercent(event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragState({
      type: 'table',
      tableKey,
      offsetX: pointer.x - position.x,
      offsetY: pointer.y - position.y,
    })
  }

  const handleElementPointerDown = (
    element: FloorPlanElement,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (readOnly) {
      return
    }
    event.stopPropagation()
    setSelection({ kind: 'element', id: element.id })

    const pointer = pointerToPercent(event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragState({
      type: 'element',
      elementId: element.id,
      offsetX: pointer.x - element.x,
      offsetY: pointer.y - element.y,
    })
  }

  const startResize = (
    target: 'element' | 'table',
    id: string,
    width: number,
    height: number,
    axis: 'corner' | 'width' | 'height',
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation()
    const pointer = pointerToPercent(event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragState({
      type: 'resize',
      target,
      id,
      axis,
      startWidth: width,
      startHeight: height,
      startPointerX: pointer.x,
      startPointerY: pointer.y,
    })
  }

  const startRotate = (
    target: 'element' | 'table',
    id: string,
    rotation: number,
    centerX: number,
    centerY: number,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation()
    const pointer = pointerToPercent(event.clientX, event.clientY)
    const startAngle = (Math.atan2(pointer.y - centerY, pointer.x - centerX) * 180) / Math.PI
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragState({
      type: 'rotate',
      target,
      id,
      startRotation: rotation,
      startAngle,
      centerX,
      centerY,
    })
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current

    if (!drag || drag.type === 'pan') {
      return
    }

    const pointer = pointerToPercent(event.clientX, event.clientY)

    if (drag.type === 'table') {
      updateTable(drag.tableKey, {
        x: clampPercent(pointer.x - drag.offsetX, 2, 96),
        y: clampPercent(pointer.y - drag.offsetY, 2, 96),
      })
      return
    }

    if (drag.type === 'element') {
      updateElement(drag.elementId, {
        x: clampPercent(pointer.x - drag.offsetX, 0, 95),
        y: clampPercent(pointer.y - drag.offsetY, 0, 95),
      })
      return
    }

    if (drag.type === 'resize') {
      const widthDelta = pointer.x - drag.startPointerX
      const heightDelta = pointer.y - drag.startPointerY
      const nextWidth =
        drag.axis === 'height'
          ? drag.startWidth
          : clampPercent(drag.startWidth + widthDelta, 3, 45)
      const nextHeight =
        drag.axis === 'width'
          ? drag.startHeight
          : clampPercent(drag.startHeight + heightDelta, 3, 45)

      if (drag.target === 'element') {
        updateElement(drag.id, { width: nextWidth, height: nextHeight })
      } else {
        updateTable(drag.id, { width: nextWidth, height: nextHeight })
      }
      return
    }

    const angle = (Math.atan2(pointer.y - drag.centerY, pointer.x - drag.centerX) * 180) / Math.PI
    const nextRotation = drag.startRotation + (angle - drag.startAngle)

    if (drag.target === 'element') {
      updateElement(drag.id, { rotation: nextRotation })
    } else {
      updateTable(drag.id, { rotation: nextRotation })
    }
  }

  const handleTableVariantChange = (tableKey: string, variantId: string) => {
    updateTable(tableKey, { variant: variantId })
  }

  const handlePointerUp = () => {
    setDragState(null)
  }

  const usePatternFloor = !syncedPlan.backgroundImageUrl
  const floorStyle = syncedPlan.floorStyle ?? 'wine'
  const selectedTableKey = selection?.kind === 'table' ? selection.tableKey : undefined
  const selectedTablePosition = selectedTableKey
    ? positionsByKey.get(selectedTableKey)
    : undefined
  const showTableVariantPicker = Boolean(selectedTableKey && selectedTablePosition)

  const renderPaletteIcon = (
    key: string,
    src: string,
    label: string,
    isActive: boolean,
    onClick: () => void,
    disabled = false,
  ) => (
    <button
      key={key}
      type="button"
      className={[
        styles.paletteIcon,
        isActive ? styles.paletteIconActive : '',
        disabled ? styles.paletteIconMuted : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={label}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >
      <img src={src} alt="" draggable={false} />
    </button>
  )

  const renderDecorPalette = (muted: boolean) => (
    <>
      {!muted &&
        FLOOR_PLAN_MESA_PALETTE.map((item) =>
          renderPaletteIcon(item.id, item.src, item.label, false, () =>
            addElementFromPalette(item),
          ),
        )}
      {FLOOR_PLAN_CHAIR_PALETTE.map((item) =>
        renderPaletteIcon(
          item.id,
          item.src,
          item.label,
          false,
          () => addElementFromPalette(item),
          muted,
        ),
      )}
      {FLOOR_PLAN_PALETTE.filter((item) => item.type !== 'chair').map((item) =>
        renderPaletteIcon(
          item.id,
          item.src,
          item.label,
          false,
          () => addElementFromPalette(item),
          muted,
        ),
      )}
    </>
  )

  return (
    <div className={`${styles.wrapper} ${embedded ? styles.wrapperEmbedded : ''}`}>
      <div className={styles.editorLayout}>
        <div className={styles.mainColumn}>
          {!readOnly ? (
          <div className={styles.objectPalette}>
            {showTableVariantPicker && selectedTableKey ? (
              <>
                {FLOOR_PLAN_TABLE_VARIANTS.map((option) =>
                  renderPaletteIcon(
                    option.id,
                    option.src,
                    option.label,
                    (selectedTablePosition?.variant ?? getDefaultTableVariant()) === option.id,
                    () => handleTableVariantChange(selectedTableKey, option.id),
                  ),
                )}
                {renderDecorPalette(true)}
              </>
            ) : (
              renderDecorPalette(false)
            )}
          </div>
          ) : null}

          <div
            ref={scrollContainerRef}
            className={styles.canvasScroll}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={endViewportPointer}
            onPointerCancel={endViewportPointer}
            onPointerLeave={endViewportPointer}
          >
            <div
              className={styles.canvasViewport}
              style={{
                transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${viewScale})`,
              }}
            >
              <div
                ref={canvasRef}
                className={`${styles.canvas} ${usePatternFloor ? FLOOR_STYLE_CLASSES[floorStyle] : ''}`}
                style={{
                  width: `${syncedPlan.canvasWidth}px`,
                  height: `${syncedPlan.canvasHeight}px`,
                  backgroundColor: usePatternFloor ? undefined : syncedPlan.backgroundColor,
                  backgroundImage: syncedPlan.backgroundImageUrl
                    ? `url(${syncedPlan.backgroundImageUrl})`
                    : undefined,
                }}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
              {syncedPlan.elements.map((element) => {
                const isSelected = selection?.kind === 'element' && selection.id === element.id
                const isDragging =
                  dragState?.type === 'element' && dragState.elementId === element.id
                const rotation = element.rotation ?? 0
                const centerX = element.x + element.width / 2
                const centerY = element.y + element.height / 2

                return (
                  <div
                    key={element.id}
                    className={[
                      styles.mapObject,
                      isSelected ? styles.mapObjectSelected : '',
                      isDragging ? styles.mapObjectDragging : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left: `${element.x}%`,
                      top: `${element.y}%`,
                      width: `${element.width}%`,
                      height: `${element.height}%`,
                      transform: `rotate(${rotation}deg)`,
                    }}
                    onPointerDown={(event) => handleElementPointerDown(element, event)}
                  >
                    <img
                      src={resolveElementImage(element.type, element.variant)}
                      alt=""
                      className={styles.mapObjectImage}
                      draggable={false}
                    />
                    {isSelected && (
                      <SelectionHandles
                        onRotate={(event) =>
                          startRotate('element', element.id, rotation, centerX, centerY, event)
                        }
                        onResize={(event) =>
                          startResize(
                            'element',
                            element.id,
                            element.width,
                            element.height,
                            'corner',
                            event,
                          )
                        }
                        onDelete={(event) => {
                          event.stopPropagation()
                          removeElement(element.id)
                        }}
                      />
                    )}
                  </div>
                )
              })}

              {tables.map((table, index) => {
                const tableKey = getTableMapKey(table, index)
                const position = positionsByKey.get(tableKey)

                if (!position) {
                  return null
                }

                const isSelected = selection?.kind === 'table' && selection.tableKey === tableKey
                const isDragging = dragState?.type === 'table' && dragState.tableKey === tableKey
                const rotation = position.rotation ?? 0
                const tableName = table.name.trim() || `Mesa ${index + 1}`

                return (
                  <div
                    key={tableKey}
                    className={[
                      styles.tableObject,
                      isSelected ? styles.mapObjectSelected : '',
                      isDragging ? styles.mapObjectDragging : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      width: `${position.width}%`,
                      height: `${position.height}%`,
                      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    }}
                    onPointerDown={(event) => handleTablePointerDown(tableKey, event)}
                  >
                    <span className={styles.tableLabel}>{tableName}</span>
                    <img
                      src={resolveTableImage(position.variant)}
                      alt=""
                      className={styles.tableImage}
                      draggable={false}
                    />
                    {isSelected && (
                      <SelectionHandles
                        onRotate={(event) =>
                          startRotate('table', tableKey, rotation, position.x, position.y, event)
                        }
                        onResize={(event) =>
                          startResize(
                            'table',
                            tableKey,
                            position.width,
                            position.height,
                            'corner',
                            event,
                          )
                        }
                      />
                    )}
                  </div>
                )
              })}
              </div>
            </div>
          </div>
        </div>

        {!readOnly ? (
        <aside className={styles.sidebar} aria-label="Herramientas del mapa">
          <div className={styles.sidebarSection}>
            <span className={styles.toolbarLabel}>Tamaño</span>
            <div className={styles.sizeColumn}>
              <label>
                Ancho
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draftWidth}
                  onChange={(e) => setDraftWidth(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyCanvasSize()
                    }
                  }}
                />
              </label>
              <label>
                Alto
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draftHeight}
                  onChange={(e) => setDraftHeight(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyCanvasSize()
                    }
                  }}
                />
              </label>
              <button type="button" className={styles.applySizeButton} onClick={applyCanvasSize}>
                Aplicar
              </button>
              <p className={styles.sizeHint}>
                Mín. {MIN_CANVAS_WIDTH}×{MIN_CANVAS_HEIGHT} · Máx. {MAX_CANVAS_WIDTH}×
                {MAX_CANVAS_HEIGHT}
              </p>
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <button
              type="button"
              className={`${styles.toolButton} ${floorsOpen ? styles.sidebarToggleActive : ''}`}
              aria-expanded={floorsOpen}
              onClick={() => setFloorsOpen((open) => !open)}
            >
              Suelos
            </button>
            {floorsOpen && (
              <div className={styles.floorPicker}>
                {FLOOR_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      styles.floorSwatch,
                      styles[`floorSwatch_${option.id}`],
                      floorStyle === option.id ? styles.floorSwatchActive : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={option.label}
                    aria-label={option.label}
                    onClick={() => {
                      patchPlan({
                        floorStyle: option.id,
                        backgroundImageUrl: '',
                      })
                      setFloorsOpen(false)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
        ) : null}
      </div>
    </div>
  )
}

export default FloorPlanEditor
