import { useEffect, useState } from 'react'
import { loadLadderMapThemeImage } from '../../utils/promotionLadderMapAssets'
import type { LadderMapThemeId } from '../../utils/promotionLadderMapThemes'
import styles from './PromotionLadderMapModal.module.css'

interface PromotionLadderMapThemeArtProps {
  themeId: LadderMapThemeId
}

export default function PromotionLadderMapThemeArt({ themeId }: PromotionLadderMapThemeArtProps) {
  const [src, setSrc] = useState<string | null>(null)
  const grainId = `ladder-map-grain-${themeId}`
  const vignetteId = `ladder-map-vignette-${themeId}`

  useEffect(() => {
    let cancelled = false
    setSrc(null)

    void loadLadderMapThemeImage(themeId).then((url) => {
      if (!cancelled) {
        setSrc(url)
      }
    })

    return () => {
      cancelled = true
    }
  }, [themeId])

  return (
    <div className={styles.themeArt} aria-hidden="true">
      {src ? <img className={styles.themeArtImage} src={src} alt="" /> : null}
      <svg className={styles.themeArtOverlay} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.28" />
            </feComponentTransfer>
          </filter>
          <radialGradient id={vignetteId} cx="50%" cy="48%" r="72%">
            <stop offset="52%" stopColor="rgba(40, 22, 10, 0)" />
            <stop offset="100%" stopColor="rgba(28, 14, 8, 0.38)" />
          </radialGradient>
        </defs>
        <g stroke="rgba(62, 38, 18, 0.16)" strokeWidth="0.18" fill="none">
          <path d="M0 18 H100 M0 36 H100 M0 54 H100 M0 72 H100 M0 90 H100" />
          <path d="M16 0 V100 M32 0 V100 M50 0 V100 M68 0 V100 M84 0 V100" />
          <path d="M0 0 L100 100 M100 0 L0 100" stroke="rgba(139, 105, 20, 0.12)" />
        </g>
        <rect width="100" height="100" filter={`url(#${grainId})`} opacity="0.42" />
        <rect width="100" height="100" fill={`url(#${vignetteId})`} />
      </svg>
    </div>
  )
}

export function LadderMapCompassRose() {
  return (
    <svg className={styles.compassRose} viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="41" fill="rgba(255, 248, 230, 0.92)" stroke="#8a6a2a" strokeWidth="1.6" />
      <circle cx="44" cy="44" r="34" fill="none" stroke="rgba(138, 106, 42, 0.35)" strokeWidth="0.8" />
      <circle cx="44" cy="44" r="18" fill="rgba(201, 162, 39, 0.12)" stroke="rgba(138, 106, 42, 0.45)" strokeWidth="0.7" />
      <g stroke="#5c3d1e" strokeWidth="0.7">
        <path d="M44 8 V16 M44 72 V80 M8 44 H16 M72 44 H80" />
        <path d="M18 18 L23 23 M70 18 L65 23 M18 70 L23 65 M70 70 L65 65" />
      </g>
      <path d="M44 12 L48 44 L44 40 L40 44 Z" fill="#b91c1c" />
      <path d="M44 76 L40 44 L44 48 L48 44 Z" fill="#1f2937" />
      <path d="M12 44 L44 40 L40 44 L44 48 Z" fill="#b91c1c" />
      <path d="M76 44 L44 48 L48 44 L44 40 Z" fill="#1f2937" />
      <circle cx="44" cy="44" r="3.2" fill="#c9a227" stroke="#5c3d1e" strokeWidth="0.7" />
      <text x="44" y="11" textAnchor="middle" fill="#7a1f12" fontSize="8" fontFamily="Georgia, serif" fontWeight="700">
        N
      </text>
    </svg>
  )
}
