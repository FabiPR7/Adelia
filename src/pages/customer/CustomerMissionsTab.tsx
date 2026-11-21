import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import AchievementBadgeCard from '../../components/AchievementBadgeCard'
import { useAuth } from '../../context/AuthContext'
import CollectionProgress from '../../components/discovery/CollectionProgress'
import { useCustomerProductTourOptional } from '../../context/CustomerProductTourContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import CompiteHub from '../../components/CompiteHub'
import InventoryHub from '../../components/InventoryHub'
import { useCustomerFriends } from '../../hooks/useCustomerFriends'
import { fetchCustomerLeaderboard } from '../../services/firestore'
import { buildLeaderboardWithUser, getUserRank, leaderboardFromLiveRows } from '../../data/gamificationLeaderboard'
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
import { isAlmostDone, missionAction, remainingLabel } from '../../utils/missionNudges'
import { achievementGlyphFor } from '../../data/achievementGlyphs'
import { getLevelRankingStripTheme } from '../../utils/levelRankingStripThemes'
import styles from './CustomerMissionsTab.module.css'

/** Cuánto falta para que se renueven (semana: domingo a medianoche; mes: fin de mes). */
function resetLabel(cadence: 'weekly' | 'monthly', now = new Date()): string {
  const end = new Date(now)
  if (cadence === 'weekly') {
    end.setDate(end.getDate() + (7 - (end.getDay() || 7)) + 1)
  } else {
    end.setMonth(end.getMonth() + 1, 1)
  }
  end.setHours(0, 0, 0, 0)
  const minutes = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  return days > 0 ? `${days} d ${hours} h` : `${hours} h ${minutes % 60} min`
}

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
    <article className={`${styles.missionCard} ${item.completed ? styles.missionDone : ''} ${isAlmostDone(item) ? styles.missionHot : ''}`}>
      <div className={styles.missionGlow} aria-hidden="true" />
      <span className={styles.ticketEdge} aria-hidden="true" />
      <div className={styles.missionIconWrap}>
        <svg className={styles.missionRing} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="29" className={styles.missionRingTrack} />
          <circle
            cx="32"
            cy="32"
            r="29"
            className={styles.missionRingFill}
            strokeDasharray={`${2 * Math.PI * 29} ${2 * Math.PI * 29}`}
            strokeDashoffset={2 * Math.PI * 29 * (1 - (item.completed ? 1 : item.progress))}
          />
        </svg>
        <svg className={styles.missionGlyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {achievementGlyphFor(item.mission.id, item.mission.category).map(([tag, attrs], index) => {
            const Tag = tag
            return <Tag key={index} {...attrs} />
          })}
        </svg>
      </div>
      {item.completed ? <span className={styles.servedStamp} aria-hidden="true">¡Servido!</span> : null}
      {!item.completed && isAlmostDone(item) ? <span className={styles.hotRibbon} aria-hidden="true">¡Casi!</span> : null}
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
          <div className={styles.missionNext}>
            <span className={styles.missionLeft}>{isAlmostDone(item) ? `Casi: ${remainingLabel(item).toLowerCase()}` : remainingLabel(item)}</span>
            <Link to={missionAction(item.mission).to} className={styles.missionAction}>
              {missionAction(item.mission).label}
              <span aria-hidden="true">→</span>
            </Link>
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
  const productTour = useCustomerProductTourOptional()
  const gamification = useCustomerGamificationContext()
  const [section, setSection] = useState<MissionSection>('weekly')
  // Los avisos de amigos llevan a ?ver=amigos o ?ver=solicitudes.
  const [searchParams] = useSearchParams()
  const linkedView = searchParams.get('ver')
  const [arenaView, setArenaView] = useState<ArenaView>(
    linkedView === 'amigos' || linkedView === 'solicitudes' ? 'compite' : linkedView === 'items' ? 'items' : 'missions',
  )
  const [friendProfileActive, setFriendProfileActive] = useState(false)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [claimingPack, setClaimingPack] = useState<SeasonPackKind | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [liveCountryLeaderboard, setLiveCountryLeaderboard] = useState<ReturnType<typeof leaderboardFromLiveRows> | null>(null)
  const [liveWorldLeaderboard, setLiveWorldLeaderboard] = useState<ReturnType<typeof leaderboardFromLiveRows> | null>(null)

  useEffect(() => {
    const step = productTour?.stepId
    if (!step) return
    if (step === 'misiones-arena' || step === 'misiones-list') {
      setArenaView('missions')
      setFriendProfileActive(false)
      return
    }
    if (step === 'misiones-items') {
      setArenaView('items')
      setFriendProfileActive(false)
      return
    }
    if (step === 'misiones-compite') {
      setArenaView('compite')
      setFriendProfileActive(false)
    }
  }, [productTour?.stepId])

  const progressPercent = Math.round(gamification.levelProgress * 100)
  const nextLevel = GAMIFICATION_LEVELS.find((level) => level.level === gamification.level.level + 1)

  const activeMissions = useMemo(() => {
    // Las pendientes primero y las más avanzadas arriba: lo siguiente por hacer se ve sin buscar.
    const pendingFirst = (list: MissionProgress[]) => [...list].sort((left, right) => (
      Number(left.completed) - Number(right.completed) || right.progress - left.progress
    ))

    if (section === 'weekly') {
      return pendingFirst(gamification.weeklyProgress)
    }

    if (section === 'monthly') {
      return pendingFirst(gamification.monthlyProgress)
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

  const showcaseCountryLeaderboard = useMemo(
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

  const showcaseWorldLeaderboard = useMemo(
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

  useEffect(() => {
    if (!user) {
      return
    }

    let cancelled = false
    void Promise.all([
      fetchCustomerLeaderboard('country').catch(() => []),
      fetchCustomerLeaderboard('world').catch(() => []),
    ]).then(([countryRows, worldRows]) => {
      if (cancelled) {
        return
      }
      if (countryRows.length > 0) {
        setLiveCountryLeaderboard(leaderboardFromLiveRows(countryRows))
      }
      if (worldRows.length > 0) {
        setLiveWorldLeaderboard(leaderboardFromLiveRows(worldRows))
      }
    })

    return () => {
      cancelled = true
    }
  }, [user, gamification.state.xp])

  const countryLeaderboard = liveCountryLeaderboard ?? showcaseCountryLeaderboard
  const worldLeaderboard = liveWorldLeaderboard ?? showcaseWorldLeaderboard

  const userEntry = useMemo(
    () => countryLeaderboard.find((entry) => entry.isYou) ?? worldLeaderboard.find((entry) => entry.isYou)!,
    [countryLeaderboard, worldLeaderboard],
  )

  const showcaseCountryRank = useMemo(
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

  const showcaseWorldRank = useMemo(
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

  // El puesto real sale del ranking del servidor; el de ejemplo solo mientras carga o sin datos.
  const countryRank = liveCountryLeaderboard?.find((entry) => entry.isYou)?.rank ?? showcaseCountryRank
  const worldRank = liveWorldLeaderboard?.find((entry) => entry.isYou)?.rank ?? showcaseWorldRank

  // Pique: cuánto te falta para pasar al de delante (o tu ventaja si vas primero).
  const rival = useMemo(() => {
    const ordered = [...countryLeaderboard].sort((left, right) => left.rank - right.rank)
    const index = ordered.findIndex((entry) => entry.isYou)
    if (index < 0) return null
    const you = ordered[index]
    if (index === 0) {
      const second = ordered[1]
      return second ? { lead: true, name: second.displayName, gap: Math.max(0, you.xp - second.xp), rank: 2 } : null
    }
    const ahead = ordered[index - 1]
    return { lead: false, name: ahead.displayName, gap: Math.max(1, ahead.xp - you.xp + 1), rank: ahead.rank }
  }, [countryLeaderboard])

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
        <p className={styles.xpMeta}>
          {gamification.xpToNext === null
            ? 'Has alcanzado el rango máximo'
            : `${progressPercent}% del siguiente nivel`}
        </p>

        {rival ? (
          <p className={styles.rivalChip}>
            <span aria-hidden="true">{rival.lead ? '👑' : '🔥'}</span>
            {rival.lead ? (
              <span>Vas <strong>#1 de {userCountry}</strong> · {rival.gap.toLocaleString('es-ES')} XP de ventaja sobre {rival.name}</span>
            ) : (
              <span>Te faltan <strong>{rival.gap.toLocaleString('es-ES')} XP</strong> para pasar a {rival.name} (#{rival.rank})</span>
            )}
          </p>
        ) : null}

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
      <div className={styles.arenaTabs} role="tablist" aria-label="Arena" data-tour="tour-misiones-arena">
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
          openRequestsOnMount={linkedView === 'solicitudes'}
        />
      ) : arenaView === 'items' ? (
        <InventoryHub
          inventory={gamification.state.inventory}
          strikeCount={gamification.state.cancellationStrikeCount}
          promoLocked={gamification.state.promoLocked}
          onUseItem={gamification.useOwnedInventoryItem}
        />
      ) : (
        <div data-tour="tour-misiones-list">
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

      <CollectionProgress
        city={profile?.homeMunicipality || profile?.homeCity || ''}
        kicker="Misión única"
        title="Completa tu mapa gastronómico"
        flush
      />

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

      {section !== 'historical' ? (
        <p className={styles.resetTimer}>
          <span aria-hidden="true">⏳</span> Se renuevan en <strong>{resetLabel(section)}</strong>
        </p>
      ) : null}

      <section
        className={styles.missionSection}
        style={{
          ['--mission-accent' as string]: getLevelRankingStripTheme(gamification.level.level).avatarBorder,
          ['--mission-fill' as string]: getLevelRankingStripTheme(gamification.level.level).xpFill,
        }}
      >
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
        </div>
      )}
    </div>
  )
}

export default CustomerMissionsTab
