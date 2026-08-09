import { useEffect, useRef } from 'react'
import { createCanvasFire } from '../../utils/canvasFireRenderer'
import CardSparkleLayer from './CardSparkleLayer'
import styles from './CardFlameLayer.module.css'

interface CardFlameLayerProps {
  compact?: boolean
}

/**
 * Fuego procedural con partículas en canvas (globalCompositeOperation: lighter).
 * Técnica estándar para llamas orgánicas — no siluetas estáticas tipo vela.
 */
function CardFlameLayer({ compact = false }: CardFlameLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    const fire = createCanvasFire(canvas, { compact })

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        fire.resize(width, height)
      }
    })
    resizeObserver.observe(container)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          fire.start()
        } else {
          fire.stop()
        }
      },
      { threshold: 0.05 },
    )
    intersectionObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      fire.destroy()
    }
  }, [compact])

  return (
    <div
      ref={containerRef}
      className={`${styles.layer} ${compact ? styles.layerCompact : ''}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.coals} />
      <CardSparkleLayer compact={compact} />
    </div>
  )
}

export default CardFlameLayer
