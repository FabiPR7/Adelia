import type { LeaderboardEntry } from '../data/gamificationLeaderboard'
import styles from './GamificationRankingPodium.module.css'

interface GamificationRankingPodiumProps {
  entries: LeaderboardEntry[]
  userRank?: number
  rankJustImproved?: boolean
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function PodiumSlot({
  entry,
  place,
  rankJustImproved = false,
}: {
  entry: LeaderboardEntry | undefined
  place: 1 | 2 | 3
  rankJustImproved?: boolean
}) {
  if (!entry) {
    return null
  }

  return (
    <article
      className={`${styles.podiumSlot} ${styles[`place${place}`]} ${entry.isYou ? styles.isYou : ''} ${entry.isYou && rankJustImproved ? styles.rankSurge : ''}`}
    >
      {place === 1 && <span className={styles.crown} aria-hidden="true">👑</span>}
      <div className={styles.avatarRing}>
        <span className={styles.avatar}>{initials(entry.displayName)}</span>
      </div>
      <p className={styles.podiumName}>{entry.isYou ? 'Tú' : entry.displayName}</p>
      <p className={styles.podiumXp}>{entry.xp.toLocaleString('es-ES')} XP</p>
      <div className={styles.podiumBlock} aria-hidden="true">
        <span className={styles.podiumRank}>{place}</span>
      </div>
    </article>
  )
}

function GamificationRankingPodium({
  entries,
  userRank,
  rankJustImproved = false,
}: GamificationRankingPodiumProps) {
  const topThree = [entries[1], entries[0], entries[2]]
  const rest = entries.slice(3)

  return (
    <div className={styles.wrap}>
      <div className={styles.podiumStage}>
        <PodiumSlot entry={topThree[0]} place={2} rankJustImproved={rankJustImproved} />
        <PodiumSlot entry={topThree[1]} place={1} rankJustImproved={rankJustImproved} />
        <PodiumSlot entry={topThree[2]} place={3} rankJustImproved={rankJustImproved} />
      </div>

      <ul className={styles.list}>
        {rest.map((entry) => (
          <li
            key={`${entry.displayName}-${entry.rank}`}
            className={`${styles.row} ${entry.isYou ? styles.rowYou : ''} ${entry.isYou && rankJustImproved ? styles.rowSurge : ''}`}
          >
            <span className={styles.rowRank}>#{entry.rank}</span>
            <span className={styles.rowAvatar}>{initials(entry.displayName)}</span>
            <div className={styles.rowBody}>
              <strong>{entry.isYou ? 'Tu posición' : entry.displayName}</strong>
              <span>{entry.levelTitle}</span>
            </div>
            <div className={styles.rowMeta}>
              <strong>{entry.xp.toLocaleString('es-ES')}</strong>
              <span>XP</span>
            </div>
          </li>
        ))}
      </ul>

      {userRank && userRank > 6 && (
        <p className={styles.chaseCopy}>
          Te faltan reservas para entrar al Top 5. ¡Una misión más y subes!
        </p>
      )}
    </div>
  )
}

export default GamificationRankingPodium
