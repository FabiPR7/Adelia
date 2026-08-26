export type MissionCadence = 'weekly' | 'monthly' | 'historical'

export type MissionCategory = 'loyalty' | 'reviews' | 'rewards' | 'exploration'

export interface MissionDefinition {
  id: string
  name: string
  xp: number
  cadence: MissionCadence
  category?: MissionCategory
  description: string
  /** Emoji or `adelina` / `adelina-review` for branded coin icons */
  icon: string
  target: number
  /** Solo se muestra una misión de cada grupo en la misma rotación. */
  rotationGroup?: string
}

export interface ClaimedPromotionRecord {
  promotionId: string
  companyId: string
  companyName: string
  companySlug: string
  title: string
  prizeLabel: string
  claimedAt: string
  description?: string
  detail?: string
  photoUrl?: string
  companyPhotoUrl?: string
  promotionType?: 'reservation_ladder' | 'time_limited' | 'attendance'
  reservationId?: string
}

export interface CustomerGamificationState {
  xp: number
  adelinas: number
  completedMissions: string[]
  visitedCompanyIds: string[]
  weekKey: string
  weeklyCompleted: string[]
  monthKey: string
  monthlyCompleted: string[]
  reviewsCount: number
  reviewsWithPhotoCount: number
  textReviewsCount: number
  /** Recuento de reseñas con foto al empezar la semana (para misiones semanales). */
  reviewsWithPhotoCountAtWeekStart?: number
  textReviewsCountAtWeekStart?: number
  reviewsWithPhotoCountAtMonthStart?: number
  redemptionsCountAtMonthStart?: number
  reviewedReservationIds: string[]
  /** Restaurantes en los que el cliente ya publicó reseña (una por local). */
  reviewedCompanyIds: string[]
  redemptionsCount: number
  helpfulReviewVotes: number
  favoritesAddedThisWeek: number
  favoriteSlugsAtWeekStart: string[]
  awardedReservationXpIds: string[]
  claimedPromotions: ClaimedPromotionRecord[]
  /** Visitas confirmadas acumuladas en el momento del último canje por restaurante. */
  ladderBaselinesByCompany: Record<string, number>
  /** Promo de escalón activa por restaurante (solo una a la vez si hay varias). */
  activeLadderPromotionByCompany: Record<string, string>
  /** Veces que el cliente completó el mapa entero de un restaurante. */
  ladderCompletionsByCompany: Record<string, number>
  /** Último nivel por el que ya se mostró la animación de ascenso. */
  lastCelebratedLevel: number | null
  /** Misiones cuya celebración ya se mostró a este usuario. */
  celebratedMissionIds: string[]
  /** Si es true, no se reponen animaciones históricas al recargar. */
  celebrationsBootstrapped: boolean
  /** Cancelaciones de reserva (cliente o restaurante) que ya restaron XP. */
  cancellationStrikeCount: number
  cancelledReservationIds: string[]
  xpPenaltyTotal: number
  /** A las 5 cancelaciones se bloquean reservas y canjes de promoción. */
  promoLocked: boolean
  /** Cartas e ítems: id → cantidad. */
  inventory: Record<string, number>
  /** Claves ya recompensadas (nivel, misión, bonus). */
  grantedItemKeys: string[]
  /** Visitas extra aplicadas con cartas de mesa, por restaurante. */
  tokenCreditsByCompany: Record<string, number>
  /** Cartas usadas cuyo resto de gasto aún hay que verificar con el restaurante. */
  pendingTokenSpend: PendingTokenSpend[]
}

export interface PendingTokenSpend {
  id: string
  companyId: string
  itemId: string
  visits: number
  coverCents: number
  remainderCents: number
  requiredCents: number
  createdAt: string
}

export interface MissionProgress {
  mission: MissionDefinition
  current: number
  completed: boolean
  progress: number
}

export interface GamificationLevel {
  level: number
  title: string
  minXp: number
  maxXp: number | null
  colors: [string, string]
  styleClass: string
}

export let WEEKLY_MISSION_BONUS_XP = 150
export let WEEKLY_BONUS_TARGET = 5
export let CONFIRMED_RESERVATION_XP = 25

export function applyGameConfig(config: {
  weeklyBonusXp?: number
  weeklyBonusTarget?: number
  confirmedReservationXp?: number
}): void {
  if (typeof config.weeklyBonusXp === 'number' && Number.isFinite(config.weeklyBonusXp)) {
    WEEKLY_MISSION_BONUS_XP = config.weeklyBonusXp
  }
  if (typeof config.weeklyBonusTarget === 'number' && Number.isFinite(config.weeklyBonusTarget)) {
    WEEKLY_BONUS_TARGET = config.weeklyBonusTarget
  }
  if (typeof config.confirmedReservationXp === 'number' && Number.isFinite(config.confirmedReservationXp)) {
    CONFIRMED_RESERVATION_XP = config.confirmedReservationXp
  }
}

export function defaultGamificationState(): CustomerGamificationState {
  return {
    xp: 0,
    adelinas: 0,
    completedMissions: [],
    visitedCompanyIds: [],
    weekKey: '',
    weeklyCompleted: [],
    monthKey: '',
    monthlyCompleted: [],
    reviewsCount: 0,
    reviewsWithPhotoCount: 0,
    textReviewsCount: 0,
    reviewedReservationIds: [],
    reviewedCompanyIds: [],
    redemptionsCount: 0,
    helpfulReviewVotes: 0,
    favoritesAddedThisWeek: 0,
    favoriteSlugsAtWeekStart: [],
    awardedReservationXpIds: [],
    claimedPromotions: [],
    ladderBaselinesByCompany: {},
    activeLadderPromotionByCompany: {},
    ladderCompletionsByCompany: {},
    lastCelebratedLevel: null,
    celebratedMissionIds: [],
    celebrationsBootstrapped: false,
    cancellationStrikeCount: 0,
    cancelledReservationIds: [],
    xpPenaltyTotal: 0,
    promoLocked: false,
    inventory: {},
    grantedItemKeys: [],
    tokenCreditsByCompany: {},
    pendingTokenSpend: [],
  }
}
