import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import AchievementBadgeCard from '../../components/AchievementBadgeCard'
import MissionIcon from '../../components/MissionIcon'
import { useAuth } from '../../context/AuthContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import CompiteHub from '../../components/CompiteHub'
import InventoryHub from '../../components/InventoryHub'
import { useCustomerFriends } from '../../hooks/useCustomerFriends'
import { buildLeaderboardWithUser, getUserRank } from '../../data/gamificationLeaderboard'
import { GAMIFICATION_LEVELS } from '../../data/gamificationLevels'
import type { MissionProgress } from '../../types/gamification'
import { CONFIRMED_RESERVATION_XP, WEEKLY_BONUS_TARGET, WEEKLY_MISSION_BONUS_XP } from '../../types/gamification'
import {
  inventoryTotalCount,
  WEEKLY_MISSION_SLOT_COUNT,
  hasGrantedKey,
  resolveGrantItems,
  rewardsForMission,
  seasonPackGrantKey,
} from '../../data/inventoryItems'
import SeasonPackModal from '../../components/SeasonPackModal'
import InventoryItemCard from '../../components/InventoryItemCard'
import type { SeasonPackKind } from '../../data/inventoryItems'
import styles from './CustomerMissionsTab.module.css'

type MissionSection = 'weekly' | 'monthly' | 'historical'
type ArenaView = 'missions' | 'compite' | 'items'

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
  const prizes = resolveGrantItems(
    rewardsForMission(item.mission.id, item.mission.cadence, item.mission.xp),
  )

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
        {prizes.length > 0 ? (
          <div className={styles.missionPrizes}>
            {prizes.map(({ item: prize, quantity }) => (
              <div key={prize.id} className={styles.missionPrize}>
                <InventoryItemCard item={prize} quantity={quantity} mini />
                <span>{prize.shortName}{quantity > 1 ? ` ×${quantity}` : ''}</span>
              </div>
            ))}
          </div>
        ) : null}
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
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [claimingPack, setClaimingPack] = useState<SeasonPackKind | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

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
  const itemCount = inventoryTotalCount(gamification.state.inventory)
  const weeklyCompletedCount = gamification.weeklyBonus.completedCount
  const monthlyCompletedCount = gamification.monthlyProgress.filter((item) => item.completed).length
  const weeklyBonusClaimable = weeklyCompletedCount >= WEEKLY_BONUS_TARGET
    && !hasGrantedKey(
      gamification.state.grantedItemKeys,
      seasonPackGrantKey('weekly_bonus', gamification.state.weekKey, gamification.state.monthKey),
    )

  const handleClaimPack = async (pack: SeasonPackKind) => {
    setClaimingPack(pack)
    setClaimError(null)
    try {
      await gamification.claimSeasonPack(pack)
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : 'No se pudo reclamar.')
    } finally {
      setClaimingPack(null)
    }
  }
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
        <p className={styles.previewLevelHint}>
          Abre tu nivel actual. Dentro puedes pasar los 12 rangos con ‹ ›
        </p>

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
          aria-selected={arenaView === 'items'}
          className={arenaView === 'items' ? styles.arenaTabActive : styles.arenaTab}
          onClick={() => setArenaView('items')}
        >
          Ítems
          {itemCount > 0 ? <span>{itemCount}</span> : null}
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
      ) : arenaView === 'items' ? (
        <InventoryHub
          inventory={gamification.state.inventory}
          strikeCount={gamification.state.cancellationStrikeCount}
          promoLocked={gamification.state.promoLocked}
          onUseItem={gamification.useOwnedInventoryItem}
        />
      ) : (
        <>
      <button
        type="button"
        className={styles.bonusCard}
        onClick={() => {
          setClaimError(null)
          setSeasonOpen(true)
        }}
      >
        <div className={styles.bonusIcon} aria-hidden="true">🎁</div>
        <div>
          <h2>Bonus de temporada</h2>
          <p>
            Pulsa para ver las cartas de esta semana y este mes.
            Completa {WEEKLY_BONUS_TARGET} de {WEEKLY_MISSION_SLOT_COUNT} y suma +{WEEKLY_MISSION_BONUS_XP} XP;
            las cartas se reclaman aquí.
          </p>
        </div>
        <div className={styles.bonusMeter}>
          <strong>{weeklyCompletedCount}/{WEEKLY_BONUS_TARGET}</strong>
          <span>
            {weeklyBonusClaimable
              ? 'Reclamar'
              : gamification.weeklyBonus.bonusEarned
                ? 'Listo'
                : 'En progreso'}
          </span>
        </div>
      </button>

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
            <div className={styles.logrosArenaClip} aria-hidden="true">
              <div className={styles.logrosArenaGlow} />
            </div>
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
      <SeasonPackModal
        open={seasonOpen}
        weekKey={gamification.state.weekKey}
        monthKey={gamification.state.monthKey}
        weeklyCompleted={weeklyCompletedCount}
        monthlyCompleted={monthlyCompletedCount}
        grantedItemKeys={gamification.state.grantedItemKeys}
        claiming={claimingPack}
        error={claimError}
        onClose={() => setSeasonOpen(false)}
        onClaim={(pack) => void handleClaimPack(pack)}
      />
        </>
      )}
    </div>
  )
}

export default CustomerMissionsTab
