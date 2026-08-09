import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LeaderboardEntry } from '../data/gamificationLeaderboard'
import GamificationRankingStripCard from './GamificationRankingStripCard'
import styles from './RankingStripList.module.css'

interface RankingStripListProps {
  entries: LeaderboardEntry[]
  userRank: number
  sectionTitle?: string
  sectionMeta?: string
  sectionActions?: ReactNode
  toolbar?: ReactNode
  hideSectionHead?: boolean
  floatFromRank?: number
  showChaseCopy?: boolean
  listClassName?: string
  onEntryAnchorRef?: (entryKey: string, node: HTMLDivElement | null) => void
  activeEntryKey?: string | null
  onFriendEntryClick?: (entry: LeaderboardEntry) => void
  isEntryFavorite?: (entry: LeaderboardEntry) => boolean
  renderEntryActions?: (entry: LeaderboardEntry) => ReactNode
}

function entryKey(entry: LeaderboardEntry): string {
  if (entry.isYou) {
    return '__you__'
  }
  return entry.id ?? entry.displayName
}

function RankingStripList({
  entries,
  userRank,
  sectionTitle = 'Clasificación',
  sectionMeta = 'Ordenado por XP',
  sectionActions,
  toolbar,
  hideSectionHead = false,
  floatFromRank = 6,
  showChaseCopy = true,
  listClassName = '',
  onEntryAnchorRef,
  activeEntryKey = null,
  onFriendEntryClick,
  isEntryFavorite,
  renderEntryActions,
}: RankingStripListProps) {
  const userEntry = entries.find((entry) => entry.isYou)
  const userRowRef = useRef<HTMLDivElement | null>(null)
  const userVisibleRef = useRef(true)
  const floatRafRef = useRef<number | null>(null)
  const [showFloatingSelf, setShowFloatingSelf] = useState(false)

  const canFloat = Boolean(userEntry && userRank >= floatFromRank)
  const chaseTarget = entries.find((entry) => entry.rank === userRank - 1)

  useEffect(() => {
    const node = userRowRef.current
    if (!node || !canFloat) {
      setShowFloatingSelf(false)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = (entry?.intersectionRatio ?? 0) > 0.08
        if (userVisibleRef.current === visible) {
          return
        }

        userVisibleRef.current = visible

        if (floatRafRef.current != null) {
          cancelAnimationFrame(floatRafRef.current)
        }

        floatRafRef.current = requestAnimationFrame(() => {
          setShowFloatingSelf(!visible)
          floatRafRef.current = null
        })
      },
      {
        root: null,
        threshold: [0, 0.08, 0.25],
        rootMargin: '0px',
      },
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
      if (floatRafRef.current != null) {
        cancelAnimationFrame(floatRafRef.current)
      }
    }
  }, [canFloat, entries, userRank])

  const scrollToUser = () => {
    userRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const setEntryRef = (entry: LeaderboardEntry, node: HTMLDivElement | null) => {
    const key = entryKey(entry)
    if (entry.isYou) {
      userRowRef.current = node
    }
    onEntryAnchorRef?.(key, node)
  }

  return (
    <>
    <section
      className={`${styles.section} ${listClassName}`}
      aria-label={sectionTitle}
    >
      {!hideSectionHead && (
        <div className={styles.sectionHead}>
          <h2>{sectionTitle}</h2>
          {sectionActions ? (
            <div className={styles.sectionActions}>{sectionActions}</div>
          ) : sectionMeta ? (
            <span>{sectionMeta}</span>
          ) : null}
        </div>
      )}

      {toolbar}

      <div className={styles.list}>
        {entries.map((entry) => {
          const key = entryKey(entry)
          const isInteractive = Boolean(!entry.isYou && entry.id && onFriendEntryClick)
          const isActive = activeEntryKey === key || activeEntryKey === entry.id
          const showFavoriteGlow = isEntryFavorite?.(entry) ?? false

          return (
            <div
              key={`${entry.displayName}-${entry.rank}-${entry.isYou ? 'you' : 'peer'}`}
              ref={(node) => setEntryRef(entry, node)}
              className={`${entry.isYou ? styles.userRowWrap : styles.rowWrap} ${isActive ? styles.rowWrapActive : ''}`}
            >
              {isInteractive ? (
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => onFriendEntryClick?.(entry)}
                  aria-expanded={isActive}
                  aria-label={`${entry.displayName}, puesto ${entry.rank}`}
                >
                  <GamificationRankingStripCard
                    level={entry.level}
                    levelTitle={entry.levelTitle}
                    displayName={entry.displayName}
                    photoUrl={entry.photoUrl}
                    xp={entry.xp}
                    rank={entry.rank}
                    levelProgress={entry.levelProgress}
                    highlight={showFavoriteGlow || isActive}
                  />
                </button>
              ) : (
                <GamificationRankingStripCard
                  level={entry.level}
                  levelTitle={entry.levelTitle}
                  displayName={entry.isYou ? 'Tú' : entry.displayName}
                  photoUrl={entry.photoUrl}
                  xp={entry.xp}
                  rank={entry.rank}
                  levelProgress={entry.levelProgress}
                  highlight={entry.isYou}
                  className={entry.isYou ? styles.userCard : undefined}
                />
              )}

              {isActive && renderEntryActions ? renderEntryActions(entry) : null}
            </div>
          )
        })}
      </div>

      {showChaseCopy && userEntry && chaseTarget && userRank > 1 && (
        <p className={styles.chaseCopy}>
          Te faltan{' '}
          <strong>{(chaseTarget.xp - userEntry.xp).toLocaleString('es-ES')} XP</strong> para
          superar a {chaseTarget.displayName} (#{chaseTarget.rank}).
        </p>
      )}

    </section>

      {canFloat && userEntry && (
        <button
          type="button"
          className={`${styles.floatSelf} ${showFloatingSelf ? '' : styles.floatSelfHidden}`}
          onClick={scrollToUser}
          aria-hidden={!showFloatingSelf}
          tabIndex={showFloatingSelf ? 0 : -1}
          aria-label={`Ir a tu posición, #${userRank}`}
        >
          <span className={styles.floatLabel}>Tu puesto · #{userRank}</span>
          <GamificationRankingStripCard
            level={userEntry.level}
            levelTitle={userEntry.levelTitle}
            displayName="Tú"
            photoUrl={userEntry.photoUrl}
            xp={userEntry.xp}
            rank={userRank}
            levelProgress={userEntry.levelProgress}
            highlight
            className={styles.userCard}
          />
        </button>
      )}
    </>
  )
}

export default RankingStripList
