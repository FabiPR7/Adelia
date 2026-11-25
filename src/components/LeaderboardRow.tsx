import type { CSSProperties } from 'react'
import { getStripBackground, getStripEmblem } from '../utils/levelRankingStripAssets'
import { getLevelRankingStripTheme } from '../utils/levelRankingStripThemes'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './LeaderboardRow.module.css'
import { formatNumber } from '../utils/formatNumber'

export interface LeaderboardRowProps {
  level: number
  levelTitle: string
  displayName: string
  xp: number
  levelProgress?: number
  /** Puesto (sin él, la fila no lleva columna de puesto: buscador, solicitudes…). */
  rank?: number
  photoUrl?: string
  /** Tu fila: borde naranja y etiqueta «Tú». */
  isYou?: boolean
  /** Seleccionada o favorita. */
  highlight?: boolean
  /** Texto pequeño a la derecha bajo el XP (p. ej. «+120 XP para pasarle»). */
  hint?: string
}

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

/**
 * Fila de clasificación. Cada jugador va sobre la sala de SU nivel (cocina casera,
 * explorador, barrio… deidad) con sus colores, pero ordenada como un ranking de
 * verdad: columna fija del puesto (oro, plata y bronce para el podio), foto con su
 * escudo, nombre legible, rango y XP alineado a la derecha.
 */
function LeaderboardRow({
  level: rawLevel,
  levelTitle,
  displayName,
  xp,
  levelProgress = 0,
  rank,
  photoUrl,
  isYou = false,
  highlight = false,
  hint,
}: LeaderboardRowProps) {
  const level = Math.min(12, Math.max(1, rawLevel || 1))
  const theme = getLevelRankingStripTheme(level)
  const podium = rank != null && rank <= 3 ? rank : null
  const vars = {
    '--row-overlay': theme.overlay,
    '--row-border': theme.cardBorder,
    '--row-ring': theme.avatarBorder,
    '--row-title': theme.titleColor,
    '--row-fill': theme.xpFill,
    '--row-track': theme.xpTrack,
  } as CSSProperties

  return (
    <article
      className={`${styles.row} ${isYou ? styles.you : ''} ${highlight ? styles.highlight : ''} ${rank == null ? styles.noRank : ''}`}
      style={vars}
      aria-label={`${rank != null ? `Puesto ${rank}. ` : ''}${isYou ? 'Tú' : displayName}, nivel ${level}, ${levelTitle}, ${formatNumber(xp)} XP`}
    >
      <img src={getStripBackground(level)} alt="" className={styles.bg} draggable={false} decoding="async" />
      <span className={styles.overlay} aria-hidden="true" />

      {rank != null ? (
        <span className={`${styles.rank} ${podium ? styles[`medal${podium}`] : ''}`} aria-hidden="true">
          {rank}
        </span>
      ) : null}

      <span className={styles.avatar} aria-hidden="true">
        {photoUrl ? (
          <img src={optimizeCloudinaryUrl(photoUrl, CLOUDINARY_DISPLAY.logo)} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.initials}>{initials(displayName)}</span>
        )}
        <img src={getStripEmblem(level)} alt="" className={styles.shield} draggable={false} />
      </span>

      <span className={styles.body}>
        <span className={styles.nameLine}>
          <span className={styles.name}>{displayName || 'Tú'}</span>
          {isYou ? <span className={styles.youTag}>TÚ</span> : null}
        </span>
        <span className={styles.title}>Nv. {level} · {levelTitle}</span>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.fill} style={{ width: `${Math.min(100, Math.max(4, Math.round(levelProgress * 100)))}%` }} />
        </span>
      </span>

      <span className={styles.score}>
        <strong>{formatNumber(xp)}</strong>
        <span>{hint ?? 'XP'}</span>
      </span>
    </article>
  )
}

export default LeaderboardRow
