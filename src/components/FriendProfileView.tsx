import { useMemo, type CSSProperties } from 'react'
import { getGamificationLevelTitle } from '../data/gamificationLevels'
import { getAchievementBadgeArt } from '../data/achievementBadgeArt'
import { MEDAL_TIER_BY_DIFFICULTY } from '../data/achievementMedal'
import { getFriendEarnedAchievements } from '../utils/friendAchievementProgress'
import { getLevelProfileBodyTheme } from '../utils/levelProfileBodyThemes'
import { getLevelRankingStripTheme } from '../utils/levelRankingStripThemes'
import { getStripBackground } from '../utils/levelRankingStripAssets'
import { useCustomerGamificationContext } from '../context/CustomerGamificationContext'
import type { FriendProfile } from '../types/friends'
import AchievementMedal from './AchievementMedal'
import LevelPlayerCard from './LevelPlayerCard'
import styles from './FriendProfileView.module.css'

interface FriendProfileViewProps {
  friend: FriendProfile
  onBack: () => void
}

const TIER_ORDER = { legend: 0, gold: 1, silver: 2, bronze: 3 } as const

function DuelRow({ label, mine, theirs }: { label: string; mine: number; theirs: number }) {
  const total = Math.max(1, mine + theirs)
  const minePercent = (mine / total) * 100
  const winner = mine === theirs ? 'tie' : mine > theirs ? 'me' : 'them'
  return (
    <div className={styles.duelRow}>
      <span className={`${styles.duelValue} ${winner === 'me' ? styles.duelWin : ''}`}>{mine.toLocaleString('es-ES')}</span>
      <span className={styles.duelMiddle}>
        <span className={styles.duelLabel}>{label}</span>
        <span className={styles.duelBar} aria-hidden="true">
          <span className={styles.duelMine} style={{ width: `${minePercent}%` }} />
          <span className={styles.duelTheirs} style={{ width: `${100 - minePercent}%` }} />
        </span>
      </span>
      <span className={`${styles.duelValue} ${styles.duelRight} ${winner === 'them' ? styles.duelWin : ''}`}>{theirs.toLocaleString('es-ES')}</span>
    </div>
  )
}

/**
 * Perfil de un amigo con la estética de SU nivel (las 12 tarjetas: cocina casera,
 * explorador, barrio, crítico, cazador de promos, sibarita… deidad): marco con la
 * sala de su nivel, laurel y aro de su color, su escudo, «NIVEL N · rango» y XP.
 * Debajo, el duelo contigo y sus medallas reales.
 */
function FriendProfileView({ friend, onBack }: FriendProfileViewProps) {
  const gamification = useCustomerGamificationContext()
  const level = Math.min(12, Math.max(1, friend.level))
  const strip = getLevelRankingStripTheme(level)
  const body = getLevelProfileBodyTheme(level)
  const levelTitle = friend.levelTitle || getGamificationLevelTitle(level)
  const locationLabel = [friend.homeCity, friend.homeCountry].filter(Boolean).join(' · ')
  const firstName = friend.displayName.split(' ')[0] || friend.displayName

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

  const vars = {
    '--lv-overlay': strip.overlay,
    '--lv-border': strip.cardBorder,
    '--lv-ring': strip.avatarBorder,
    '--lv-name': strip.nameColor,
    '--lv-title': strip.titleColor,
    '--lv-name-shadow': strip.nameShadow,
    '--lv-fill': strip.xpFill,
    '--lv-track': strip.xpTrack,
    '--lv-pill-number-bg': body.pillNumberBg,
    '--lv-pill-number-color': body.pillNumberColor,
    '--lv-pill-title-bg': body.pillTitleBg,
    '--lv-pill-title-color': body.pillTitleColor,
    '--lv-bg': `url(${getStripBackground(level)})`,
  } as CSSProperties

  return (
    <article className={styles.page} style={vars}>
      <div className={styles.pageBg} aria-hidden="true" />

      <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Volver a amigos">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <LevelPlayerCard
        level={level}
        levelTitle={levelTitle}
        displayName={friend.displayName}
        username={friend.username}
        photoUrl={friend.photoUrl}
        xp={friend.xp}
        levelProgress={friend.levelProgress}
        location={locationLabel || undefined}
      />

      <section className={styles.panel} aria-label={`Tú contra ${firstName}`}>
        <div className={styles.duelHead}>
          <span>Tú</span>
          <strong>VS</strong>
          <span>{firstName}</span>
        </div>
        <p className={`${styles.duelVerdict} ${xpGap >= 0 ? styles.verdictWin : styles.verdictLose}`}>
          {xpGap === 0
            ? 'Empatados en XP. ¡La próxima reserva desempata!'
            : xpGap > 0
              ? `Le sacas ${xpGap.toLocaleString('es-ES')} XP. Que no te alcance.`
              : `Te saca ${Math.abs(xpGap).toLocaleString('es-ES')} XP. ¡Reserva y alcánzale!`}
        </p>
        <DuelRow label="XP" mine={myXp} theirs={friend.xp} />
        <DuelRow label="Medallas" mine={myMedals} theirs={medals.length} />
        <DuelRow label="Locales probados" mine={myVenues} theirs={friend.reservationsTotal} />
      </section>

      <section className={styles.stats}>
        <div>
          <span aria-hidden="true">🏅</span>
          <strong>{medals.length}</strong>
          <small>Medallas</small>
        </div>
        <div>
          <span aria-hidden="true">🍽️</span>
          <strong>{friend.reservationsTotal}</strong>
          <small>Locales</small>
        </div>
        <div>
          <span aria-hidden="true">🎯</span>
          <strong>{friend.missionsCompleted}</strong>
          <small>Logros</small>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Vitrina de medallas</h2>
          <span>{medals.length}</span>
        </div>
        {medals.length === 0 ? (
          <p className={styles.empty}>{firstName} aún no tiene medallas. ¡Gánale tú la primera!</p>
        ) : (
          <ul className={styles.medals}>
            {medals.map(({ item, art }) => (
              <li key={item.mission.id} className={styles.medal} title={item.mission.description}>
                <AchievementMedal missionId={item.mission.id} art={art} earned size={60} />
                <span>{item.mission.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {friend.foodPreferences.length > 0 ? (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Le encanta</h2>
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
