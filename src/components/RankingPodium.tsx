import type { LeaderboardEntry } from '../data/gamificationLeaderboard'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './RankingPodium.module.css'

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

/** Podio de los 3 primeros: 2.º – 1.º – 3.º, con pedestales que suben al aparecer. */
function RankingPodium({ entries }: { entries: LeaderboardEntry[] }) {
  const top = [...entries].sort((left, right) => left.rank - right.rank).slice(0, 3)
  if (top.length < 2) return null
  const order = [top[1], top[0], top[2]].filter(Boolean) as LeaderboardEntry[]

  return (
    <div className={styles.podium} role="list" aria-label="Podio">
      {order.map((entry) => {
        const place = entry.rank
        return (
          <div key={`${entry.rank}-${entry.displayName}`} className={`${styles.spot} ${styles[`place${place}`]}`} role="listitem">
            <span className={styles.avatar}>
              {place === 1 ? <span className={styles.crown} aria-hidden="true">👑</span> : null}
              {entry.photoUrl ? (
                <img src={optimizeCloudinaryUrl(entry.photoUrl, CLOUDINARY_DISPLAY.logo)} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className={styles.initials}>{initials(entry.displayName)}</span>
              )}
            </span>
            <span className={styles.name}>{entry.isYou ? 'Tú' : entry.displayName}</span>
            <span className={styles.xp}>{entry.xp.toLocaleString('es-ES')} XP</span>
            <span className={styles.block}>
              <span className={styles.number}>{place}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default RankingPodium
