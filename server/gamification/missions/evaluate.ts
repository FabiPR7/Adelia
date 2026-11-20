// Evalúa las misiones de un cliente EN EL SERVIDOR, con datos de confianza (sus
// reservas, consumos validados, favoritos y los locales), y devuelve el estado nuevo y
// el progreso de cada misión. Antes lo calculaban la web y la app y el servidor solo
// ponía un tope a la XP que le proponían.
import { adminDb } from '../../firebase-admin.ts'
import { COLLECTIONS } from '../../data/collections.ts'
import { ensureMissionCatalog } from './catalog.ts'
import { HISTORICAL_MISSIONS } from './missionsData.ts'
import {
  buildMissionProgressList,
  computeWeeklyBonusProgress,
  getWeeklyFeaturedCategory,
  processGamificationRewards,
  rotateMonthlyMissions,
  rotateWeeklyMissions,
  syncGamificationPeriods,
  type GamificationContext,
} from './engine.ts'
import { engineNow, toMadridWall, type CustomerVerifiedConsumption, type Reservation } from './engineSupport.ts'
import { defaultGamificationState, type CustomerGamificationState, type MissionProgress } from './types.ts'

export interface MissionsCustomer {
  uid: string
  email: string
  emailVerified: boolean
}

/** Lo que necesita el motor, ya leído de la base de datos. */
export interface MissionInputs {
  reservations: Reservation[]
  consumptions: CustomerVerifiedConsumption[]
  favoriteSlugs: string[]
  promotionCompanyIds: Set<string>
  restaurants: Map<string, { zone: string; categories: string[]; venueTypes: string[]; reservationMode: 'required' | 'optional' | 'none' }>
}

export interface MissionEvaluation {
  state: CustomerGamificationState
  weeklyProgress: MissionProgress[]
  monthlyProgress: MissionProgress[]
  historicalProgress: MissionProgress[]
  weeklyBonus: ReturnType<typeof computeWeeklyBonusProgress>
  weeklyFeaturedCategory: string
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const asStringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const asNumberRecord = (value: unknown) => {
  const out: Record<string, number> = {}
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) if (typeof item === 'number' && Number.isFinite(item)) out[key] = item
  }
  return out
}

/** Estado guardado → el formato completo que espera el motor (con valores por defecto). */
export function normalizeGamificationState(stored: Record<string, unknown>): CustomerGamificationState {
  const base = defaultGamificationState()
  const merged = { ...base, ...stored } as CustomerGamificationState & Record<string, unknown>
  const num = (key: keyof CustomerGamificationState, fallback = 0) =>
    typeof stored[key] === 'number' && Number.isFinite(stored[key]) ? stored[key] as number : fallback
  return {
    ...merged,
    xp: num('xp'),
    adelinas: num('adelinas'),
    reviewsCount: num('reviewsCount'),
    reviewsWithPhotoCount: num('reviewsWithPhotoCount'),
    textReviewsCount: num('textReviewsCount'),
    redemptionsCount: num('redemptionsCount'),
    helpfulReviewVotes: num('helpfulReviewVotes'),
    favoritesAddedThisWeek: num('favoritesAddedThisWeek'),
    cancellationStrikeCount: num('cancellationStrikeCount'),
    xpPenaltyTotal: num('xpPenaltyTotal'),
    completedMissions: asStringArray(stored.completedMissions),
    visitedCompanyIds: asStringArray(stored.visitedCompanyIds),
    weeklyCompleted: asStringArray(stored.weeklyCompleted),
    monthlyCompleted: asStringArray(stored.monthlyCompleted),
    reviewedReservationIds: asStringArray(stored.reviewedReservationIds),
    reviewedCompanyIds: asStringArray(stored.reviewedCompanyIds),
    favoriteSlugsAtWeekStart: asStringArray(stored.favoriteSlugsAtWeekStart),
    awardedReservationXpIds: asStringArray(stored.awardedReservationXpIds),
    celebratedMissionIds: asStringArray(stored.celebratedMissionIds),
    cancelledReservationIds: asStringArray(stored.cancelledReservationIds),
    grantedItemKeys: asStringArray(stored.grantedItemKeys),
    weekKey: typeof stored.weekKey === 'string' ? stored.weekKey : '',
    monthKey: typeof stored.monthKey === 'string' ? stored.monthKey : '',
    claimedPromotions: Array.isArray(stored.claimedPromotions) ? stored.claimedPromotions as CustomerGamificationState['claimedPromotions'] : [],
    pendingTokenSpend: Array.isArray(stored.pendingTokenSpend) ? stored.pendingTokenSpend as CustomerGamificationState['pendingTokenSpend'] : [],
    ladderBaselinesByCompany: asNumberRecord(stored.ladderBaselinesByCompany),
    ladderCompletionsByCompany: asNumberRecord(stored.ladderCompletionsByCompany),
    tokenCreditsByCompany: asNumberRecord(stored.tokenCreditsByCompany),
    inventory: asNumberRecord(stored.inventory),
    activeLadderPromotionByCompany: stored.activeLadderPromotionByCompany && typeof stored.activeLadderPromotionByCompany === 'object'
      ? stored.activeLadderPromotionByCompany as Record<string, string>
      : {},
    lastCelebratedLevel: typeof stored.lastCelebratedLevel === 'number' ? stored.lastCelebratedLevel : null,
    celebrationsBootstrapped: stored.celebrationsBootstrapped === true,
    promoLocked: stored.promoLocked === true,
  }
}

function mapReservation(id: string, data: FirebaseFirestore.DocumentData): Reservation | null {
  const start = toDate(data.startTime)
  if (!start || typeof data.companyId !== 'string') return null
  const end = toDate(data.endTime) ?? start
  const created = toDate(data.createdAt) ?? start
  return {
    id,
    companyId: data.companyId,
    tableId: typeof data.tableId === 'string' ? data.tableId : '',
    pax: typeof data.pax === 'number' ? data.pax : 1,
    // Hora de pared de España: el motor lee getHours()/getDay() «locales».
    startTime: toMadridWall(start),
    endTime: toMadridWall(end),
    createdAt: toMadridWall(created),
    status: typeof data.status === 'string' ? data.status : 'completed',
    customerUid: typeof data.customerUid === 'string' ? data.customerUid : null,
    promotionId: typeof data.promotionId === 'string' ? data.promotionId : null,
    minimumSpendCents: typeof data.minimumSpendCents === 'number' ? data.minimumSpendCents : null,
    promotionVisitStatus: typeof data.promotionVisitStatus === 'string' ? data.promotionVisitStatus : undefined,
  }
}

function mapConsumption(id: string, data: FirebaseFirestore.DocumentData, companyFromPath: string): CustomerVerifiedConsumption {
  const verified = toDate(data.verifiedAt) ?? new Date(0)
  const visit = toDate(data.reservationStartTime) ?? verified
  return {
    id,
    companyId: typeof data.companyId === 'string' && data.companyId ? data.companyId : companyFromPath,
    verifiedAt: toMadridWall(verified).toISOString(),
    visitAt: toMadridWall(visit).toISOString(),
    totalCents: typeof data.totalCents === 'number' ? Math.max(0, Math.round(data.totalCents)) : 0,
    mode: data.mode === 'products' || data.mode === 'skip' ? data.mode : 'total',
    lineItems: Array.isArray(data.lineItems)
      ? data.lineItems.flatMap((item: Record<string, unknown>) => item && typeof item === 'object'
        ? [{
            name: typeof item.name === 'string' ? item.name : '',
            quantity: typeof item.quantity === 'number' ? item.quantity : 0,
            lineTotalCents: typeof item.lineTotalCents === 'number' ? item.lineTotalCents : 0,
          }]
        : [])
      : [],
    source: data.source === 'walk_in' || (!data.reservationId && data.source !== 'reservation') ? 'walk_in' : 'reservation',
    promotionId: typeof data.promotionId === 'string' && data.promotionId ? data.promotionId : null,
    minimumSpendCents: typeof data.minimumSpendCents === 'number' ? data.minimumSpendCents : 0,
    meetsMinimumSpend: data.meetsMinimumSpend === true,
  }
}

/** Lee de la base de datos todo lo que usa el motor para este cliente. */
export async function loadMissionInputs(customer: MissionsCustomer, favoriteSlugsRaw: unknown): Promise<MissionInputs> {
  const reservations = adminDb.collection(COLLECTIONS.reservations)
  const [byUidSnap, byEmailSnap, consumptionsSnap, promotionsSnap] = await Promise.all([
    reservations.where('customerUid', '==', customer.uid).limit(500).get(),
    customer.emailVerified && customer.email
      ? reservations.where('clientEmail', '==', customer.email).limit(500).get()
      : Promise.resolve(null),
    adminDb.collectionGroup('verifiedConsumptions').where('customerUid', '==', customer.uid).limit(500).get(),
    adminDb.collectionGroup('promotions').where('active', '==', true).select().limit(200).get(),
  ])

  // Igual que «Mis reservas» (forMissions): las de la cuenta; si no hay, las de invitado con su correo.
  const byAccount = byUidSnap.docs.flatMap((doc) => {
    const row = mapReservation(doc.id, doc.data())
    return row ? [row] : []
  })
  const byEmail = (byEmailSnap?.docs ?? [])
    .filter((doc) => doc.data().customerUid == null || doc.data().customerUid === customer.uid)
    .flatMap((doc) => {
      const row = mapReservation(doc.id, doc.data())
      return row ? [row] : []
    })
  const missionReservations = byAccount.length > 0 ? byAccount : byEmail

  const consumptions = consumptionsSnap.docs.map((doc) => mapConsumption(doc.id, doc.data(), doc.ref.parent.parent?.id ?? ''))

  const promotionCompanyIds = new Set(
    promotionsSnap.docs.map((doc) => doc.ref.parent.parent?.id).filter((id): id is string => Boolean(id)),
  )

  const companyIds = [...new Set([
    ...missionReservations.map((item) => item.companyId),
    ...consumptions.map((item) => item.companyId),
  ].filter(Boolean))]
  const restaurants: MissionInputs['restaurants'] = new Map()
  for (let index = 0; index < companyIds.length; index += 100) {
    const chunk = companyIds.slice(index, index + 100)
    const snaps = await adminDb.getAll(...chunk.map((id) => adminDb.collection(COLLECTIONS.restaurantIndex).doc(id)))
    for (const snap of snaps) {
      const data = snap.data()
      if (!data) continue
      const mode = data.reservationMode === 'required' || data.reservationMode === 'none' ? data.reservationMode : 'optional'
      restaurants.set(snap.id, {
        zone: String(data.municipality || data.location || ''),
        categories: asStringArray(data.characteristics),
        venueTypes: asStringArray(data.venueTypes),
        reservationMode: mode,
      })
    }
  }

  const favoriteSlugs = asStringArray(favoriteSlugsRaw).map((slug) => slug.trim().toLowerCase()).filter(Boolean)
  return { reservations: missionReservations, consumptions, favoriteSlugs, promotionCompanyIds, restaurants }
}

/** Corre el motor (puro): mismo orden de pasos que hacía la web. */
export function runMissionEngine(stored: Record<string, unknown>, inputs: MissionInputs): MissionEvaluation {
  const state = normalizeGamificationState(stored)
  const now = engineNow()
  const restaurantZones = new Map<string, string>()
  const restaurantCategories = new Map<string, string[]>()
  const restaurantVenueTypes = new Map<string, string[]>()
  const restaurantReservationModes = new Map<string, 'required' | 'optional' | 'none'>()
  for (const [id, info] of inputs.restaurants) {
    restaurantZones.set(id, info.zone)
    restaurantCategories.set(id, info.categories)
    restaurantVenueTypes.set(id, info.venueTypes)
    restaurantReservationModes.set(id, info.reservationMode)
  }
  const context: GamificationContext = {
    reservations: inputs.reservations,
    consumptions: inputs.consumptions,
    favoriteSlugs: inputs.favoriteSlugs,
    promotionCompanyIds: inputs.promotionCompanyIds,
    restaurantZones,
    restaurantCategories,
    restaurantVenueTypes,
    restaurantReservationModes,
    weeklyFeaturedCategory: getWeeklyFeaturedCategory(now),
  }

  // Del estado ya reiniciado de semana/mes: si no, las misiones del periodo anterior
  // contarían como completadas y se cobrarían otra vez.
  const evaluationState = syncGamificationPeriods(state, inputs.favoriteSlugs)
  const weeklyProgress = buildMissionProgressList(rotateWeeklyMissions(now), context, evaluationState, new Set(evaluationState.weeklyCompleted))
  const monthlyProgress = buildMissionProgressList(rotateMonthlyMissions(now), context, evaluationState, new Set(evaluationState.monthlyCompleted))
  const historicalProgress = buildMissionProgressList(HISTORICAL_MISSIONS, context, evaluationState, new Set(evaluationState.completedMissions))
  const next = processGamificationRewards(
    evaluationState,
    weeklyProgress,
    monthlyProgress,
    historicalProgress,
    inputs.reservations,
    inputs.favoriteSlugs,
    inputs.consumptions,
  )
  const weeklyWithAwards = weeklyProgress.map((item) => ({
    ...item,
    completed: item.completed || next.weeklyCompleted.includes(item.mission.id),
  }))
  return {
    state: next,
    weeklyProgress: weeklyWithAwards,
    monthlyProgress,
    historicalProgress,
    weeklyBonus: computeWeeklyBonusProgress(weeklyWithAwards),
    weeklyFeaturedCategory: context.weeklyFeaturedCategory,
  }
}

export async function prepareMissionEvaluation(customer: MissionsCustomer, favoriteSlugs: unknown): Promise<MissionInputs> {
  await ensureMissionCatalog()
  return loadMissionInputs(customer, favoriteSlugs)
}
