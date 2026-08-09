import { useMemo, useState } from 'react'
import type { LeaderboardEntry, RankingScope } from '../data/gamificationLeaderboard'
import RankingStripList from './RankingStripList'
import styles from './CustomerRankingsBoard.module.css'

interface CustomerRankingsBoardProps {
  countryEntries: LeaderboardEntry[]
  worldEntries: LeaderboardEntry[]
  countryRank: number
  worldRank: number
  userCountry: string
}

type RankingTab = RankingScope

function CustomerRankingsBoard({
  countryEntries,
  worldEntries,
  countryRank,
  worldRank,
  userCountry,
}: CustomerRankingsBoardProps) {
  const [tab, setTab] = useState<RankingTab>('country')

  const entries = tab === 'country' ? countryEntries : worldEntries
  const userRank = tab === 'country' ? countryRank : worldRank

  const tabLabel = useMemo(
    () => (tab === 'country' ? userCountry || 'Tu país' : 'Mundial'),
    [tab, userCountry],
  )

  return (
    <div className={styles.board}>
      <div className={styles.scopeTabs} role="tablist" aria-label="Alcance del ranking">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'country'}
          className={tab === 'country' ? styles.scopeTabActive : styles.scopeTab}
          onClick={() => setTab('country')}
        >
          País
          <span>{userCountry || '—'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'world'}
          className={tab === 'world' ? styles.scopeTabActive : styles.scopeTab}
          onClick={() => setTab('world')}
        >
          Mundial
          <span>Global</span>
        </button>
      </div>

      <p className={styles.scopeHint}>
        {tab === 'country'
          ? `Ranking de foodies en ${userCountry || 'tu país'}.`
          : 'Ranking mundial ordenado por XP total.'}
      </p>

      <RankingStripList
        key={tab}
        entries={entries}
        userRank={userRank}
        sectionTitle={`Top ${tab === 'country' ? 'nacional' : 'mundial'}`}
        sectionMeta={`${tabLabel} · XP`}
        showChaseCopy
      />
    </div>
  )
}

export default CustomerRankingsBoard
