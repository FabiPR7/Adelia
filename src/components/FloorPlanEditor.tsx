import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
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

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function FloorPlanEditor({ tables, floorPlan, onChange, embedded = false }: FloorPlanEditorProps) {
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
  const [dragState, setDragState] = useState<DragKind | null>(null)
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
    if (dragState?.type === 'pan') {
      setViewPan({
        x: dragState.startPanX + (event.clientX - dragState.startPointerX),
        y: dragState.startPanY + (event.clientY - dragState.startPointerY),
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

    if (dragState?.type === 'pan') {
      setDragState(null)
    }
  }

  const handleTablePointerDown = (tableKey: string, event: PointerEvent<HTMLDivElement>) => {
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
    event: PointerEvent<HTMLSpanElement>,
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
    event: PointerEvent<HTMLSpanElement>,
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
    if (!dragState || dragState.type === 'pan') {
      return
    }

    const pointer = pointerToPercent(event.clientX, event.clientY)

    if (dragState.type === 'table') {
      updateTable(dragState.tableKey, {
        x: clampPercent(pointer.x - dragState.offsetX, 2, 96),
        y: clampPercent(pointer.y - dragState.offsetY, 2, 96),
      })
      return
    }

    if (dragState.type === 'element') {
      updateElement(dragState.elementId, {
        x: clampPercent(pointer.x - dragState.offsetX, 0, 95),
        y: clampPercent(pointer.y - dragState.offsetY, 0, 95),
      })
      return
    }

    if (dragState.type === 'resize') {
      const widthDelta = pointer.x - dragState.startPointerX
      const heightDelta = pointer.y - dragState.startPointerY
      const nextWidth =
        dragState.axis === 'height'
          ? dragState.startWidth
          : clampPercent(dragState.startWidth + widthDelta, 3, 45)
      const nextHeight =
        dragState.axis === 'width'
          ? dragState.startHeight
          : clampPercent(dragState.startHeight + heightDelta, 3, 45)

      if (dragState.target === 'element') {
        updateElement(dragState.id, { width: nextWidth, height: nextHeight })
      } else {
        updateTable(dragState.id, { width: nextWidth, height: nextHeight })
      }
      return
    }

    const angle = (Math.atan2(pointer.y - dragState.centerY, pointer.x - dragState.centerX) * 180) / Math.PI
    const nextRotation = dragState.startRotation + (angle - dragState.startAngle)

    if (dragState.target === 'element') {
      updateElement(dragState.id, { rotation: nextRotation })
    } else {
      updateTable(dragState.id, { rotation: nextRotation })
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
                      <>
                        <span
                          className={styles.rotateHandle}
                          title="Girar"
                          onPointerDown={(event) =>
                            startRotate('element', element.id, rotation, centerX, centerY, event)
                          }
                        />
                        <span
                          className={styles.resizeHandleWidth}
                          title="Ancho"
                          onPointerDown={(event) =>
                            startResize(
                              'element',
                              element.id,
                              element.width,
                              element.height,
                              'width',
                              event,
                            )
                          }
                        />
                        <span
                          className={styles.resizeHandleHeight}
                          title="Alto"
                          onPointerDown={(event) =>
                            startResize(
                              'element',
                              element.id,
                              element.width,
                              element.height,
                              'height',
                              event,
                            )
                          }
                        />
                        <span
                          className={styles.resizeHandle}
                          title="Ancho y alto"
                          onPointerDown={(event) =>
                            startResize(
                              'element',
                              element.id,
                              element.width,
                              element.height,
                              'corner',
                              event,
                            )
                          }
                        />
                        <span
                          className={styles.deleteHandle}
                          title="Eliminar"
                          role="button"
                          aria-label="Eliminar"
                          onPointerDown={(event) => {
                            event.stopPropagation()
                            removeElement(element.id)
                          }}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                      </>
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
                      <>
                        <span
                          className={styles.rotateHandle}
                          title="Girar"
                          onPointerDown={(event) =>
                            startRotate('table', tableKey, rotation, position.x, position.y, event)
                          }
                        />
                        <span
                          className={styles.resizeHandleWidth}
                          title="Ancho"
                          onPointerDown={(event) =>
                            startResize(
                              'table',
                              tableKey,
                              position.width,
                              position.height,
                              'width',
                              event,
                            )
                          }
                        />
                        <span
                          className={styles.resizeHandleHeight}
                          title="Alto"
                          onPointerDown={(event) =>
                            startResize(
                              'table',
                              tableKey,
                              position.width,
                              position.height,
                              'height',
                              event,
                            )
                          }
                        />
                        <span
                          className={styles.resizeHandle}
                          title="Ancho y alto"
                          onPointerDown={(event) =>
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
                      </>
                    )}
                  </div>
                )
              })}
              </div>
            </div>
          </div>
        </div>

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
      </div>
    </div>
  )
}

export default FloorPlanEditor
