import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { loadImageFile, loadImageForEditing, renderImageRegion, type LoadedImage } from '../utils/imageResize'
import styles from './ImageCropModal.module.css'
import { friendlyErrorMessage } from '../utils/friendlyError'

interface ImageCropModalProps {
  file: File
  /** Ancho / alto del recorte (1 = cuadrado). */
  aspect?: number
  round?: boolean
  /** Lado mayor del resultado en píxeles. */
  outputSize?: number
  title?: string
  onCancel: () => void
  onConfirm: (file: File) => void
}

const MAX_ZOOM = 4

/** Clamp de la posición para que la foto siempre cubra todo el recorte. */
function clampOffset(offset: { x: number; y: number }, displayW: number, displayH: number, viewW: number, viewH: number) {
  const maxX = Math.max(0, (displayW - viewW) / 2)
  const maxY = Math.max(0, (displayH - viewH) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

/** Recortar y hacer zoom a una foto antes de subirla. */
function ImageCropModal({
  file,
  aspect = 1,
  round = false,
  outputSize = 1024,
  title = 'Ajusta tu foto',
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const titleId = useId()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    let loaded: LoadedImage | null = null
    loadImageForEditing(file)
      .then((result) => {
        loaded = result
        if (cancelled) URL.revokeObjectURL(result.url)
        else setImage(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(friendlyErrorMessage(error, 'No se pudo abrir la imagen.'))
      })
    return () => {
      cancelled = true
      if (loaded) URL.revokeObjectURL(loaded.url)
    }
  }, [file])

  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const measure = () => setView({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, saving])

  // Escala base: la foto cubre justo el recorte con zoom 1.
  const baseScale = image && view.width ? Math.max(view.width / image.width, view.height / image.height) : 1
  const scale = baseScale * zoom
  const displayW = image ? image.width * scale : 0
  const displayH = image ? image.height * scale : 0

  // El zoom va en una ref y se aplica como mucho una vez por fotograma: al
  // deslizar la barra o pellizcar llegan decenas de cambios por segundo.
  const zoomRef = useRef(1)
  const pendingZoom = useRef<number | null>(null)
  const zoomFrame = useRef<number | null>(null)

  const commitZoom = useCallback((nextZoom: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
    const previous = zoomRef.current
    if (clamped === previous) return
    zoomRef.current = clamped
    setZoom(clamped)
    if (image && view.width) {
      const nextScale = Math.max(view.width / image.width, view.height / image.height) * clamped
      setOffset((current) => clampOffset(
        { x: current.x * (clamped / previous), y: current.y * (clamped / previous) },
        image.width * nextScale,
        image.height * nextScale,
        view.width,
        view.height,
      ))
    }
  }, [image, view])

  const applyZoom = useCallback((nextZoom: number) => {
    pendingZoom.current = nextZoom
    if (zoomFrame.current != null) return
    zoomFrame.current = requestAnimationFrame(() => {
      zoomFrame.current = null
      const value = pendingZoom.current
      pendingZoom.current = null
      if (value != null) commitZoom(value)
    })
  }, [commitZoom])

  useEffect(() => () => {
    if (zoomFrame.current != null) cancelAnimationFrame(zoomFrame.current)
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomRef.current }
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const current = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, current)

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinchStart.current.distance > 0) applyZoom(pinchStart.current.zoom * (distance / pinchStart.current.distance))
      return
    }

    setOffset((value) => clampOffset(
      { x: value.x + current.x - previous.x, y: value.y + current.y - previous.y },
      displayW,
      displayH,
      view.width,
      view.height,
    ))
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
  }

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    // La rueda del ratón hace zoom (passive: false para que no mueva la página).
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      applyZoom(zoomRef.current * (event.deltaY < 0 ? 1.08 : 1 / 1.08))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  const handleConfirm = async () => {
    if (!image || !view.width) return
    setSaving(true)
    let full: LoadedImage | null = null
    try {
      // Píxel del recorte → píxel de la copia de trabajo.
      const sw = view.width / scale
      const sh = view.height / scale
      const sx = image.width / 2 - (view.width / 2 + offset.x) / scale
      const sy = image.height / 2 - (view.height / 2 + offset.y) / scale

      // El recorte final sale de la foto original (nítido aunque haya mucho
      // zoom). Se abre solo un momento, al confirmar, no mientras se mueve.
      full = await loadImageFile(file)
      const ratio = full.width / image.width
      const region = {
        sx: Math.max(0, sx * ratio),
        sy: Math.max(0, sy * ratio),
        sw: Math.min(sw * ratio, full.width),
        sh: Math.min(sh * ratio, full.height),
      }
      const longest = Math.min(outputSize, Math.round(Math.max(region.sw, region.sh)))
      const outW = aspect >= 1 ? longest : Math.round(longest * aspect)
      const outH = aspect >= 1 ? Math.round(longest / aspect) : longest
      const result = await renderImageRegion(full, region, Math.max(1, outW), Math.max(1, outH), file.type, file.name)
      onConfirm(result)
    } catch (error) {
      setLoadError(friendlyErrorMessage(error, 'No se pudo preparar la imagen.'))
      setSaving(false)
    } finally {
      if (full) {
        full.element.src = ''
        URL.revokeObjectURL(full.url)
      }
    }
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <p className={styles.hint}>Arrastra para moverla y usa el zoom para elegir qué parte se ve.</p>

        <div
          ref={viewportRef}
          className={`${styles.viewport} ${round ? styles.round : ''}`}
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Zona de recorte: arrastra para mover la foto"
        >
          {image ? (
            <img
              src={image.url}
              alt=""
              draggable={false}
              className={styles.photo}
              style={{
                width: image.width,
                height: image.height,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
              }}
            />
          ) : (
            <span className={styles.loading}>{loadError ? '' : 'Abriendo foto…'}</span>
          )}
        </div>

        <label className={styles.zoomRow}>
          <span aria-hidden="true">−</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => applyZoom(Number(event.target.value))}
            aria-label="Zoom"
            disabled={!image}
          />
          <span aria-hidden="true">+</span>
        </label>

        {loadError ? <p className={styles.error} role="alert">{loadError}</p> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className={styles.primary} onClick={() => void handleConfirm()} disabled={!image || saving}>
            {saving ? 'Preparando…' : 'Usar esta foto'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImageCropModal
