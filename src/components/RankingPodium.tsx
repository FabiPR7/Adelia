import type { CSSProperties } from 'react'
import type { LeaderboardEntry } from '../data/gamificationLeaderboard'
import { getStripBackground, getStripEmblem } from '../utils/levelRankingStripAssets'
import { getLevelRankingStripTheme } from '../utils/levelRankingStripThemes'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './RankingPodium.module.css'
import { formatNumber } from '../utils/formatNumber'

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

const PLACE_LABEL: Record<number, string> = { 1: '1.º', 2: '2.º', 3: '3.º' }

/**
 * Podio de los 3 primeros (2.º – 1.º – 3.º). Cada uno lleva el escudo y los colores
 * de SU nivel (cocina casera, explorador, barrio… hasta la deidad del nivel 12), y
 * el fondo es la sala del nivel del primero.
 */
function RankingPodium({ entries }: { entries: LeaderboardEntry[] }) {
  const top = [...entries].sort((left, right) => left.rank - right.rank).slice(0, 3)
  if (top.length < 2) return null
  const order = [top[1], top[0], top[2]].filter(Boolean) as LeaderboardEntry[]
  const leaderLevel = Math.min(12, Math.max(1, top[0].level || 1))

  return (
    <div className={styles.podium} role="list" aria-label="Podio">
      <img src={getStripBackground(leaderLevel)} alt="" className={styles.backdrop} draggable={false} />
      <span className={styles.shade} aria-hidden="true" />
      {order.map((entry) => {
        const place = entry.rank
        const level = Math.min(12, Math.max(1, entry.level || 1))
        const theme = getLevelRankingStripTheme(level)
        const vars = {
          '--spot-ring': theme.avatarBorder,
          '--spot-border': theme.cardBorder,
          '--spot-fill': theme.xpFill,
        } as CSSProperties
        return (
          <div
            key={`${entry.rank}-${entry.displayName}`}
            className={`${styles.spot} ${styles[`place${place}`]}`}
            style={vars}
            role="listitem"
            aria-label={`${PLACE_LABEL[place] ?? place} ${entry.isYou ? 'tú' : entry.displayName}, nivel ${level}, ${formatNumber(entry.xp)} XP`}
          >
            <span className={styles.avatar}>
              {place === 1 ? <span className={styles.crown} aria-hidden="true">👑</span> : null}
              {entry.photoUrl ? (
                <img src={optimizeCloudinaryUrl(entry.photoUrl, CLOUDINARY_DISPLAY.logo)} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className={styles.initials}>{initials(entry.displayName)}</span>
              )}
              <img src={getStripEmblem(level)} alt="" className={styles.shield} draggable={false} />
            </span>
            <span className={styles.name}>{entry.isYou ? 'Tú' : entry.displayName}</span>
            <span className={styles.levelTitle}>{entry.levelTitle}</span>
            <span className={styles.xp}>{formatNumber(entry.xp)} XP</span>
            <span className={styles.block}>
              <span className={styles.number}>{PLACE_LABEL[place] ?? place}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default RankingPodium
