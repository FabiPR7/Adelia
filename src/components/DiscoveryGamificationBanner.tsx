import rankingHero from '../assets/gamification-ranking-hero.webp'
import { buildLeaderboardWithUser, getUserRank } from '../data/gamificationLeaderboard'
import GamificationLevelJourney from './GamificationLevelJourney'
import GamificationRankingPodium from './GamificationRankingPodium'
import GamificationCelebrationToast from './GamificationCelebrationToast'
import MissionsHub from './MissionsHub'
import type { CustomerGamificationView } from '../hooks/useCustomerGamification'
import { useGamificationCelebrations } from '../hooks/useGamificationCelebrations'
import { HISTORICAL_MISSIONS } from '../data/gamificationMissions'
import { defaultGamificationState } from '../types/gamification'
import {
  buildMissionProgressList,
  computeWeeklyBonusProgress,
  getLevelForXp,
  getXpToNextLevel,
  rotateWeeklyMissions,
} from '../utils/gamificationProgress'
import { Link } from 'react-router-dom'
import styles from './DiscoveryGamificationBanner.module.css'

interface DiscoveryGamificationBannerProps {
  gamification?: CustomerGamificationView | null
  isCustomer: boolean
  userName?: string
  userId?: string
}

function buildGuestPreview() {
  const state = defaultGamificationState()
  const context = {
    reservations: [],
    favoriteSlugs: [],
    promotionCompanyIds: new Set<string>(),
    restaurantZones: new Map<string, string>(),
    restaurantCategories: new Map<string, string[]>(),
  }
  const weeklyMissions = rotateWeeklyMissions(undefined, 5)
  const weeklyProgress = buildMissionProgressList(weeklyMissions, context, state, new Set())
  const historicalProgress = buildMissionProgressList(
    HISTORICAL_MISSIONS.slice(0, 4),
    context,
    state,
    new Set(),
  )

  return {
    level: getLevelForXp(0),
    levelProgress: 0,
    xpToNext: getXpToNextLevel(0, getLevelForXp(0)),
    state,
    weeklyProgress,
    historicalProgress,
    weeklyBonus: computeWeeklyBonusProgress(weeklyProgress),
    unlockedRewards: [],
  }
}

function DiscoveryGamificationBanner({
  gamification,
  isCustomer,
  userName = '',
  userId,
}: DiscoveryGamificationBannerProps) {
  const preview = buildGuestPreview()
  const data = isCustomer && gamification ? gamification : preview

  const celebrations = useGamificationCelebrations({
    userId,
    userName,
    xp: data.state.xp,
    level: data.level.level,
    levelTitle: data.level.title,
    enabled: isCustomer,
  })

  const leaderboard = buildLeaderboardWithUser(
    userName,
    data.state.xp,
    data.level.level,
    data.level.title,
  )
  const userRank = isCustomer
    ? getUserRank(userName, data.state.xp, data.level.level, data.level.title)
    : undefined

  return (
    <>
      <GamificationCelebrationToast
        event={celebrations.activeEvent}
        onDismiss={celebrations.dismissActive}
      />

      <section className={styles.arena} aria-labelledby="gamification-heading">
      <div className={styles.hero}>
        <img src={rankingHero} alt="" className={styles.heroImage} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>Ranking semanal · XP</span>
          <h2 id="gamification-heading">
            Compite.
            <br />
            <span className={styles.heroAccent}>Sube de nivel.</span>
            <br />
            Domina la mesa.
          </h2>
          <p className={styles.heroText}>
            Completa misiones, gana XP, desbloquea marcos épicos para tu perfil y escala el podio
            frente a otros foodies de Adelia.
          </p>
          <div className={styles.heroActions}>
            {!isCustomer ? (
              <Link to="/cuenta/registro" className={styles.ctaPrimary}>
                Entrar al ranking
              </Link>
            ) : (
              <Link to="/cuenta" className={styles.ctaPrimary}>
                Ver mi progreso
              </Link>
            )}
            <span className={`${styles.livePill} ${celebrations.rankJustImproved ? styles.livePillRankUp : ''}`}>
              <span className={styles.liveDot} aria-hidden="true" />
              {isCustomer ? `#${userRank} esta semana` : '847 foodies compitiendo'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.levelStrip}>
          <GamificationLevelJourney
            currentLevel={data.level}
            xp={data.state.xp}
            levelProgress={data.levelProgress}
            xpToNext={data.xpToNext}
            celebrate={celebrations.levelJustUp || celebrations.rankJustImproved}
          />
        </div>

        <div className={styles.competitionRow}>
          <div className={styles.rankingPanel}>
            <div className={styles.panelHeader}>
              <h3>Podio de la semana</h3>
              <span>Top foodies</span>
            </div>
            <GamificationRankingPodium
              entries={leaderboard}
              userRank={userRank}
              rankJustImproved={celebrations.rankJustImproved}
            />
          </div>

          <div className={styles.missionsColumn}>
            <MissionsHub
              weeklyProgress={
                isCustomer && gamification ? gamification.weeklyProgress : preview.weeklyProgress
              }
              monthlyProgress={isCustomer && gamification ? gamification.monthlyProgress : []}
              historicalProgress={
                isCustomer && gamification
                  ? gamification.historicalProgress.slice(0, 4)
                  : preview.historicalProgress
              }
              weeklyBonus={data.weeklyBonus}
              compact
              variant="arena"
              locked={!isCustomer}
            />
          </div>
        </div>

        {!isCustomer && (
          <p className={styles.lockBanner}>
            🔒 Regístrate gratis para guardar XP, aparecer en el ranking y desbloquear recompensas
            de perfil exclusivas.
          </p>
        )}
      </div>
    </section>
    </>
  )
}

export default DiscoveryGamificationBanner
