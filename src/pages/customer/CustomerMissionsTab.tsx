import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import GamificationCelebrationToast from '../../components/GamificationCelebrationToast'
import AchievementBadgeCard from '../../components/AchievementBadgeCard'
import MissionIcon from '../../components/MissionIcon'
import { useAuth } from '../../context/AuthContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import { useGamificationCelebrations } from '../../hooks/useGamificationCelebrations'
import CompiteHub from '../../components/CompiteHub'
import { useCustomerFriends } from '../../hooks/useCustomerFriends'
import { buildLeaderboardWithUser, getUserRank } from '../../data/gamificationLeaderboard'
import { GAMIFICATION_LEVELS } from '../../data/gamificationLevels'
import type { MissionProgress } from '../../types/gamification'
import { CONFIRMED_RESERVATION_XP, WEEKLY_BONUS_TARGET } from '../../types/gamification'
import styles from './CustomerMissionsTab.module.css'

type MissionSection = 'weekly' | 'monthly' | 'historical'
type ArenaView = 'missions' | 'compite'

function MissionCard({
  item,
  weeklyFeaturedCategory,
}: {
  item: MissionProgress
  weeklyFeaturedCategory?: string
}) {
  const percent = Math.round(item.progress * 100)
  const description = item.mission.id === 'ruta_especialidades' && weeklyFeaturedCategory
    ? `Reserva en un local de ${weeklyFeaturedCategory}`
    : item.mission.description

  return (
    <article className={`${styles.missionCard} ${item.completed ? styles.missionDone : ''}`}>
      <div className={styles.missionGlow} aria-hidden="true" />
      <div className={styles.missionIconWrap}>
        <MissionIcon mission={item.mission} size="lg" />
      </div>
      <div className={styles.missionBody}>
        <div className={styles.missionTop}>
          <h3>{item.mission.name}</h3>
          <span className={styles.missionXp}>+{item.mission.xp} XP</span>
        </div>
        <p>{description}</p>
        {!item.completed ? (
          <div className={styles.missionProgressWrap}>
            <div className={styles.missionProgressTrack}>
              <div className={styles.missionProgressFill} style={{ width: `${percent}%` }} />
            </div>
            <span>
              {item.mission.target > 1
                ? `${item.current}/${item.mission.target}`
                : `${percent}%`}
            </span>
          </div>
        ) : (
          <span className={styles.missionCompleteTag}>✓ Completada</span>
        )}
      </div>
    </article>
  )
}

function CustomerMissionsTab() {
  const { user, profile } = useAuth()
  const gamification = useCustomerGamificationContext()
  const [section, setSection] = useState<MissionSection>('weekly')
  const [arenaView, setArenaView] = useState<ArenaView>('missions')
  const [friendProfileActive, setFriendProfileActive] = useState(false)

  const celebrations = useGamificationCelebrations({
    userId: user?.uid,
    userName: profile?.displayName ?? '',
    xp: gamification.state.xp,
    level: gamification.level.level,
    levelTitle: gamification.level.title,
    enabled: Boolean(user && profile),
  })

  const progressPercent = Math.round(gamification.levelProgress * 100)
  const nextLevel = GAMIFICATION_LEVELS.find((level) => level.level === gamification.level.level + 1)

  const activeMissions = useMemo(() => {
    if (section === 'weekly') {
      return gamification.weeklyProgress
    }

    if (section === 'monthly') {
      return gamification.monthlyProgress
    }

    return gamification.historicalProgress
  }, [section, gamification.historicalProgress, gamification.monthlyProgress, gamification.weeklyProgress])

  const completedMissions =
    gamification.weeklyProgress.filter((item) => item.completed).length
    + gamification.monthlyProgress.filter((item) => item.completed).length
    + gamification.historicalProgress.filter((item) => item.completed).length

  const userCountry = profile?.homeCountry || 'España'
  const reservationsTotal = gamification.reservations.filter(
    (reservation) => reservation.status === 'confirmed',
  ).length
  const verifiedVisitsHint = `+${CONFIRMED_RESERVATION_XP} XP por cada reserva confirmada en el restaurante`

  const leaderboardOptions = useMemo(
    () => ({
      photoUrl: profile?.photoUrl || undefined,
      missionsCompleted: completedMissions,
      levelProgress: gamification.levelProgress,
      homeCountry: userCountry,
      homeCity: profile?.homeCity || undefined,
      reservationsTotal,
      foodPreferences: profile?.foodPreferences ?? [],
      limit: 13,
    }),
    [
      profile?.photoUrl,
      profile?.homeCity,
      profile?.foodPreferences,
      completedMissions,
      gamification.levelProgress,
      userCountry,
      reservationsTotal,
    ],
  )

  const countryLeaderboard = useMemo(
    () =>
      buildLeaderboardWithUser(
        profile?.displayName ?? '',
        gamification.state.xp,
        gamification.level.level,
        gamification.level.title,
        { ...leaderboardOptions, scope: 'country' },
      ),
    [
      profile?.displayName,
      gamification.state.xp,
      gamification.level.level,
      gamification.level.title,
      leaderboardOptions,
    ],
  )

  const worldLeaderboard = useMemo(
    () =>
      buildLeaderboardWithUser(
        profile?.displayName ?? '',
        gamification.state.xp,
        gamification.level.level,
        gamification.level.title,
        { ...leaderboardOptions, scope: 'world' },
      ),
    [
      profile?.displayName,
      gamification.state.xp,
      gamification.level.level,
      gamification.level.title,
      leaderboardOptions,
    ],
  )

  const userEntry = useMemo(
    () => countryLeaderboard.find((entry) => entry.isYou) ?? worldLeaderboard.find((entry) => entry.isYou)!,
    [countryLeaderboard, worldLeaderboard],
  )

  const countryRank = useMemo(
    () =>
      getUserRank(
        profile?.displayName ?? '',
        gamification.state.xp,
        gamification.level.level,
        gamification.level.title,
        { ...leaderboardOptions, scope: 'country' },
      ),
    [
      profile?.displayName,
      gamification.state.xp,
      gamification.level.level,
      gamification.level.title,
      leaderboardOptions,
    ],
  )

  const worldRank = useMemo(
    () =>
      getUserRank(
        profile?.displayName ?? '',
        gamification.state.xp,
        gamification.level.level,
        gamification.level.title,
        { ...leaderboardOptions, scope: 'world' },
      ),
    [
      profile?.displayName,
      gamification.state.xp,
      gamification.level.level,
      gamification.level.title,
      leaderboardOptions,
    ],
  )

  const friends = useCustomerFriends(user?.uid)
  const userRankAmongFriends = friends.getFriendRankAmongFriends(gamification.state.xp)

  if (gamification.loading) {
    return <div className={styles.loading}>Cargando misiones…</div>
  }

  return (
    <div className={styles.page}>
      {!friendProfileActive && (
      <header
        className={styles.hero}
        style={{
          background: `linear-gradient(145deg, #120c18 0%, #2a1238 38%, ${gamification.level.colors[0]} 140%)`,
        }}
      >
        <div className={styles.heroStars} aria-hidden="true" />
        <div className={styles.heroOrb} aria-hidden="true" />

        <p className={styles.eyebrow}>Arena de misiones</p>
        <h1>Sube de nivel</h1>
        <p className={styles.lead}>
          Reserva, explora y completa retos verificados para ganar XP y subir de nivel.
        </p>
        <p className={styles.xpHint}>{verifiedVisitsHint}</p>

        <div className={styles.levelPanel}>
          <div className={styles.levelBadge}>Nv. {gamification.level.level}</div>
          <div className={styles.levelCopy}>
            <strong>{gamification.level.title}</strong>
            <span>
              {gamification.xpToNext === null
                ? 'Has alcanzado el rango máximo'
                : `${gamification.xpToNext.toLocaleString('es-ES')} XP para ${nextLevel?.title ?? 'siguiente nivel'}`}
            </span>
          </div>
        </div>

        <div className={styles.xpTrack}>
          <div className={styles.xpFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <p className={styles.xpMeta}>{progressPercent}% del siguiente nivel</p>

        <button
          type="button"
          className={styles.previewLevelButton}
          onClick={gamification.previewLevelUpCelebration}
        >
          Ver animación de subida de nivel
        </button>

        <div className={styles.heroStats}>
          <div>
            <span className={styles.statEmoji} aria-hidden="true">⚡</span>
            <strong>{gamification.state.xp.toLocaleString('es-ES')}</strong>
            <span>XP total</span>
          </div>
          <div>
            <span className={styles.statEmoji} aria-hidden="true">🏆</span>
            <strong>#{countryRank}</strong>
            <span>Compite</span>
          </div>
        </div>
      </header>
      )}

      {!friendProfileActive && (
      <div className={styles.arenaTabs} role="tablist" aria-label="Arena">
        <button
          type="button"
          role="tab"
          aria-selected={arenaView === 'missions'}
          className={arenaView === 'missions' ? styles.arenaTabActive : styles.arenaTab}
          onClick={() => setArenaView('missions')}
        >
          Misiones
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={arenaView === 'compite'}
          className={arenaView === 'compite' ? styles.arenaTabActive : styles.arenaTab}
          onClick={() => setArenaView('compite')}
        >
          Compite
          <span>#{countryRank}</span>
        </button>
      </div>
      )}

      {arenaView === 'compite' ? (
        <CompiteHub
          userEntry={userEntry}
          countryEntries={countryLeaderboard}
          worldEntries={worldLeaderboard}
          countryRank={countryRank}
          worldRank={worldRank}
          userCountry={userCountry}
          userRankAmongFriends={userRankAmongFriends}
          favoriteFriends={friends.favoriteFriends}
          regularFriends={friends.regularFriends}
          blockedSearchIds={friends.blockedSearchIds}
          incomingRequests={friends.incomingRequests}
          incomingRequestCount={friends.incomingRequestCount}
          onSendFriendRequest={friends.sendFriendRequest}
          onAcceptFriendRequest={friends.acceptFriendRequest}
          onRejectFriendRequest={friends.rejectFriendRequest}
          hasOutgoingRequest={friends.hasOutgoingRequest}
          onRemoveFriend={friends.removeFriend}
          onToggleFavorite={friends.toggleFavorite}
          isFavorite={friends.isFavorite}
          onFriendProfileActiveChange={setFriendProfileActive}
        />
      ) : (
        <>
      <section className={styles.bonusCard}>
        <div className={styles.bonusIcon} aria-hidden="true">🎁</div>
        <div>
          <h2>Bonus semanal</h2>
          <p>
            Completa {WEEKLY_BONUS_TARGET} misiones y gana +{gamification.weeklyBonus.bonusXp} XP extra.
          </p>
        </div>
        <div className={styles.bonusMeter}>
          <strong>{gamification.weeklyBonus.completedCount}/{WEEKLY_BONUS_TARGET}</strong>
          <span>{gamification.weeklyBonus.bonusEarned ? 'Desbloqueado' : 'En progreso'}</span>
        </div>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Tipo de misiones">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'weekly'}
          className={section === 'weekly' ? styles.tabActive : styles.tab}
          onClick={() => setSection('weekly')}
        >
          Semana
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'monthly'}
          className={section === 'monthly' ? styles.tabActive : styles.tab}
          onClick={() => setSection('monthly')}
        >
          Mes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'historical'}
          className={section === 'historical' ? styles.tabActive : styles.tab}
          onClick={() => setSection('historical')}
        >
          Logros
        </button>
      </div>

      <section className={styles.missionSection}>
        {section === 'historical' ? (
          <div className={styles.logrosArena}>
            <div className={styles.logrosArenaGlow} aria-hidden="true" />
            <div className={styles.logrosGrid}>
              {activeMissions.map((item) => {
                return (
                  <AchievementBadgeCard
                    key={item.mission.id}
                    item={item}
                    earned={item.completed}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className={styles.missionList}>
            {activeMissions.map((item) => (
              <MissionCard
                key={item.mission.id}
                item={item}
                weeklyFeaturedCategory={gamification.weeklyFeaturedCategory}
              />
            ))}
          </div>
        )}
      </section>

      <Link to="/app/explorar" className={styles.cta}>
        Reservar para avanzar misiones →
      </Link>
        </>
      )}

      <GamificationCelebrationToast
        event={celebrations.activeEvent}
        onDismiss={celebrations.dismissActive}
      />
    </div>
  )
}

export default CustomerMissionsTab
