import type { LeaderboardEntry } from '../data/gamificationLeaderboard'
import GamificationRankingStripCard from './GamificationRankingStripCard'
import styles from './CustomerRankingBoard.module.css'

interface CustomerRankingBoardProps {
  entries: LeaderboardEntry[]
  userRank?: number
}

function CustomerRankingBoard({ entries, userRank }: CustomerRankingBoardProps) {
  const userEntry = entries.find((entry) => entry.isYou)
  const leaders = entries.filter((entry) => !entry.isYou)
  const chaseTarget = entries.find((entry) => entry.rank === (userRank ?? 0) - 1)

  return (
    <div className={styles.board}>
      {userEntry && (
        <section className={styles.selfSection} aria-label="Tu posición en el ranking">
          <div className={styles.sectionHead}>
            <h2>Tu posición</h2>
            <span>#{userRank}</span>
          </div>
          <GamificationRankingStripCard
            level={userEntry.level}
            levelTitle={userEntry.levelTitle}
            displayName="Tú"
            photoUrl={userEntry.photoUrl}
            xp={userEntry.xp}
            rank={userRank}
            levelProgress={userEntry.levelProgress}
            highlight
          />
        </section>
      )}

      <section className={styles.listSection} aria-label="Top de la tabla">
        <div className={styles.sectionHead}>
          <h2>Top de la tabla</h2>
          <span>Ordenado por XP</span>
        </div>

        <div className={styles.list}>
          {leaders.map((entry) => (
            <GamificationRankingStripCard
              key={`${entry.displayName}-${entry.rank}`}
              level={entry.level}
              levelTitle={entry.levelTitle}
              displayName={entry.isYou ? 'Tú' : entry.displayName}
              photoUrl={entry.photoUrl}
              xp={entry.xp}
              rank={entry.rank}
              levelProgress={entry.levelProgress}
              highlight={entry.isYou}
            />
          ))}
        </div>
      </section>

      {userEntry && chaseTarget && userRank && userRank > 1 && (
        <p className={styles.chaseCopy}>
          Te faltan{' '}
          <strong>{(chaseTarget.xp - userEntry.xp).toLocaleString('es-ES')} XP</strong> para
          superar a {chaseTarget.displayName} (#{chaseTarget.rank})
        </p>
      )}
    </div>
  )
}

export default CustomerRankingBoard
