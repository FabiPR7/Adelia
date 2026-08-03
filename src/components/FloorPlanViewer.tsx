import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import type { FloorPlan, TableInput } from '../types'
import { getTableMapKey, syncFloorPlanWithTables, type FloorStyleId } from '../types/company'
import {
  resolveElementImage,
  resolveTableImage,
} from '../utils/floorPlanAssets'
import editorStyles from './FloorPlanEditor.module.css'
import styles from './FloorPlanViewer.module.css'

const MIN_VIEW_SCALE = 0.35
const MAX_VIEW_SCALE = 3
const MIN_PINCH_DISTANCE = 10
const DRAG_CLICK_THRESHOLD = 6

const FLOOR_STYLE_CLASSES: Record<FloorStyleId, string> = {
  wine: editorStyles.canvasFloorWine,
  wood: editorStyles.canvasFloorWood,
  checker: editorStyles.canvasFloorChecker,
  ceramic: editorStyles.canvasFloorCeramic,
  carpet: editorStyles.canvasFloorCarpet,
  marble: editorStyles.canvasFloorMarble,
  slate: editorStyles.canvasFloorSlate,
}

function clampViewScale(scale: number) {
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale))
}

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function isTableTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button'))
}

interface FloorPlanViewerProps {
  floorPlan: FloorPlan
  tables: TableInput[]
  selectedTableId: string | null
  onSelectTable: (tableId: string) => void
  compact?: boolean
  large?: boolean
}

function FloorPlanViewer({
  floorPlan,
  tables,
  selectedTableId,
  onSelectTable,
  compact = false,
  large = false,
}: FloorPlanViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{
    startDistance: number
    startScale: number
    startPanX: number
    startPanY: number
    midpointX: number
    midpointY: number
  } | null>(null)
  const panRef = useRef<{ startPanX: number; startPanY: number; startX: number; startY: number } | null>(
    null,
  )
  const viewScaleRef = useRef(0.5)
  const viewPanRef = useRef({ x: 0, y: 0 })
  const isGesturingRef = useRef(false)
  const suppressTableClickRef = useRef(false)
  const dragDistanceRef = useRef(0)
  const [viewScale, setViewScale] = useState(0.5)
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  const syncedPlan = useMemo(
    () => syncFloorPlanWithTables(floorPlan, tables),
    [floorPlan, tables],
  )

  const positionsByKey = useMemo(
    () => new Map(syncedPlan.tablePositions.map((item) => [item.tableKey, item])),
    [syncedPlan.tablePositions],
  )

  const usePatternFloor = !syncedPlan.backgroundImageUrl
  const floorStyle = syncedPlan.floorStyle ?? 'wine'

  const clampPan = useCallback(
    (pan: { x: number; y: number }, scale: number) => {
      const container = scrollContainerRef.current

      if (!container) {
        return pan
      }

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const scaledWidth = syncedPlan.canvasWidth * scale
      const scaledHeight = syncedPlan.canvasHeight * scale

      let x = pan.x
      let y = pan.y

      if (scaledWidth <= containerWidth) {
        x = (containerWidth - scaledWidth) / 2
      } else {
        x = Math.min(0, Math.max(containerWidth - scaledWidth, x))
      }

      if (scaledHeight <= containerHeight) {
        y = (containerHeight - scaledHeight) / 2
      } else {
        y = Math.min(0, Math.max(containerHeight - scaledHeight, y))
      }

      return { x, y }
    },
    [syncedPlan.canvasHeight, syncedPlan.canvasWidth],
  )

  const paintTransform = useCallback((scale: number, pan: { x: number; y: number }) => {
    if (viewportRef.current) {
      viewportRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
    }
  }, [])

  const setTransform = useCallback(
    (scale: number, pan: { x: number; y: number }, options?: { clamp?: boolean; syncState?: boolean }) => {
      const clamp = options?.clamp ?? false
      const syncState = options?.syncState ?? false
      const nextScale = clampViewScale(scale)
      const nextPan = clamp ? clampPan(pan, nextScale) : pan

      viewScaleRef.current = nextScale
      viewPanRef.current = nextPan
      paintTransform(nextScale, nextPan)

      if (syncState) {
        setViewScale(nextScale)
        setViewPan(nextPan)
      }
    },
    [clampPan, paintTransform],
  )

  const commitTransform = useCallback(() => {
    isGesturingRef.current = false
    setTransform(viewScaleRef.current, viewPanRef.current, { clamp: true, syncState: true })
  }, [setTransform])

  const fitToContainer = useCallback(() => {
    const container = scrollContainerRef.current

    if (!container) {
      return
    }

    const padding = 8
    const availableWidth = container.clientWidth - padding * 2
    const availableHeight = container.clientHeight - padding * 2
    const scaleX = availableWidth / syncedPlan.canvasWidth
    const scaleY = availableHeight / syncedPlan.canvasHeight
    const scale = clampViewScale(Math.min(scaleX, scaleY))

    setTransform(scale, { x: 0, y: 0 }, { clamp: true, syncState: true })
  }, [setTransform, syncedPlan.canvasHeight, syncedPlan.canvasWidth])

  useLayoutEffect(() => {
    fitToContainer()
  }, [fitToContainer])

  useEffect(() => {
    const container = scrollContainerRef.current

    if (!container) {
      return
    }

    fitToContainer()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      fitToContainer()
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [fitToContainer])

  useEffect(() => {
    const container = scrollContainerRef.current

    if (!container) {
      return
    }

    const blockBrowserGestures = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault()
      }
    }

    container.addEventListener('touchmove', blockBrowserGestures, { passive: false })
    container.addEventListener('gesturestart', (event) => event.preventDefault())
    container.addEventListener('gesturechange', (event) => event.preventDefault())

    return () => {
      container.removeEventListener('touchmove', blockBrowserGestures)
    }
  }, [])

  const beginPinch = () => {
    const points = [...activePointersRef.current.values()]
    const container = scrollContainerRef.current

    if (!container || points.length < 2) {
      return
    }

    const startDistance = pointerDistance(points[0], points[1])

    if (startDistance < MIN_PINCH_DISTANCE) {
      return
    }

    const rect = container.getBoundingClientRect()
    const midpointX = (points[0].x + points[1].x) / 2 - rect.left
    const midpointY = (points[0].y + points[1].y) / 2 - rect.top

    panRef.current = null
    setIsPanning(false)
    isGesturingRef.current = true
    pinchRef.current = {
      startDistance,
      startScale: viewScaleRef.current,
      startPanX: viewPanRef.current.x,
      startPanY: viewPanRef.current.y,
      midpointX,
      midpointY,
    }
  }

  const handleViewportPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    if (isTableTarget(event.target)) {
      return
    }

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)

    if (activePointersRef.current.size === 1) {
      isGesturingRef.current = true
      dragDistanceRef.current = 0
      panRef.current = {
        startPanX: viewPanRef.current.x,
        startPanY: viewPanRef.current.y,
        startX: event.clientX,
        startY: event.clientY,
      }
      setIsPanning(true)
    }

    if (activePointersRef.current.size >= 2) {
      beginPinch()
    }
  }

  const handleViewportPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) {
      return
    }

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const pinch = pinchRef.current

    if (pinch && activePointersRef.current.size >= 2) {
      const points = [...activePointersRef.current.values()]
      const distance = pointerDistance(points[0], points[1])

      if (distance < MIN_PINCH_DISTANCE) {
        return
      }

      const nextScale = clampViewScale(pinch.startScale * (distance / pinch.startDistance))
      const ratio = nextScale / pinch.startScale

      setTransform(nextScale, {
        x: pinch.midpointX - (pinch.midpointX - pinch.startPanX) * ratio,
        y: pinch.midpointY - (pinch.midpointY - pinch.startPanY) * ratio,
      })

      return
    }

    const pan = panRef.current

    if (pan) {
      dragDistanceRef.current = Math.max(
        dragDistanceRef.current,
        Math.hypot(event.clientX - pan.startX, event.clientY - pan.startY),
      )

      setTransform(viewScaleRef.current, {
        x: pan.startPanX + (event.clientX - pan.startX),
        y: pan.startPanY + (event.clientY - pan.startY),
      })
    }
  }

  const endViewportPointer = (event: PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId)

    if (activePointersRef.current.size < 2) {
      pinchRef.current = null
    }

    if (panRef.current) {
      if (dragDistanceRef.current > DRAG_CLICK_THRESHOLD) {
        suppressTableClickRef.current = true
      }

      panRef.current = null
      setIsPanning(false)
    }

    if (activePointersRef.current.size === 0) {
      commitTransform()

      if (suppressTableClickRef.current) {
        window.setTimeout(() => {
          suppressTableClickRef.current = false
        }, 0)
      }

      return
    }

    if (activePointersRef.current.size === 1) {
      isGesturingRef.current = true
    }

    if (activePointersRef.current.size >= 2) {
      beginPinch()
    }
  }

  return (
    <div
      className={[
        styles.wrapper,
        compact ? styles.wrapperCompact : '',
        large ? styles.wrapperLarge : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        ref={scrollContainerRef}
        className={`${styles.canvasScroll} ${isPanning ? styles.canvasScrollPanning : ''}`}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={endViewportPointer}
        onPointerCancel={endViewportPointer}
      >
        <div className={styles.canvasStage}>
          <div
            ref={viewportRef}
            className={styles.canvasViewport}
            style={{
              width: `${syncedPlan.canvasWidth}px`,
              height: `${syncedPlan.canvasHeight}px`,
              transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${viewScale})`,
            }}
          >
            <div
              className={`${styles.canvas} ${editorStyles.canvas} ${usePatternFloor ? FLOOR_STYLE_CLASSES[floorStyle] : ''}`}
              style={{
                width: `${syncedPlan.canvasWidth}px`,
                height: `${syncedPlan.canvasHeight}px`,
                backgroundColor: usePatternFloor ? undefined : syncedPlan.backgroundColor,
                backgroundImage: syncedPlan.backgroundImageUrl
                  ? `url(${syncedPlan.backgroundImageUrl})`
                  : undefined,
              }}
            >
              {syncedPlan.elements.map((element) => {
                const rotation = element.rotation ?? 0

                return (
                  <div
                    key={element.id}
                    className={styles.decorObject}
                    style={{
                      left: `${element.x}%`,
                      top: `${element.y}%`,
                      width: `${element.width}%`,
                      height: `${element.height}%`,
                      transform: `rotate(${rotation}deg)`,
                    }}
                  >
                    <img
                      src={resolveElementImage(element.type, element.variant)}
                      alt=""
                      className={styles.decorImage}
                      draggable={false}
                    />
                  </div>
                )
              })}

              {selectedTableId && <div className={styles.selectionOverlay} aria-hidden="true" />}

              {tables.map((table, index) => {
                const tableKey = getTableMapKey(table, index)
                const position = positionsByKey.get(tableKey)

                if (!position || !table.id) {
                  return null
                }

                const isSelected = selectedTableId === table.id
                const rotation = position.rotation ?? 0
                const tableName = table.name.trim() || `Mesa ${index + 1}`

                return (
                  <button
                    key={table.id}
                    type="button"
                    className={[
                      styles.tableObject,
                      isSelected ? styles.tableObjectSelected : '',
                      selectedTableId && !isSelected ? styles.tableObjectDimmed : '',
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
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={() => {
                      if (suppressTableClickRef.current) {
                        return
                      }

                      onSelectTable(table.id!)
                    }}
                    aria-label={`Seleccionar ${tableName}`}
                  >
                    <span className={styles.tableLabel}>{tableName}</span>
                    <img
                      src={resolveTableImage(position.variant)}
                      alt=""
                      className={styles.tableImage}
                      draggable={false}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloorPlanViewer
