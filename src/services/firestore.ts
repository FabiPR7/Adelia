import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  deleteField,
  type QueryConstraint,
} from 'firebase/firestore'
import { db, auth } from '../config/firebase'
import type {
  AppUser,
  AdminCompany,
  Company,
  CompanyEmailTemplates,
  CompanySettingsPayload,
  PromotionVisitStatus,
  Reservation,
  ReservationFormData,
  ReservationStatus,
  RestaurantTable,
  TableInput,
} from '../types'
import { defaultGamificationState } from '../types/gamification'
import type { CustomerGamificationState, ClaimedPromotionRecord } from '../types/gamification'
import type { CustomerVerifiedConsumption, VerifiedConsumptionRecord } from '../types/verifiedConsumption'
import { parseCompanyReviewStats } from '../types/review'
import { mapVerifiedConsumptionDoc } from '../utils/productReports'
import type { PublicPromotion } from './publicPromotions'
import { getNextLadderPromotionId, sortCompanyLadderPromotions } from '../utils/promotionReservationProgress'
import { defaultTurns, parseFloorPlan, parseFloorPlans, primaryFloorPlan, serializeFloorPlanForFirestore, serializeFloorPlansForFirestore } from '../types/company'
import {
  normalizeCompanyEmailTemplates,
  parseCompanyEmailTemplatesFromFirestore,
} from '../utils/emailTemplates'
import {
  assertReservationSlotValid,
  computeReservationCountsByMonth as computeReservationCountsByMonthUtil,
} from '../utils/reservationSlots'
import { combineDateAndTime, dateToIsoDate, defaultSchedule, generateUuid, isSameDay, slugToAuthEmail, slugify } from '../utils/helpers'
import {
  filterDemoReservations,
  getDemoCompany,
  getDemoTables,
  getDemoVerifiedConsumptions,
  isDemoCompanyId,
  rejectIfDemoCompanyWrite,
} from '../data/companyPanelDemo'
import { MAX_COMPANY_CHARACTERISTICS } from '../data/companyCharacteristics'
import { parseCompanyReservationMode } from '../data/companyReservationMode'
import { parseCompanyProfileFacilities } from '../data/companyProfileFacilities'
import {
  ADMIN_COMPANY_LIST_LIMIT,
  COMPANY_RESERVATION_QUERY_LIMIT,
  COMPANY_RESERVATION_RANGE_LIMIT,
  COMPANY_TABLE_LIMIT,
  CUSTOMER_RESERVATION_LIMIT,
  dayBounds,
  RESERVATION_QUERY_CACHE_MS,
} from './firestoreQuery'
import {
  parseCompanyPlanBilling,
  parseCompanyPlanId,
  parseCompanyPlanStartedAt,
} from '../data/companyPlans'
import { normalizeCompanySchedule } from '../utils/schedule'
import {
  normalizeCompanySettingsPayload,
} from '../utils/companyValidation'
import { notifyReservationCancelledNotification, notifyReservationConfirmationEmail } from './reservationEmailApi'
import type { QrBrandingConfig, QrBrandingKind } from '../types/company'
import {
  normalizeQrBrandingConfig,
  parseCompanyQrBranding,
  serializeCompanyQrBranding,
} from '../utils/qrBranding'
import { listUserFavoriteSlugs } from './userFavorites'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function syncCompanyLoginIndex(
  loginName: string,
  authEmail: string,
  companyId?: string,
): Promise<void> {
  const trimmed = loginName.trim()
  const loginId = slugify(trimmed)
  await setDoc(doc(db, 'logins', loginId), {
    loginName: trimmed,
    authEmail,
    role: 'company',
    ...(companyId ? { companyId } : {}),
  })
}

export async function resolveLoginAuthEmail(username: string, password: string): Promise<string> {
  const trimmed = username.trim()

  if (!trimmed) {
    throw new Error('Indica tu nombre de usuario.')
  }

  const response = await fetch(`${API_BASE}/api/auth/resolve-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginName: trimmed, password }),
  })

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
    }
    if (response.status === 503) {
      throw new Error('Inicio de sesión no disponible ahora mismo.')
    }
    throw new Error('Nombre o contraseña incorrectos.')
  }

  const data = (await response.json()) as { authEmail?: string }
  if (!data.authEmail) {
    throw new Error('Nombre o contraseña incorrectos.')
  }

  return data.authEmail
}

export async function ensureCompanyLoginIndex(companyId: string): Promise<void> {
  const [credentialsSnap, companySnap] = await Promise.all([
    getDoc(doc(db, 'companyCredentials', companyId)),
    getDoc(doc(db, 'companies', companyId)),
  ])

  if (!credentialsSnap.exists() || !companySnap.exists()) {
    return
  }

  const loginName =
    (credentialsSnap.data().loginName as string | undefined) ??
    (companySnap.data().name as string | undefined)
  const authEmail =
    (credentialsSnap.data().authEmail as string | undefined) ??
    slugToAuthEmail(companySnap.data().slug as string)

  if (!loginName || !authEmail) {
    return
  }

  if ('loginPassword' in credentialsSnap.data() || 'password' in credentialsSnap.data()) {
    await updateDoc(doc(db, 'companyCredentials', companyId), {
      loginPassword: deleteField(),
      password: deleteField(),
    }).catch(() => undefined)
  }

  await syncCompanyLoginIndex(loginName, authEmail, companyId)
}

/** Sincroniza el índice de acceso de todas las empresas (solo admin). */
export async function syncAllCompanyLoginIndexes(): Promise<void> {
  const [companiesSnap, credentialsSnap] = await Promise.all([
    getDocs(query(collection(db, 'companies'), limit(ADMIN_COMPANY_LIST_LIMIT))),
    getDocs(query(collection(db, 'companyCredentials'), limit(ADMIN_COMPANY_LIST_LIMIT))),
  ])

  const credentialsByCompanyId = Object.fromEntries(
    credentialsSnap.docs.map((item) => [item.id, item.data()]),
  )

  for (const companyDoc of companiesSnap.docs) {
    const credentials = credentialsByCompanyId[companyDoc.id]
    const companyData = companyDoc.data()
    const loginName =
      (credentials?.loginName as string | undefined) ??
      (companyData.name as string | undefined)
    const authEmail =
      (credentials?.authEmail as string | undefined) ??
      slugToAuthEmail(companyData.slug as string)

    if (loginName && authEmail) {
      await syncCompanyLoginIndex(loginName, authEmail, companyDoc.id)
    }
  }
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  try {
    const snapshot = await getDoc(doc(db, 'users', uid))

    if (!snapshot.exists()) {
      return withFavoriteSlugs(uid, await getUserProfileViaApi())
    }

    const data = snapshot.data()
    let stats: Record<string, unknown> | undefined
    try {
      const statsRef = doc(db, 'userGamification', uid)
      const statsSnap = await getDoc(statsRef)
      stats = statsSnap.data() as Record<string, unknown> | undefined
    } catch {
      stats = undefined
    }

    const gamificationSource = stats?.state
      ? { gamification: stats.state, xp: stats.xp, adelinas: stats.adelinas }
      : data

    return withFavoriteSlugs(
      uid,
      mapUserProfileRecord(data, gamificationSource as Record<string, unknown>, data.createdAt?.toDate?.() ?? new Date()),
    )
  } catch {
    return withFavoriteSlugs(uid, await getUserProfileViaApi())
  }
}

async function withFavoriteSlugs(uid: string, profile: AppUser | null): Promise<AppUser | null> {
  if (!profile || profile.role !== 'customer') {
    return profile
  }

  // Si el perfil ya trae el campo (aunque esté vacío), es la fuente de verdad.
  // No rellenar desde el índice: eso reponía favoritos recién quitados.
  if (Array.isArray(profile.favoriteSlugs)) {
    const fromProfile = [...new Set(
      profile.favoriteSlugs
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    )]
    return { ...profile, favoriteSlugs: fromProfile }
  }

  const slugs = await listUserFavoriteSlugs(uid)
  return { ...profile, favoriteSlugs: slugs }
}

async function getUserProfileViaApi(): Promise<AppUser | null> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) {
    return null
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      return null
    }
    const data = await response.json() as Record<string, unknown>
    return mapUserProfileRecord(
      data,
      {
        gamification: data.gamification,
        xp: data.xp,
        adelinas: data.adelinas,
      },
      typeof data.createdAt === 'string' ? new Date(data.createdAt) : new Date(),
    )
  } catch {
    return null
  }
}

function mapUserProfileRecord(
  data: Record<string, unknown>,
  gamificationSource: Record<string, unknown>,
  createdAt: Date,
): AppUser {
  return {
    email: data.email as string,
    role: data.role as AppUser['role'],
    companyId: (data.companyId as string | null) ?? null,
    displayName: (data.displayName as string) ?? '',
    favoriteSlugs: Array.isArray(data.favoriteSlugs)
      ? [...new Set(
        (data.favoriteSlugs as unknown[])
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      )]
      : [],
    gamification: parseGamificationData(gamificationSource),
    mustChangePassword: data.mustChangePassword === true,
    mustChangePasswordCleared: data.mustChangePassword === false,
    createdAt,
    phone: typeof data.phone === 'string' ? data.phone : '',
    phoneVerified: data.phoneVerified === true,
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
    homeCity: typeof data.homeCity === 'string' ? data.homeCity : '',
    homeMunicipality: typeof data.homeMunicipality === 'string' ? data.homeMunicipality : '',
    homeCountry: typeof data.homeCountry === 'string' ? data.homeCountry : '',
    homePostalCode: typeof data.homePostalCode === 'string' ? data.homePostalCode : '',
    homeLatitude: typeof data.homeLatitude === 'number' ? data.homeLatitude : null,
    homeLongitude: typeof data.homeLongitude === 'number' ? data.homeLongitude : null,
    foodPreferences: Array.isArray(data.foodPreferences) ? (data.foodPreferences as string[]) : [],
    onboardingCompleted:
      data.onboardingCompleted === true
      || (data.onboardingCompleted == null && Boolean(data.displayName)),
    authProvider: data.authProvider === 'google.com' ? 'google.com' : 'password',
    blocked: data.blocked === true,
  }
}

function parseCelebratedLevel(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value)
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed)
    }
  }

  return null
}

function parseGamificationData(data: Record<string, unknown>): CustomerGamificationState {
  const base = defaultGamificationState()
  const raw = data.gamification

  if (!raw || typeof raw !== 'object') {
    return {
      ...base,
      xp: typeof data.xp === 'number' ? data.xp : base.xp,
      adelinas: typeof data.adelinas === 'number' ? data.adelinas : base.adelinas,
    }
  }

  const gamification = raw as Record<string, unknown>

  return {
    xp: typeof gamification.xp === 'number' ? gamification.xp : base.xp,
    adelinas: typeof gamification.adelinas === 'number' ? gamification.adelinas : base.adelinas,
    completedMissions: Array.isArray(gamification.completedMissions)
      ? (gamification.completedMissions as string[])
      : [],
    visitedCompanyIds: Array.isArray(gamification.visitedCompanyIds)
      ? (gamification.visitedCompanyIds as string[])
      : [],
    weekKey: typeof gamification.weekKey === 'string' ? gamification.weekKey : '',
    weeklyCompleted: Array.isArray(gamification.weeklyCompleted)
      ? (gamification.weeklyCompleted as string[])
      : [],
    monthKey: typeof gamification.monthKey === 'string' ? gamification.monthKey : '',
    monthlyCompleted: Array.isArray(gamification.monthlyCompleted)
      ? (gamification.monthlyCompleted as string[])
      : [],
    reviewsCount: typeof gamification.reviewsCount === 'number' ? gamification.reviewsCount : 0,
    reviewsWithPhotoCount: typeof gamification.reviewsWithPhotoCount === 'number'
      ? gamification.reviewsWithPhotoCount
      : 0,
    textReviewsCount: typeof gamification.textReviewsCount === 'number'
      ? gamification.textReviewsCount
      : 0,
    reviewsWithPhotoCountAtWeekStart: typeof gamification.reviewsWithPhotoCountAtWeekStart === 'number'
      ? gamification.reviewsWithPhotoCountAtWeekStart
      : undefined,
    textReviewsCountAtWeekStart: typeof gamification.textReviewsCountAtWeekStart === 'number'
      ? gamification.textReviewsCountAtWeekStart
      : undefined,
    reviewsWithPhotoCountAtMonthStart: typeof gamification.reviewsWithPhotoCountAtMonthStart === 'number'
      ? gamification.reviewsWithPhotoCountAtMonthStart
      : undefined,
    redemptionsCountAtMonthStart: typeof gamification.redemptionsCountAtMonthStart === 'number'
      ? gamification.redemptionsCountAtMonthStart
      : undefined,
    reviewedReservationIds: Array.isArray(gamification.reviewedReservationIds)
      ? (gamification.reviewedReservationIds as string[])
      : [],
    reviewedCompanyIds: Array.isArray(gamification.reviewedCompanyIds)
      ? (gamification.reviewedCompanyIds as string[])
      : [],
    redemptionsCount: typeof gamification.redemptionsCount === 'number' ? gamification.redemptionsCount : 0,
    helpfulReviewVotes: typeof gamification.helpfulReviewVotes === 'number' ? gamification.helpfulReviewVotes : 0,
    favoritesAddedThisWeek: typeof gamification.favoritesAddedThisWeek === 'number'
      ? gamification.favoritesAddedThisWeek
      : 0,
    favoriteSlugsAtWeekStart: Array.isArray(gamification.favoriteSlugsAtWeekStart)
      ? (gamification.favoriteSlugsAtWeekStart as string[])
      : [],
    awardedReservationXpIds: Array.isArray(gamification.awardedReservationXpIds)
      ? (gamification.awardedReservationXpIds as string[])
      : [],
    claimedPromotions: Array.isArray(gamification.claimedPromotions)
      ? (gamification.claimedPromotions as ClaimedPromotionRecord[])
      : [],
    ladderBaselinesByCompany:
      gamification.ladderBaselinesByCompany
      && typeof gamification.ladderBaselinesByCompany === 'object'
      && !Array.isArray(gamification.ladderBaselinesByCompany)
        ? (gamification.ladderBaselinesByCompany as Record<string, number>)
        : {},
    activeLadderPromotionByCompany:
      gamification.activeLadderPromotionByCompany
      && typeof gamification.activeLadderPromotionByCompany === 'object'
      && !Array.isArray(gamification.activeLadderPromotionByCompany)
        ? (gamification.activeLadderPromotionByCompany as Record<string, string>)
        : {},
    ladderCompletionsByCompany:
      gamification.ladderCompletionsByCompany
      && typeof gamification.ladderCompletionsByCompany === 'object'
      && !Array.isArray(gamification.ladderCompletionsByCompany)
        ? (gamification.ladderCompletionsByCompany as Record<string, number>)
        : {},
    lastCelebratedLevel: parseCelebratedLevel(gamification.lastCelebratedLevel),
    celebratedMissionIds: Array.isArray(gamification.celebratedMissionIds)
      ? (gamification.celebratedMissionIds as unknown[]).filter((id): id is string => (
        typeof id === 'string' && id.trim().length > 0
      ))
      : [],
    celebrationsBootstrapped: gamification.celebrationsBootstrapped === true,
    cancellationStrikeCount: typeof gamification.cancellationStrikeCount === 'number'
      ? gamification.cancellationStrikeCount
      : 0,
    cancelledReservationIds: Array.isArray(gamification.cancelledReservationIds)
      ? (gamification.cancelledReservationIds as string[])
      : [],
    xpPenaltyTotal: typeof gamification.xpPenaltyTotal === 'number'
      ? gamification.xpPenaltyTotal
      : 0,
    promoLocked: gamification.promoLocked === true
      || (
        typeof gamification.cancellationStrikeCount === 'number'
        && gamification.cancellationStrikeCount >= 5
      ),
    inventory:
      gamification.inventory
      && typeof gamification.inventory === 'object'
      && !Array.isArray(gamification.inventory)
        ? Object.fromEntries(
          Object.entries(gamification.inventory as Record<string, unknown>)
            .filter(([, value]) => typeof value === 'number' && value > 0)
            .map(([key, value]) => [key, Math.trunc(value as number)]),
        )
        : {},
    grantedItemKeys: Array.isArray(gamification.grantedItemKeys)
      ? (gamification.grantedItemKeys as unknown[]).filter((key): key is string => typeof key === 'string')
      : [],
    tokenCreditsByCompany:
      gamification.tokenCreditsByCompany
      && typeof gamification.tokenCreditsByCompany === 'object'
      && !Array.isArray(gamification.tokenCreditsByCompany)
        ? Object.fromEntries(
          Object.entries(gamification.tokenCreditsByCompany as Record<string, unknown>)
            .filter(([, value]) => typeof value === 'number' && value > 0)
            .map(([key, value]) => [key, Math.trunc(value as number)]),
        )
        : {},
    pendingTokenSpend: Array.isArray(gamification.pendingTokenSpend)
      ? (gamification.pendingTokenSpend as Array<Record<string, unknown>>)
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : '',
          companyId: typeof entry.companyId === 'string' ? entry.companyId : '',
          itemId: typeof entry.itemId === 'string' ? entry.itemId : '',
          visits: typeof entry.visits === 'number' ? Math.trunc(entry.visits) : 0,
          coverCents: typeof entry.coverCents === 'number' ? Math.trunc(entry.coverCents) : 0,
          remainderCents: typeof entry.remainderCents === 'number' ? Math.trunc(entry.remainderCents) : 0,
          requiredCents: typeof entry.requiredCents === 'number' ? Math.trunc(entry.requiredCents) : 0,
          createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
        }))
        .filter((entry) => entry.companyId && entry.itemId && entry.visits > 0 && entry.remainderCents > 0)
      : [],
  }
}

export async function recordPromotionClaim(
  _uid: string,
  claim: ClaimedPromotionRecord,
  current: CustomerGamificationState,
  confirmedCountAtCompany: number,
  companyLadderPromotions: PublicPromotion[],
): Promise<CustomerGamificationState> {
  const nextActiveId = getNextLadderPromotionId(companyLadderPromotions, claim.promotionId)
  const sortedLadder = sortCompanyLadderPromotions(companyLadderPromotions)
  const ladderSize = sortedLadder.length
  const companyClaimsAfter = current.claimedPromotions.filter(
    (record) => record.companyId === claim.companyId,
  ).length + 1
  const completionsAfter = ladderSize > 0
    ? Math.floor(companyClaimsAfter / ladderSize)
    : 0

  const next: CustomerGamificationState = {
    ...current,
    redemptionsCount: current.redemptionsCount + 1,
    claimedPromotions: [...current.claimedPromotions, claim],
    ladderBaselinesByCompany: {
      ...current.ladderBaselinesByCompany,
      [claim.companyId]: confirmedCountAtCompany,
    },
    activeLadderPromotionByCompany: {
      ...current.activeLadderPromotionByCompany,
      [claim.companyId]: nextActiveId,
    },
    ladderCompletionsByCompany: {
      ...current.ladderCompletionsByCompany,
      [claim.companyId]: completionsAfter,
    },
  }

  await callCustomerGamificationApi('/claim-ladder', {
    companyId: claim.companyId,
    promotionId: claim.promotionId,
  })
  return next
}

export async function recordTimeLimitedPromotionClaim(
  _uid: string,
  claim: ClaimedPromotionRecord,
  current: CustomerGamificationState,
): Promise<CustomerGamificationState> {
  const next: CustomerGamificationState = {
    ...current,
    redemptionsCount: current.redemptionsCount + 1,
    claimedPromotions: [...current.claimedPromotions, claim],
  }

  if (!claim.reservationId) {
    throw new Error('La reserva es necesaria para registrar este canje.')
  }
  await callCustomerGamificationApi('/claim', {
    companyId: claim.companyId,
    promotionId: claim.promotionId,
    reservationId: claim.reservationId,
  })
  return next
}


export async function acknowledgeCelebrations(payload: {
  level?: number
  missionIds?: string[]
  bootstrapped?: boolean
}): Promise<void> {
  const body: Record<string, unknown> = {}

  if (typeof payload.level === 'number' && payload.level > 0) {
    body.level = payload.level
  }

  if (payload.missionIds && payload.missionIds.length > 0) {
    body.missionIds = [...new Set(payload.missionIds)]
  }

  if (payload.bootstrapped) {
    body.bootstrapped = true
  }

  await callCustomerGamificationApi('/acknowledge-level', body)
}

export async function acknowledgeLevelCelebration(
  _uid: string,
  current: CustomerGamificationState,
  celebratedUpToLevel: number,
): Promise<CustomerGamificationState> {
  await acknowledgeCelebrations({
    level: celebratedUpToLevel,
    missionIds: current.celebratedMissionIds,
    bootstrapped: current.celebrationsBootstrapped || celebratedUpToLevel > 0,
  })

  return {
    ...current,
    lastCelebratedLevel: celebratedUpToLevel,
    celebrationsBootstrapped: true,
  }
}

export async function fetchCustomerLeaderboard(
  scope: 'country' | 'world' = 'world',
): Promise<Array<{
  uid: string
  displayName: string
  xp: number
  photoUrl: string
  homeCountry: string
  homeCity: string
  isYou: boolean
  rank: number
}>> {
  const currentUser = auth.currentUser
  if (!currentUser) {
    return []
  }
  const token = await currentUser.getIdToken()
  const response = await fetch(
    `${API_BASE}/api/customer/gamification/leaderboard?scope=${encodeURIComponent(scope)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!response.ok) {
    throw new Error('No se pudo cargar el ranking.')
  }
  const payload = await response.json() as {
    entries?: Array<{
      uid: string
      displayName: string
      xp: number
      photoUrl: string
      homeCountry: string
      homeCity: string
      isYou: boolean
      rank: number
    }>
  }
  return payload.entries ?? []
}

async function callCustomerGamificationApi(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('Debes iniciar sesión como cliente.')
  }
  const token = await currentUser.getIdToken()
  const response = await fetch(`${API_BASE}/api/customer/gamification${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as {
    error?: string
    [key: string]: unknown
  }
  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo sincronizar el progreso.')
  }
  return data
}

export async function applyInventoryReservationToken(
  itemId: string,
  companyId: string,
): Promise<{
  visits: number
  coverCents: number
  remainderCents: number
  requiredCents: number
  inventory: Record<string, number>
  tokenCreditsByCompany: Record<string, number>
  pendingTokenSpend: CustomerGamificationState['pendingTokenSpend']
}> {
  const data = await callCustomerGamificationApi('/inventory/apply-token', {
    itemId,
    companyId,
  })
  return {
    visits: typeof data.visits === 'number' ? data.visits : 0,
    coverCents: typeof data.coverCents === 'number' ? data.coverCents : 0,
    remainderCents: typeof data.remainderCents === 'number' ? data.remainderCents : 0,
    requiredCents: typeof data.requiredCents === 'number' ? data.requiredCents : 0,
    inventory: data.inventory && typeof data.inventory === 'object'
      ? data.inventory as Record<string, number>
      : {},
    tokenCreditsByCompany: data.tokenCreditsByCompany && typeof data.tokenCreditsByCompany === 'object'
      ? data.tokenCreditsByCompany as Record<string, number>
      : {},
    pendingTokenSpend: Array.isArray(data.pendingTokenSpend)
      ? (data.pendingTokenSpend as CustomerGamificationState['pendingTokenSpend'])
      : [],
  }
}

export interface RegisterConsumptionInput {
  pin: string
  mode: 'products' | 'total' | 'skip'
  declaredTotalCents?: number
  productSelections?: Array<{ nodeId: string; quantity: number }>
}

export async function registerPromotionConsumption(
  companyId: string,
  payload: RegisterConsumptionInput,
  promotionId?: string,
): Promise<{
  visits: number
  tokenCreditsByCompany: Record<string, number>
}> {
  const data = await callCustomerGamificationApi('/promotions/register-consumption', {
    companyId,
    promotionId,
    pin: payload.pin,
    mode: payload.mode,
    declaredTotalCents: payload.declaredTotalCents,
    productSelections: payload.productSelections,
  })
  return {
    visits: typeof data.visits === 'number' ? data.visits : 1,
    tokenCreditsByCompany: data.tokenCreditsByCompany && typeof data.tokenCreditsByCompany === 'object'
      ? data.tokenCreditsByCompany as Record<string, number>
      : {},
  }
}

export async function fetchCustomerConsumptions(): Promise<CustomerVerifiedConsumption[]> {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('Debes iniciar sesión como cliente.')
  }
  const token = await currentUser.getIdToken()
  const response = await fetch(`${API_BASE}/api/customer/gamification/consumptions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = (await response.json().catch(() => ({}))) as {
    error?: string
    consumptions?: unknown
  }
  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo cargar tu consumo.')
  }

  return Array.isArray(data.consumptions)
    ? data.consumptions.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return []
      }
      const row = item as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id : ''
      const companyId = typeof row.companyId === 'string' ? row.companyId : ''
      const verifiedAt = typeof row.verifiedAt === 'string' ? row.verifiedAt : ''
      if (!id || !companyId || !verifiedAt) {
        return []
      }
      const mode = row.mode === 'products' || row.mode === 'skip' ? row.mode : 'total'
      const source = row.source === 'walk_in' ? 'walk_in' : 'reservation'
      return [{
        id,
        companyId,
        companyName: typeof row.companyName === 'string' && row.companyName.trim()
          ? row.companyName.trim()
          : 'Restaurante',
        companySlug: typeof row.companySlug === 'string' ? row.companySlug : '',
        photoUrl: typeof row.photoUrl === 'string' ? row.photoUrl : '',
        verifiedAt,
        visitAt: typeof row.visitAt === 'string' ? row.visitAt : verifiedAt,
        totalCents: typeof row.totalCents === 'number' ? row.totalCents : 0,
        mode,
        source,
        promotionId: typeof row.promotionId === 'string' ? row.promotionId : null,
        promotionTitle: typeof row.promotionTitle === 'string' ? row.promotionTitle : null,
        minimumSpendCents: typeof row.minimumSpendCents === 'number'
          ? Math.max(0, Math.round(row.minimumSpendCents))
          : 0,
        lineItems: Array.isArray(row.lineItems)
          ? row.lineItems.flatMap((line) => {
            if (!line || typeof line !== 'object') {
              return []
            }
            const entry = line as Record<string, unknown>
            const name = typeof entry.name === 'string' ? entry.name : ''
            const quantity = typeof entry.quantity === 'number' ? entry.quantity : 0
            if (!name || quantity < 1) {
              return []
            }
            return [{
              name,
              quantity,
              lineTotalCents: typeof entry.lineTotalCents === 'number' ? entry.lineTotalCents : 0,
            }]
          })
          : [],
        meetsMinimumSpend: row.meetsMinimumSpend === true,
      } satisfies CustomerVerifiedConsumption]
    })
    : []
}

export async function useInventoryItem(itemId: string): Promise<{
  message: string
  xpGained: number
  inventory: Record<string, number>
  xp: number
  cancellationStrikeCount: number
  promoLocked: boolean
}> {
  const data = await callCustomerGamificationApi('/inventory/use', { itemId })
  return {
    message: typeof data.message === 'string' ? data.message : 'Ítem usado.',
    xpGained: typeof data.xpGained === 'number' ? data.xpGained : 0,
    inventory: data.inventory && typeof data.inventory === 'object'
      ? data.inventory as Record<string, number>
      : {},
    xp: typeof data.xp === 'number' ? data.xp : 0,
    cancellationStrikeCount: typeof data.cancellationStrikeCount === 'number' ? data.cancellationStrikeCount : 0,
    promoLocked: data.promoLocked === true,
  }
}

export async function claimSeasonInventoryPack(pack: 'weekly_bonus' | 'weekly_clear' | 'monthly_clear'): Promise<{
  grants: Array<{ itemId: string; quantity: number }>
  inventory: Record<string, number>
  grantedItemKeys: string[]
}> {
  const data = await callCustomerGamificationApi('/inventory/claim-pack', { pack })
  return {
    grants: Array.isArray(data.grants)
      ? (data.grants as Array<{ itemId?: unknown; quantity?: unknown }>)
        .filter((entry) => typeof entry.itemId === 'string' && typeof entry.quantity === 'number')
        .map((entry) => ({ itemId: entry.itemId as string, quantity: Math.trunc(entry.quantity as number) }))
      : [],
    inventory: data.inventory && typeof data.inventory === 'object'
      ? data.inventory as Record<string, number>
      : {},
    grantedItemKeys: Array.isArray(data.grantedItemKeys)
      ? (data.grantedItemKeys as unknown[]).filter((key): key is string => typeof key === 'string')
      : [],
  }
}

export async function updateCustomerGamification(
  _uid: string,
  gamification: CustomerGamificationState,
): Promise<void> {
  await callCustomerGamificationApi('/sync', {
    gamification,
  })
}

/** @deprecated Usar syncInitialPasswordChange / API de auth. Escritura solo vía Admin SDK. */
export async function clearMustChangePassword(_uid: string): Promise<void> {
  throw new Error('El flag mustChangePassword solo se actualiza desde la API autenticada.')
}

/** @deprecated Usar syncInitialPasswordChange / API de auth. Escritura solo vía Admin SDK. */
export async function updateCompanyLoginPassword(
  _companyId: string,
  _newPassword: string,
): Promise<void> {
  throw new Error('La contraseña de empresa solo se actualiza desde la API autenticada.')
}

/** Marca que la empresa debe cambiar contraseña al entrar (admin o API). */
export async function markCompanyMustChangePassword(
  ownerUid: string,
  companyId: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', ownerUid), {
    mustChangePassword: true,
  })
  await updateDoc(doc(db, 'companyCredentials', companyId), {
    mustChangePassword: true,
    updatedAt: serverTimestamp(),
  })
}

export async function getCompanyCredentialsMustChange(
  companyId: string,
): Promise<boolean | null> {
  const snapshot = await getDoc(doc(db, 'companyCredentials', companyId))

  if (!snapshot.exists()) {
    return null
  }

  const value = snapshot.data().mustChangePassword

  if (value === true) {
    return true
  }

  if (value === false) {
    return false
  }

  return null
}

export async function getCompanyById(
  id: string,
  options?: { includePrivateOps?: boolean },
): Promise<Company | null> {
  if (isDemoCompanyId(id)) {
    return getDemoCompany()
  }

  const snapshot = await getDoc(doc(db, 'companies', id))

  if (!snapshot.exists()) {
    return null
  }

  const company = mapCompany(snapshot.id, snapshot.data())
  if (options?.includePrivateOps === false) {
    return company
  }
  return mergeCompanyPrivateOps(company)
}

async function mergeCompanyPrivateOps(company: Company): Promise<Company> {
  try {
    const opsSnap = await getDoc(doc(db, 'companies', company.id, 'private', 'ops'))
    if (!opsSnap.exists()) {
      return company
    }
    const ops = opsSnap.data()
    if (ops.emailTemplates) {
      company.emailTemplates = parseCompanyEmailTemplatesFromFirestore(ops.emailTemplates)
    }
    if (typeof ops.stripeAccountId === 'string') {
      company.stripeAccountId = ops.stripeAccountId
    }
    if (typeof ops.stripeChargesEnabled === 'boolean') {
      company.stripeChargesEnabled = ops.stripeChargesEnabled
    }
    if (typeof ops.stripePayoutsEnabled === 'boolean') {
      company.stripePayoutsEnabled = ops.stripePayoutsEnabled
    }
    if (typeof ops.stripeDetailsSubmitted === 'boolean') {
      company.stripeDetailsSubmitted = ops.stripeDetailsSubmitted
    }
  } catch {
    // Público no puede leer private/ops; el doc principal sigue sirviendo.
  }
  return company
}

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const snapshot = await getDocs(
    query(collection(db, 'companies'), where('slug', '==', slug)),
  )

  if (snapshot.empty) {
    return null
  }

  const docSnap = snapshot.docs[0]
  return mapCompany(docSnap.id, docSnap.data())
}

export async function getAllCompanies(): Promise<Company[]> {
  const snapshot = await getDocs(query(collection(db, 'companies'), limit(ADMIN_COMPANY_LIST_LIMIT)))

  return snapshot.docs
    .map((item) => mapCompany(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function getAdminCompanies(): Promise<AdminCompany[]> {
  const [companiesSnapshot, credentialsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'companies'), limit(ADMIN_COMPANY_LIST_LIMIT))),
    getDocs(query(collection(db, 'companyCredentials'), limit(ADMIN_COMPANY_LIST_LIMIT))),
  ])

  const credentialsByCompanyId = Object.fromEntries(
    credentialsSnapshot.docs.map((item) => [item.id, item.data()]),
  )

  const leftoverSecrets = credentialsSnapshot.docs.filter((item) =>
    'loginPassword' in item.data() || 'password' in item.data(),
  )
  if (leftoverSecrets.length > 0) {
    const batch = writeBatch(db)
    leftoverSecrets.slice(0, ADMIN_COMPANY_LIST_LIMIT).forEach((item) => {
      batch.update(item.ref, {
        loginPassword: deleteField(),
        password: deleteField(),
      })
    })
    void batch.commit().catch(() => undefined)
  }

  return companiesSnapshot.docs
    .map((item) => {
      const company = mapCompany(item.id, item.data())
      const credentials = credentialsByCompanyId[item.id]

      return {
        ...company,
        loginName: (credentials?.loginName as string) ?? company.name,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export interface CompanyReservationQuery {
  from?: Date
  to?: Date
  clientEmail?: string
  limitCount?: number
  skipCache?: boolean
}

const reservationQueryCache = new Map<string, { at: number; rows: Reservation[] }>()

export function invalidateCompanyReservationCache(companyId?: string) {
  if (!companyId) {
    reservationQueryCache.clear()
    return
  }
  for (const key of [...reservationQueryCache.keys()]) {
    if (key.startsWith(`${companyId}:`) || key.startsWith('customer:')) {
      reservationQueryCache.delete(key)
    }
  }
}

function inTimeRange(value: Date, from?: Date, to?: Date) {
  const time = value.getTime()
  if (from && time < from.getTime()) {
    return false
  }
  if (to && time >= to.getTime()) {
    return false
  }
  return true
}

export async function getReservationsByCompany(
  companyId: string,
  options?: CompanyReservationQuery,
): Promise<Reservation[]> {
  if (isDemoCompanyId(companyId)) {
    return filterDemoReservations({
      from: options?.from,
      to: options?.to,
      clientEmail: options?.clientEmail,
    })
  }

  const fromMs = options?.from?.getTime() ?? 0
  const toMs = options?.to?.getTime() ?? 0
  const emailKey = options?.clientEmail?.trim().toLowerCase() ?? ''
  const cacheKey = `${companyId}:${fromMs}:${toMs}:${emailKey}:${options?.limitCount ?? 'all'}`
  const cached = reservationQueryCache.get(cacheKey)
  if (!options?.skipCache && cached && Date.now() - cached.at < RESERVATION_QUERY_CACHE_MS) {
    return cached.rows
  }

  const constraints: QueryConstraint[] = [where('companyId', '==', companyId)]
  if (options?.from) {
    constraints.push(where('startTime', '>=', Timestamp.fromDate(options.from)))
  }
  if (options?.to) {
    constraints.push(where('startTime', '<', Timestamp.fromDate(options.to)))
  }
  if (emailKey) {
    constraints.push(where('clientEmail', '==', emailKey))
  }
  constraints.push(orderBy('startTime', 'asc'))
  const ranged = Boolean(options?.from || options?.to)
  const cap = ranged ? COMPANY_RESERVATION_RANGE_LIMIT : COMPANY_RESERVATION_QUERY_LIMIT
  const maxRows = Math.min(options?.limitCount ?? cap, cap)
  constraints.push(limit(maxRows))

  let snapshot
  try {
    snapshot = await getDocs(query(collection(db, 'reservations'), ...constraints))
  } catch {
    snapshot = await getDocs(query(
      collection(db, 'reservations'),
      where('companyId', '==', companyId),
      limit(maxRows),
    ))
  }

  let rows = snapshot.docs.map((item) => mapReservation(item.id, item.data()))
  if (options?.from || options?.to || emailKey) {
    rows = rows.filter((row) => {
      if (emailKey && row.clientEmail.trim().toLowerCase() !== emailKey) {
        return false
      }
      return inTimeRange(row.startTime, options?.from, options?.to)
    })
  }

  rows.sort((left, right) => left.startTime.getTime() - right.startTime.getTime())
  reservationQueryCache.set(cacheKey, { at: Date.now(), rows })
  return rows
}

export async function getVerifiedConsumptionsByCompany(
  companyId: string,
): Promise<VerifiedConsumptionRecord[]> {
  if (isDemoCompanyId(companyId)) {
    return getDemoVerifiedConsumptions()
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'companies', companyId, 'verifiedConsumptions'),
      orderBy('verifiedAt', 'desc'),
      limit(100),
    ),
  ).catch(() => getDocs(query(collection(db, 'companies', companyId, 'verifiedConsumptions'), limit(100))))

  return snapshot.docs
    .map((item) => mapVerifiedConsumptionDoc(item.id, item.data()))
    .filter((record): record is VerifiedConsumptionRecord => record !== null)
    .sort((left, right) => right.verifiedAt.getTime() - left.verifiedAt.getTime())
}

export async function getCustomerReservations(
  email: string,
  uid?: string,
): Promise<Reservation[]> {
  const normalizedEmail = email.trim().toLowerCase()
  const cacheKey = `customer:${uid ?? ''}:${normalizedEmail}`
  const cached = reservationQueryCache.get(cacheKey)
  if (cached && Date.now() - cached.at < RESERVATION_QUERY_CACHE_MS) {
    return cached.rows
  }

  const byId = new Map<string, Reservation>()
  let uidQuerySucceeded = false

  if (uid) {
    try {
      const uidSnapshot = await getDocs(
        query(
          collection(db, 'reservations'),
          where('customerUid', '==', uid),
          orderBy('createdAt', 'desc'),
          limit(CUSTOMER_RESERVATION_LIMIT),
        ),
      )
      uidSnapshot.docs.forEach((item) => {
        byId.set(item.id, mapReservation(item.id, item.data()))
      })
      uidQuerySucceeded = true
    } catch {
      try {
        const uidSnapshot = await getDocs(
          query(collection(db, 'reservations'), where('customerUid', '==', uid), limit(CUSTOMER_RESERVATION_LIMIT)),
        )
        uidSnapshot.docs.forEach((item) => {
          byId.set(item.id, mapReservation(item.id, item.data()))
        })
        uidQuerySucceeded = true
      } catch {
        // Índice o reglas aún no publicadas: se intenta por email.
      }
    }
  }

  if (normalizedEmail && (!uidQuerySucceeded || byId.size === 0) && byId.size < CUSTOMER_RESERVATION_LIMIT) {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'reservations'),
          where('clientEmail', '==', normalizedEmail),
          orderBy('createdAt', 'desc'),
          limit(CUSTOMER_RESERVATION_LIMIT),
        ),
      )
      snapshot.docs.forEach((item) => {
        if (!byId.has(item.id)) {
          byId.set(item.id, mapReservation(item.id, item.data()))
        }
      })
    } catch {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'reservations'),
            where('clientEmail', '==', normalizedEmail),
            limit(CUSTOMER_RESERVATION_LIMIT),
          ),
        )
        snapshot.docs.forEach((item) => {
          if (!byId.has(item.id)) {
            byId.set(item.id, mapReservation(item.id, item.data()))
          }
        })
      } catch {
        // Sin permiso o índice pendiente.
      }
    }
  }

  const rows = [...byId.values()].sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  reservationQueryCache.set(cacheKey, { at: Date.now(), rows })
  return rows
}

export function filterReservationsForDate(
  reservations: Reservation[],
  date: Date,
): Reservation[] {
  return reservations
    .filter((reservation) => isSameDay(reservation.startTime, date))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export function computeReservationCountsByMonth(
  reservations: Reservation[],
  year: number,
  month: number,
): Record<number, number> {
  return computeReservationCountsByMonthUtil(reservations, year, month)
}

export async function getReservationsForDate(
  companyId: string,
  date: Date,
  cachedReservations?: Reservation[],
): Promise<Reservation[]> {
  if (cachedReservations) {
    return filterReservationsForDate(cachedReservations, date)
  }
  const { start, end } = dayBounds(date)
  return getReservationsByCompany(companyId, { from: start, to: end })
}

function reservationFormToTimes(
  date: Date,
  form: ReservationFormData,
  durationMinutes: number,
) {
  const startTime = combineDateAndTime(date, form.time)
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000)
  return { startTime, endTime }
}

export async function createReservation(
  companyId: string,
  date: Date,
  form: ReservationFormData,
  durationMinutes: number,
  schedule: Company['schedule'],
  cachedDayReservations?: Reservation[],
): Promise<Reservation> {
  rejectIfDemoCompanyWrite(companyId)
  const bookingStatus: Reservation['status'] = 'completed'
  const dayReservations =
    cachedDayReservations ?? (await getReservationsForDate(companyId, date))

  assertReservationSlotValid(
    form.tableId,
    form.time,
    date,
    schedule,
    durationMinutes,
    durationMinutes,
    dayReservations,
    undefined,
    bookingStatus,
  )

  const { startTime, endTime } = reservationFormToTimes(date, form, durationMinutes)

  const currentUser = auth.currentUser

  if (currentUser) {
    try {
      const token = await currentUser.getIdToken()
      const response = await fetch(`${API_BASE}/api/company/${encodeURIComponent(companyId)}/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: dateToIsoDate(date),
          time: form.time,
          tableId: form.tableId,
          clientName: form.clientName.trim(),
          clientEmail: form.clientEmail.trim(),
          clientPhone: form.clientPhone.trim(),
          pax: form.pax,
          status: bookingStatus,
          notes: '',
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        id?: string
        error?: string
      }

      if (response.ok && data.id) {
        invalidateCompanyReservationCache(companyId)
        return {
          id: data.id,
          companyId,
          tableId: form.tableId,
          clientName: form.clientName.trim(),
          clientEmail: form.clientEmail.trim(),
          clientPhone: form.clientPhone.trim(),
          pax: form.pax,
          startTime,
          endTime,
          status: bookingStatus,
          notes: '',
          cancelToken: generateUuid(),
          createdAt: new Date(),
        }
      }

      throw new Error(data.error || 'No se pudo crear la reserva.')
    } catch (apiError) {
      if (apiError instanceof Error && apiError.message.trim()) {
        throw apiError
      }
      throw new Error('No se pudo crear la reserva.')
    }
  }

  throw new Error('Inicia sesión para crear la reserva.')
}

export async function updateReservation(
  reservationId: string,
  companyId: string,
  date: Date,
  form: ReservationFormData,
  durationMinutes: number,
  schedule: Company['schedule'],
  cachedDayReservations?: Reservation[],
): Promise<Reservation> {
  rejectIfDemoCompanyWrite(companyId)
  const dayReservations =
    cachedDayReservations ?? (await getReservationsForDate(companyId, date))

  assertReservationSlotValid(
    form.tableId,
    form.time,
    date,
    schedule,
    durationMinutes,
    durationMinutes,
    dayReservations,
    reservationId,
    form.status,
  )

  const { startTime, endTime } = reservationFormToTimes(date, form, durationMinutes)

  await updateDoc(doc(db, 'reservations', reservationId), {
    tableId: form.tableId,
    clientName: form.clientName.trim(),
    clientEmail: form.clientEmail.trim(),
    clientPhone: form.clientPhone.trim(),
    pax: form.pax,
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: form.status,
  })

  const existing = dayReservations.find((item) => item.id === reservationId)
  invalidateCompanyReservationCache(companyId)

  return {
    id: reservationId,
    companyId,
    tableId: form.tableId,
    clientName: form.clientName.trim(),
    clientEmail: form.clientEmail.trim(),
    clientPhone: form.clientPhone.trim(),
    pax: form.pax,
    startTime,
    endTime,
    status: form.status,
    notes: existing?.notes ?? '',
    cancelToken: existing?.cancelToken ?? '',
    createdAt: existing?.createdAt ?? new Date(),
  }
}

export async function updateReservationStatus(
  reservationId: string,
  status: 'confirmed' | 'cancelled',
  options?: { promotionVisitStatus?: PromotionVisitStatus },
): Promise<void> {
  rejectIfDemoCompanyWrite()
  const update: Record<string, unknown> = { status }

  if (status === 'cancelled') {
    update.cancelledBy = 'restaurant'
    update.cancelShieldRequested = true
  }

  if (options?.promotionVisitStatus) {
    update.promotionVisitStatus = options.promotionVisitStatus
  }

  await updateDoc(doc(db, 'reservations', reservationId), update)
  invalidateCompanyReservationCache()

  if (status === 'confirmed') {
    await notifyReservationConfirmationEmail(reservationId)
  }

  if (status === 'cancelled') {
    await notifyReservationCancelledNotification(reservationId, 'restaurant')
  }
}

export async function updateReservationPromotionVisitStatus(
  reservationId: string,
  promotionVisitStatus: PromotionVisitStatus,
): Promise<void> {
  rejectIfDemoCompanyWrite()
  await updateDoc(doc(db, 'reservations', reservationId), { promotionVisitStatus })
}

export async function deleteReservation(reservationId: string): Promise<void> {
  rejectIfDemoCompanyWrite()
  await deleteDoc(doc(db, 'reservations', reservationId))
  invalidateCompanyReservationCache()
}

export async function getReservationCountsByMonth(
  companyId: string,
  year: number,
  month: number,
  cachedReservations?: Reservation[],
): Promise<Record<number, number>> {
  if (cachedReservations) {
    return computeReservationCountsByMonth(cachedReservations, year, month)
  }
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)
  const rows = await getReservationsByCompany(companyId, { from: start, to: end })
  return computeReservationCountsByMonth(rows, year, month)
}

export async function getTableNamesByCompany(
  companyId: string,
): Promise<Record<string, string>> {
  const tables = await getTablesByCompany(companyId)
  return Object.fromEntries(tables.map((table) => [table.id, table.name]))
}

export async function getTablesByCompany(companyId: string): Promise<RestaurantTable[]> {
  if (isDemoCompanyId(companyId)) {
    return getDemoTables()
  }

  const snapshot = await getDocs(
    query(collection(db, 'tables'), where('companyId', '==', companyId), limit(COMPANY_TABLE_LIMIT)),
  )

  return snapshot.docs
    .map((item) => mapTable(item.id, item.data()))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
}

export function tablesToMeta(
  tables: RestaurantTable[],
): Record<string, { name: string; capacity: number }> {
  return Object.fromEntries(
    tables.map((table) => [table.id, { name: table.name, capacity: table.capacity }]),
  )
}

export async function getTableMetaByCompany(
  companyId: string,
): Promise<Record<string, { name: string; capacity: number }>> {
  const tables = await getTablesByCompany(companyId)
  return tablesToMeta(tables)
}

export async function updateCompanySettings(
  companyId: string,
  payload: CompanySettingsPayload,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const normalizedPayload = normalizeCompanySettingsPayload(payload)

  const trimmedName = normalizedPayload.name.trim()
  const companySnap = await getDoc(doc(db, 'companies', companyId))
  const credentialsSnap = await getDoc(doc(db, 'companyCredentials', companyId))
  const currentName = ((companySnap.data()?.name as string) ?? '').trim()
  const nameChanged = trimmedName !== currentName
  const ownerUid = companySnap.data()?.ownerUid as string | undefined
  const authEmail =
    (credentialsSnap.data()?.authEmail as string | undefined) ??
    slugToAuthEmail(companySnap.data()?.slug as string)

  const batch = writeBatch(db)

  batch.update(doc(db, 'companies', companyId), {
    name: trimmedName,
    contactEmail: normalizedPayload.contactEmail,
    phone: normalizedPayload.phone,
    website: normalizedPayload.website,
    location: normalizedPayload.location,
    municipality: normalizedPayload.municipality,
    country: normalizedPayload.country,
    postalCode: normalizedPayload.postalCode,
    latitude: normalizedPayload.latitude,
    longitude: normalizedPayload.longitude,
    description: normalizedPayload.description,
    logoUrl: normalizedPayload.logoUrl,
    photos: normalizedPayload.photos,
    mainPhotoIndex: normalizedPayload.mainPhotoIndex,
    videos: normalizedPayload.videos,
    characteristics: normalizedPayload.characteristics,
    venueTypes: normalizedPayload.venueTypes,
    amenities: normalizedPayload.amenities,
    priceRange: normalizedPayload.priceRange,
    timeSlotMinutes: normalizedPayload.timeSlotMinutes,
    reservationMode: normalizedPayload.reservationMode,
    depositMinPax: normalizedPayload.depositMinPax,
    depositPerGuestCents: normalizedPayload.depositPerGuestCents,
    depositEnabled: normalizedPayload.depositEnabled,
    depositCancellationHours: normalizedPayload.depositCancellationHours,
    schedule: normalizedPayload.schedule,
    turns: normalizedPayload.turns,
    floorPlan: serializeFloorPlanForFirestore(normalizedPayload.floorPlan),
    floorPlans: serializeFloorPlansForFirestore(normalizedPayload.floorPlans),
    updatedAt: serverTimestamp(),
  })

  if (nameChanged) {
    batch.update(doc(db, 'companyCredentials', companyId), {
      loginName: trimmedName,
      updatedAt: serverTimestamp(),
    })

    if (ownerUid) {
      batch.update(doc(db, 'users', ownerUid), {
        loginName: trimmedName,
      })
    }
  }

  await batch.commit()

  if (nameChanged && authEmail) {
    await syncCompanyLoginIndex(trimmedName, authEmail, companyId)
  }

  const indexed = await getCompanyById(companyId)
  if (indexed) {
    const { syncRestaurantIndexFromCompany } = await import('./restaurantIndex')
    await syncRestaurantIndexFromCompany(indexed).catch(() => undefined)
  }
}

/**
 * Activa o desactiva la ficha pública del restaurante. Desactivado = fuera de
 * descubrir, sin página de reservas y sin promociones para los clientes. El
 * dueño sigue con acceso completo al panel y puede reactivar cuando quiera.
 */
export async function setCompanyPublicVisibility(
  companyId: string,
  deactivated: boolean,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)

  await updateDoc(doc(db, 'companies', companyId), {
    deactivated,
    deactivatedAt: deactivated ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  })

  const indexed = await getCompanyById(companyId)
  if (indexed) {
    const { syncRestaurantIndexFromCompany } = await import('./restaurantIndex')
    await syncRestaurantIndexFromCompany(indexed).catch(() => undefined)
  }
}

export async function updateCompanyEmailTemplates(
  companyId: string,
  templates: CompanyEmailTemplates,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const normalized = normalizeCompanyEmailTemplates(templates)
  const payload = {
    emailTemplates: normalized,
    updatedAt: serverTimestamp(),
  }

  await setDoc(doc(db, 'companies', companyId, 'private', 'ops'), payload, { merge: true })
}

export async function updateCompanyFloorPlan(
  companyId: string,
  floorPlan: import('../types/company').FloorPlan,
): Promise<void> {
  await updateCompanyFloorPlans(companyId, [floorPlan])
}

export async function updateCompanyFloorPlans(
  companyId: string,
  floorPlans: import('../types/company').FloorPlan[],
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const plans = floorPlans.length > 0 ? floorPlans : [parseFloorPlan(undefined)]
  await updateDoc(doc(db, 'companies', companyId), {
    floorPlan: serializeFloorPlanForFirestore(primaryFloorPlan(plans)),
    floorPlans: serializeFloorPlansForFirestore(plans),
    updatedAt: serverTimestamp(),
  })
}

export async function updateCompanyQrBranding(
  companyId: string,
  kind: QrBrandingKind,
  config: QrBrandingConfig,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const companySnap = await getDoc(doc(db, 'companies', companyId))
  const currentBranding = parseCompanyQrBranding(companySnap.data()?.qrBranding)
  const normalizedConfig = normalizeQrBrandingConfig(config)

  await updateDoc(doc(db, 'companies', companyId), {
    qrBranding: serializeCompanyQrBranding({
      ...currentBranding,
      [kind]: normalizedConfig,
    }),
    updatedAt: serverTimestamp(),
  })
}

export async function replaceCompanyTables(
  companyId: string,
  tables: TableInput[],
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const existing = await getDocs(
    query(collection(db, 'tables'), where('companyId', '==', companyId), limit(COMPANY_TABLE_LIMIT)),
  )

  const batch = writeBatch(db)

  existing.docs.forEach((item) => {
    batch.delete(item.ref)
  })

  tables.forEach((table, index) => {
    const ref = table.id ? doc(db, 'tables', table.id) : doc(collection(db, 'tables'))
    batch.set(ref, {
      companyId,
      name: table.name.trim(),
      capacity: table.capacity,
      sortOrder: index,
      floorPlanId: table.floorPlanId?.trim() || '',
    })
  })

  await batch.commit()
}

function mapCompany(id: string, data: Record<string, unknown>): Company {
  const floorPlans = parseFloorPlans(data.floorPlans, data.floorPlan)
  return {
    id,
    name: data.name as string,
    slug: data.slug as string,
    ownerUid: data.ownerUid as string,
    phone: (data.phone as string) ?? '',
    website: (data.website as string) ?? '',
    location: (data.location as string) ?? '',
    municipality: (data.municipality as string) ?? '',
    country: (data.country as string) ?? '',
    postalCode: (data.postalCode as string) ?? '',
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
    description: (data.description as string) ?? '',
    contactEmail: (data.contactEmail as string) ?? '',
    logoUrl: (data.logoUrl as string) ?? '',
    photos: Array.isArray(data.photos) ? (data.photos as string[]).slice(0, 5) : [],
    mainPhotoIndex: typeof data.mainPhotoIndex === 'number'
      ? Math.max(0, Math.min(4, Math.trunc(data.mainPhotoIndex)))
      : 0,
    videos: Array.isArray(data.videos) ? (data.videos as string[]).slice(0, 2) : [],
    ...(() => {
      const rawCharacteristics = Array.isArray(data.characteristics)
        ? (data.characteristics as string[]).slice(0, 20)
        : []
      const parsed = parseCompanyProfileFacilities(data, rawCharacteristics)
      return {
        characteristics: parsed.characteristics.slice(0, MAX_COMPANY_CHARACTERISTICS),
        venueTypes: parsed.venueTypes,
        amenities: parsed.amenities,
        priceRange: parsed.priceRange,
      }
    })(),
    timeSlotMinutes: (data.timeSlotMinutes as number) ?? 120,
    reservationMode: parseCompanyReservationMode(data.reservationMode),
    depositMinPax: typeof data.depositMinPax === 'number' && data.depositMinPax > 0
      ? Math.trunc(data.depositMinPax)
      : null,
    depositPerGuestCents: typeof data.depositPerGuestCents === 'number' && data.depositPerGuestCents > 0
      ? Math.trunc(data.depositPerGuestCents)
      : null,
    depositEnabled: data.depositEnabled === true
      || (typeof data.depositMinPax === 'number' && data.depositMinPax > 0),
    depositCancellationHours: typeof data.depositCancellationHours === 'number'
      && data.depositCancellationHours > 0
      ? Math.trunc(data.depositCancellationHours)
      : null,
    schedule: normalizeCompanySchedule((data.schedule as Company['schedule']) ?? defaultSchedule()),
    turns: (data.turns as Company['turns']) ?? defaultTurns(),
    floorPlan: primaryFloorPlan(floorPlans),
    floorPlans,
    emailTemplates: parseCompanyEmailTemplatesFromFirestore(data.emailTemplates),
    qrBranding: parseCompanyQrBranding(data.qrBranding),
    ...parseCompanyReviewStats(data),
    stripeAccountId: typeof data.stripeAccountId === 'string' ? data.stripeAccountId : null,
    stripeChargesEnabled: data.stripeChargesEnabled === true,
    stripePayoutsEnabled: data.stripePayoutsEnabled === true,
    stripeDetailsSubmitted: data.stripeDetailsSubmitted === true,
    ...(() => {
      const planId = parseCompanyPlanId(data.planId)
      return {
        planId,
        planBilling: parseCompanyPlanBilling(data.planBilling, planId),
        planStartedAt: planId === 'free' ? null : parseCompanyPlanStartedAt(data.planStartedAt),
        planLastPaidAt: planId === 'free' ? null : parseCompanyPlanStartedAt(data.planLastPaidAt),
        pendingPlanId: data.pendingPlanId ? parseCompanyPlanId(data.pendingPlanId) : null,
        pendingPlanAt: parseCompanyPlanStartedAt(data.pendingPlanAt),
        discoveryFeatured: data.discoveryFeatured === true,
      }
    })(),
    deactivated: data.deactivated === true,
    deactivatedAt: (data.deactivatedAt as { toDate?: () => Date })?.toDate?.() ?? null,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  }
}

function mapTable(id: string, data: Record<string, unknown>): RestaurantTable {
  return {
    id,
    companyId: data.companyId as string,
    name: data.name as string,
    capacity: (data.capacity as number) ?? 2,
    sortOrder: (data.sortOrder as number) ?? 0,
    floorPlanId: typeof data.floorPlanId === 'string' ? data.floorPlanId : '',
  }
}

function mapMinSpendVerification(
  data: unknown,
): Reservation['minSpendVerification'] {
  if (!data || typeof data !== 'object') {
    return undefined
  }

  const record = data as Record<string, unknown>
  const lineItemsRaw = Array.isArray(record.lineItems) ? record.lineItems : []
  const lineItems = lineItemsRaw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const line = item as Record<string, unknown>
      const nodeId = typeof line.nodeId === 'string' ? line.nodeId : ''
      const name = typeof line.name === 'string' ? line.name : ''
      const quantity = typeof line.quantity === 'number' ? line.quantity : 0
      const unitPriceCents = typeof line.unitPriceCents === 'number' ? line.unitPriceCents : 0
      const lineTotalCents = typeof line.lineTotalCents === 'number' ? line.lineTotalCents : 0

      if (!nodeId || quantity < 1) {
        return null
      }

      return { nodeId, name, quantity, unitPriceCents, lineTotalCents }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const mode = record.mode === 'products' ? 'products' : record.mode === 'total' ? 'total' : null
  const totalCents = typeof record.totalCents === 'number' ? record.totalCents : null
  const meetsMinimumSpend = record.meetsMinimumSpend === true

  if (!mode || totalCents == null) {
    return undefined
  }

  const verifiedAt = (record.verifiedAt as { toDate?: () => Date })?.toDate?.()
    ?? (typeof record.verifiedAt === 'string' ? new Date(record.verifiedAt) : null)

  if (!verifiedAt || Number.isNaN(verifiedAt.getTime())) {
    return undefined
  }

  return {
    mode,
    totalCents,
    lineItems,
    verifiedAt,
    meetsMinimumSpend,
  }
}

function mapReservation(id: string, data: Record<string, unknown>): Reservation {
  const minimumSpendCents =
    typeof data.minimumSpendCents === 'number' ? data.minimumSpendCents : null
  const promotionVisitStatus = data.promotionVisitStatus as PromotionVisitStatus | undefined

  return {
    id,
    companyId: data.companyId as string,
    tableId: data.tableId as string,
    clientName: data.clientName as string,
    clientEmail: data.clientEmail as string,
    clientPhone: data.clientPhone as string,
    pax: data.pax as number,
    notes: (data.notes as string) ?? '',
    startTime: (data.startTime as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    endTime: (data.endTime as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    status: data.status as ReservationStatus,
    cancelToken: data.cancelToken as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    customerUid: typeof data.customerUid === 'string' ? data.customerUid : null,
    promotionId: typeof data.promotionId === 'string' ? data.promotionId : null,
    minimumSpendCents,
    promotionVisitStatus,
    minSpendVerification: mapMinSpendVerification(data.minSpendVerification),
    depositAmountCents: typeof data.depositAmountCents === 'number' ? data.depositAmountCents : null,
    depositPaymentIntentId: typeof data.depositPaymentIntentId === 'string'
      ? data.depositPaymentIntentId
      : null,
    depositStatus: typeof data.depositStatus === 'string'
      ? data.depositStatus as Reservation['depositStatus']
      : null,
  }
}

export { getFirestoreErrorMessage } from './firestoreErrors'
