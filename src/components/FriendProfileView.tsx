import { useMemo, type CSSProperties } from 'react'
import { getGamificationLevelTitle } from '../data/gamificationLevels'
import { getAchievementBadgeArt } from '../data/achievementBadgeArt'
import { MEDAL_PALETTES, MEDAL_TIER_BY_DIFFICULTY, levelMedalTier } from '../data/achievementMedal'
import { getFriendEarnedAchievements } from '../utils/friendAchievementProgress'
import { useCustomerGamificationContext } from '../context/CustomerGamificationContext'
import type { FriendProfile } from '../types/friends'
import AchievementMedal from './AchievementMedal'
import LevelEmblem from './LevelEmblem'
import styles from './FriendProfileView.module.css'

interface FriendProfileViewProps {
  friend: FriendProfile
  onBack: () => void
}

const TIER_ORDER = { legend: 0, gold: 1, silver: 2, bronze: 3 } as const

function DuelRow({ label, mine, theirs, format = (value: number) => value.toLocaleString('es-ES') }: {
  label: string
  mine: number
  theirs: number
  format?: (value: number) => string
}) {
  const total = Math.max(1, mine + theirs)
  const minePercent = (mine / total) * 100
  const winner = mine === theirs ? 'tie' : mine > theirs ? 'me' : 'them'
  return (
    <div className={styles.duelRow}>
      <span className={`${styles.duelValue} ${winner === 'me' ? styles.duelWin : ''}`}>{format(mine)}</span>
      <span className={styles.duelMiddle}>
        <span className={styles.duelLabel}>{label}</span>
        <span className={styles.duelBar} aria-hidden="true">
          <span className={styles.duelMine} style={{ width: `${minePercent}%` }} />
          <span className={styles.duelTheirs} style={{ width: `${100 - minePercent}%` }} />
        </span>
      </span>
      <span className={`${styles.duelValue} ${styles.duelRight} ${winner === 'them' ? styles.duelWin : ''}`}>{format(theirs)}</span>
    </div>
  )
}

/**
 * Perfil de un amigo como carta de jugador: foto con aro del metal de su nivel,
 * emblema, duelo «tú vs él» con datos reales y sus medallas conseguidas.
 */
function FriendProfileView({ friend, onBack }: FriendProfileViewProps) {
  const gamification = useCustomerGamificationContext()
  const level = Math.max(1, friend.level)
  const tier = levelMedalTier(level)
  const palette = MEDAL_PALETTES[tier]
  const levelTitle = friend.levelTitle || getGamificationLevelTitle(level)
  const locationLabel = [friend.homeCity, friend.homeCountry].filter(Boolean).join(' · ')
  const progressPercent = Math.round(friend.levelProgress * 100)

  const medals = useMemo(
    () => getFriendEarnedAchievements(friend)
      .map((item) => ({ item, art: getAchievementBadgeArt(item.mission.id, item.mission) }))
      .sort((left, right) => TIER_ORDER[MEDAL_TIER_BY_DIFFICULTY[left.art.difficulty]] - TIER_ORDER[MEDAL_TIER_BY_DIFFICULTY[right.art.difficulty]]),
    [friend],
  )

  const myXp = gamification.state.xp
  const myMedals = gamification.historicalProgress.filter((item) => item.completed).length
  const myVenues = gamification.state.visitedCompanyIds?.length ?? 0
  const xpGap = myXp - friend.xp
  const firstName = friend.displayName.split(' ')[0] || friend.displayName

  const vars = {
    '--card-rim-a': palette.rim[0],
    '--card-rim-b': palette.rim[1],
    '--card-rim-c': palette.rim[2],
    '--card-glow': palette.glow,
  } as CSSProperties

  return (
    <article className={`${styles.page} ${styles[`tier_${tier}`]}`} style={vars}>
      <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Volver a amigos">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <header className={styles.hero}>
        <span className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.avatarStage}>
          <span className={styles.avatarRing}>
            {friend.photoUrl ? (
              <img src={friend.photoUrl} alt="" className={styles.avatar} />
            ) : (
              <span className={styles.avatarFallback}>{friend.displayName.charAt(0).toUpperCase()}</span>
            )}
          </span>
          <span className={styles.emblem}>
            <LevelEmblem level={level} size={64} />
          </span>
        </div>
        <h1 className={styles.name}>{friend.displayName}</h1>
        {friend.username ? <p className={styles.username}>@{friend.username}</p> : null}
        <p className={styles.levelTitle}>{levelTitle}</p>
        {locationLabel ? <p className={styles.location}>📍 {locationLabel}</p> : null}

        <div className={styles.xpBlock}>
          <div className={styles.xpTop}>
            <strong>{friend.xp.toLocaleString('es-ES')} XP</strong>
            <span>{progressPercent}% al nivel {level + 1}</span>
          </div>
          <span className={styles.xpTrack} aria-hidden="true">
            <span className={styles.xpFill} style={{ width: `${Math.max(4, progressPercent)}%` }} />
          </span>
        </div>
      </header>

      <section className={styles.duel} aria-label={`Tú contra ${firstName}`}>
        <div className={styles.duelHead}>
          <span>Tú</span>
          <strong>VS</strong>
          <span>{firstName}</span>
        </div>
        <p className={`${styles.duelVerdict} ${xpGap >= 0 ? styles.verdictWin : styles.verdictLose}`}>
          {xpGap === 0
            ? 'Empate técnico en XP. ¡Desempata!'
            : xpGap > 0
              ? `Le sacas ${xpGap.toLocaleString('es-ES')} XP. Que no te alcance.`
              : `Te saca ${Math.abs(xpGap).toLocaleString('es-ES')} XP. ¡A por él!`}
        </p>
        <DuelRow label="XP" mine={myXp} theirs={friend.xp} />
        <DuelRow label="Medallas" mine={myMedals} theirs={medals.length} />
        <DuelRow label="Locales" mine={myVenues} theirs={friend.reservationsTotal} />
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2>Medallas</h2>
          <span>{medals.length} conseguidas</span>
        </div>
        {medals.length === 0 ? (
          <p className={styles.empty}>{firstName} aún no tiene medallas. ¡Gánale tú la primera!</p>
        ) : (
          <ul className={styles.medals}>
            {medals.map(({ item, art }) => (
              <li key={item.mission.id} className={styles.medal} title={item.mission.description}>
                <AchievementMedal missionId={item.mission.id} art={art} earned size={62} />
                <span>{item.mission.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.stats}>
        <div>
          <strong>{friend.missionsCompleted}</strong>
          <span>Logros</span>
        </div>
        <div>
          <strong>{friend.reservationsTotal}</strong>
          <span>Locales</span>
        </div>
        <div>
          <strong>{friend.streak}</strong>
          <span>Retos esta semana</span>
        </div>
      </section>

      {friend.foodPreferences.length > 0 ? (
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2>Le gusta</h2>
          </div>
          <ul className={styles.chips}>
            {friend.foodPreferences.map((preference) => (
              <li key={preference}>{preference}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  )
}

export default FriendProfileView
