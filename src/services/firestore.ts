import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
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
import type { VerifiedConsumptionRecord } from '../types/verifiedConsumption'
import { parseCompanyReviewStats } from '../types/review'
import { mapVerifiedConsumptionDoc } from '../utils/productReports'
import type { PublicPromotion } from './publicPromotions'
import { getNextLadderPromotionId, sortCompanyLadderPromotions } from '../utils/promotionReservationProgress'
import { defaultTurns, parseFloorPlan, serializeFloorPlanForFirestore } from '../types/company'
import {
  normalizeCompanyEmailTemplates,
  parseCompanyEmailTemplatesFromFirestore,
} from '../utils/emailTemplates'
import {
  assertReservationSlotValid,
  computeReservationCountsByMonth as computeReservationCountsByMonthUtil,
} from '../utils/reservationSlots'
import { combineDateAndTime, dateToIsoDate, defaultSchedule, generateUuid, isSameDay, slugToAuthEmail, slugify } from '../utils/helpers'
import { normalizeCompanySchedule } from '../utils/schedule'
import {
  normalizeCompanySettingsPayload,
} from '../utils/companyValidation'
import { notifyReservationCancelledNotification, notifyReservationConfirmationEmail, notifyReservationReceivedEmail, syncReservationClient } from './reservationEmailApi'
import { upsertCompanyClientFromReservation } from './companyClients'
import type { QrBrandingConfig, QrBrandingKind } from '../types/company'
import {
  normalizeQrBrandingConfig,
  parseCompanyQrBranding,
  serializeCompanyQrBranding,
} from '../utils/qrBranding'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function syncCompanyLoginIndex(
  loginName: string,
  authEmail: string,
  companyId?: string,
): Promise<void> {
  const trimmed = loginName.trim()
  const loginId = slugify(trimmed)
  const batch = writeBatch(db)

  const stale = await getDocs(
    query(collection(db, 'logins'), where('authEmail', '==', authEmail)),
  )

  stale.docs.forEach((item) => {
    if (item.id !== loginId) {
      batch.delete(item.ref)
    }
  })

  batch.set(doc(db, 'logins', loginId), {
    loginName: trimmed,
    authEmail,
    role: 'company',
    ...(companyId ? { companyId } : {}),
  })

  await batch.commit()
}

async function getCompanyAuthEmail(companyId: string): Promise<string | null> {
  try {
    const credentialsSnap = await getDoc(doc(db, 'companyCredentials', companyId))

    if (!credentialsSnap.exists()) {
      return null
    }

    return (credentialsSnap.data().authEmail as string | undefined) ?? null
  } catch {
    return null
  }
}

export async function resolveLoginAuthEmail(username: string): Promise<string> {
  const trimmed = username.trim()

  if (!trimmed) {
    throw new Error('Indica tu nombre de usuario.')
  }

  const normalized = slugify(trimmed)
  const loginSnap = await getDoc(doc(db, 'logins', normalized))

  if (loginSnap.exists()) {
    const authEmail = loginSnap.data().authEmail as string | undefined

    if (authEmail) {
      return authEmail
    }
  }

  const companyBySlug = await getDocs(
    query(collection(db, 'companies'), where('slug', '==', normalized)),
  )

  if (!companyBySlug.empty) {
    const companyId = companyBySlug.docs[0].id
    const credentialsAuthEmail = await getCompanyAuthEmail(companyId)

    if (credentialsAuthEmail) {
      return credentialsAuthEmail
    }

    return slugToAuthEmail(normalized)
  }

  return slugToAuthEmail(normalized)
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

  await syncCompanyLoginIndex(loginName, authEmail, companyId)
}

/** Sincroniza el índice de acceso de todas las empresas (solo admin). */
export async function syncAllCompanyLoginIndexes(): Promise<void> {
  const [companiesSnap, credentialsSnap] = await Promise.all([
    getDocs(collection(db, 'companies')),
    getDocs(collection(db, 'companyCredentials')),
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
  const snapshot = await getDoc(doc(db, 'users', uid))

  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data()

  return {
    email: data.email as string,
    role: data.role as AppUser['role'],
    companyId: (data.companyId as string | null) ?? null,
    displayName: (data.displayName as string) ?? '',
    favoriteSlugs: Array.isArray(data.favoriteSlugs) ? (data.favoriteSlugs as string[]) : [],
    gamification: parseGamificationData(data),
    mustChangePassword: data.mustChangePassword === true,
    mustChangePasswordCleared: data.mustChangePassword === false,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
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
  }
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
    lastCelebratedLevel: typeof gamification.lastCelebratedLevel === 'number'
      ? gamification.lastCelebratedLevel
      : null,
  }
}

export async function recordPromotionClaim(
  uid: string,
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

  await updateCustomerGamification(uid, next)
  return next
}

export async function recordTimeLimitedPromotionClaim(
  uid: string,
  claim: ClaimedPromotionRecord,
  current: CustomerGamificationState,
): Promise<CustomerGamificationState> {
  const next: CustomerGamificationState = {
    ...current,
    redemptionsCount: current.redemptionsCount + 1,
    claimedPromotions: [...current.claimedPromotions, claim],
  }

  await updateCustomerGamification(uid, next)
  return next
}


export async function acknowledgeLevelCelebration(
  uid: string,
  current: CustomerGamificationState,
  celebratedUpToLevel: number,
): Promise<CustomerGamificationState> {
  const next: CustomerGamificationState = {
    ...current,
    lastCelebratedLevel: celebratedUpToLevel,
  }

  await updateCustomerGamification(uid, next)
  return next
}

export async function updateCustomerGamification(
  uid: string,
  gamification: CustomerGamificationState,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    gamification,
    xp: gamification.xp,
    adelinas: gamification.adelinas,
  })
}

export async function clearMustChangePassword(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    mustChangePassword: false,
  })
}

export async function updateCompanyLoginPassword(
  companyId: string,
  newPassword: string,
): Promise<void> {
  await updateDoc(doc(db, 'companyCredentials', companyId), {
    loginPassword: newPassword,
    mustChangePassword: false,
    updatedAt: serverTimestamp(),
  })
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

export async function getCompanyById(id: string): Promise<Company | null> {
  const snapshot = await getDoc(doc(db, 'companies', id))

  if (!snapshot.exists()) {
    return null
  }

  return mapCompany(snapshot.id, snapshot.data())
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
  const snapshot = await getDocs(collection(db, 'companies'))

  return snapshot.docs
    .map((item) => mapCompany(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function getAdminCompanies(): Promise<AdminCompany[]> {
  const [companiesSnapshot, credentialsSnapshot] = await Promise.all([
    getDocs(collection(db, 'companies')),
    getDocs(collection(db, 'companyCredentials')),
  ])

  const credentialsByCompanyId = Object.fromEntries(
    credentialsSnapshot.docs.map((item) => [item.id, item.data()]),
  )

  return companiesSnapshot.docs
    .map((item) => {
      const company = mapCompany(item.id, item.data())
      const credentials = credentialsByCompanyId[item.id]

      return {
        ...company,
        loginName: (credentials?.loginName as string) ?? company.name,
        loginPassword: (credentials?.loginPassword as string) ?? '—',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function getReservationsByCompany(companyId: string): Promise<Reservation[]> {
  const snapshot = await getDocs(
    query(collection(db, 'reservations'), where('companyId', '==', companyId)),
  )

  return snapshot.docs
    .map((item) => mapReservation(item.id, item.data()))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

export async function getVerifiedConsumptionsByCompany(
  companyId: string,
): Promise<VerifiedConsumptionRecord[]> {
  const snapshot = await getDocs(collection(db, 'companies', companyId, 'verifiedConsumptions'))

  return snapshot.docs
    .map((item) => mapVerifiedConsumptionDoc(item.id, item.data()))
    .filter((record): record is VerifiedConsumptionRecord => record !== null)
    .sort((left, right) => right.verifiedAt.getTime() - left.verifiedAt.getTime())
}

export async function getCustomerReservations(email: string): Promise<Reservation[]> {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    return []
  }

  const snapshot = await getDocs(
    query(collection(db, 'reservations'), where('clientEmail', '==', normalizedEmail)),
  )

  return snapshot.docs
    .map((item) => mapReservation(item.id, item.data()))
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
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
  const all = cachedReservations ?? (await getReservationsByCompany(companyId))
  return filterReservationsForDate(all, date)
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

      if (response.status >= 400 && response.status < 500 && data.error) {
        throw new Error(data.error)
      }
    } catch (apiError) {
      if (apiError instanceof Error && apiError.message.trim()) {
        throw apiError
      }
    }
  }

  const cancelToken = generateUuid()

  const docRef = await addDoc(collection(db, 'reservations'), {
    companyId,
    tableId: form.tableId,
    clientName: form.clientName.trim(),
    clientEmail: form.clientEmail.trim(),
    clientPhone: form.clientPhone.trim(),
    pax: form.pax,
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: bookingStatus,
    notes: '',
    cancelToken,
    createdAt: serverTimestamp(),
  })

  if (form.clientEmail.trim()) {
    await upsertCompanyClientFromReservation(companyId, docRef.id, {
      clientEmail: form.clientEmail,
      clientName: form.clientName,
      clientPhone: form.clientPhone,
      reservationDate: new Date(),
    }).catch(() => syncReservationClient(docRef.id))
  }

  if (form.clientEmail.trim()) {
    await notifyReservationReceivedEmail(docRef.id)
  }

  return {
    id: docRef.id,
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
    cancelToken,
    createdAt: new Date(),
  }
}

export interface PublicReservationInput {
  clientName: string
  clientEmail: string
  clientPhone: string
  pax: number
  tableId: string
  time: string
  notes: string
}

export async function createPublicReservation(
  companyId: string,
  date: Date,
  input: PublicReservationInput,
  durationMinutes: number,
  schedule: Company['schedule'],
  cachedDayReservations?: Reservation[],
): Promise<Reservation> {
  const dayReservations =
    cachedDayReservations ?? (await getReservationsForDate(companyId, date))

  assertReservationSlotValid(
    input.tableId,
    input.time,
    date,
    schedule,
    durationMinutes,
    durationMinutes,
    dayReservations,
    undefined,
    'completed',
  )

  const form: ReservationFormData = {
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    pax: Math.trunc(input.pax),
    tableId: input.tableId,
    time: input.time,
    status: 'completed',
  }

  const { startTime, endTime } = reservationFormToTimes(date, form, durationMinutes)
  const cancelToken = generateUuid()

  const docRef = await addDoc(collection(db, 'reservations'), {
    companyId,
    tableId: input.tableId,
    clientName: input.clientName.trim(),
    clientEmail: input.clientEmail.trim(),
    clientPhone: input.clientPhone.trim(),
    pax: Math.trunc(input.pax),
    notes: input.notes.trim(),
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    status: 'completed',
    cancelToken,
    createdAt: serverTimestamp(),
  })

  await syncReservationClient(docRef.id)
  await notifyReservationReceivedEmail(docRef.id)

  return {
    id: docRef.id,
    companyId,
    tableId: input.tableId,
    clientName: input.clientName.trim(),
    clientEmail: input.clientEmail.trim(),
    clientPhone: input.clientPhone.trim(),
    pax: Math.trunc(input.pax),
    notes: input.notes.trim(),
    startTime,
    endTime,
    status: 'completed',
    cancelToken,
    createdAt: new Date(),
  }
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
  const update: Record<string, unknown> = { status }

  if (status === 'cancelled') {
    update.cancelledBy = 'restaurant'
  }

  if (options?.promotionVisitStatus) {
    update.promotionVisitStatus = options.promotionVisitStatus
  }

  await updateDoc(doc(db, 'reservations', reservationId), update)

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
  await updateDoc(doc(db, 'reservations', reservationId), { promotionVisitStatus })
}

export async function deleteReservation(reservationId: string): Promise<void> {
  await deleteDoc(doc(db, 'reservations', reservationId))
}

export async function getReservationCountsByMonth(
  companyId: string,
  year: number,
  month: number,
  cachedReservations?: Reservation[],
): Promise<Record<number, number>> {
  const all = cachedReservations ?? (await getReservationsByCompany(companyId))
  return computeReservationCountsByMonth(all, year, month)
}

export async function getTableNamesByCompany(
  companyId: string,
): Promise<Record<string, string>> {
  const tables = await getTablesByCompany(companyId)
  return Object.fromEntries(tables.map((table) => [table.id, table.name]))
}

export async function getTablesByCompany(companyId: string): Promise<RestaurantTable[]> {
  const snapshot = await getDocs(
    query(collection(db, 'tables'), where('companyId', '==', companyId)),
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
    timeSlotMinutes: normalizedPayload.timeSlotMinutes,
    depositMinPax: normalizedPayload.depositMinPax,
    depositPerGuestCents: normalizedPayload.depositPerGuestCents,
    depositEnabled: normalizedPayload.depositEnabled,
    depositCancellationHours: normalizedPayload.depositCancellationHours,
    schedule: normalizedPayload.schedule,
    turns: normalizedPayload.turns,
    floorPlan: serializeFloorPlanForFirestore(normalizedPayload.floorPlan),
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
}

export async function updateCompanyEmailTemplates(
  companyId: string,
  templates: CompanyEmailTemplates,
): Promise<void> {
  const normalized = normalizeCompanyEmailTemplates(templates)

  await updateDoc(doc(db, 'companies', companyId), {
    emailTemplates: normalized,
    updatedAt: serverTimestamp(),
  })
}

export async function updateCompanyFloorPlan(
  companyId: string,
  floorPlan: import('../types/company').FloorPlan,
): Promise<void> {
  await updateDoc(doc(db, 'companies', companyId), {
    floorPlan: serializeFloorPlanForFirestore(floorPlan),
    updatedAt: serverTimestamp(),
  })
}

export async function updateCompanyQrBranding(
  companyId: string,
  kind: QrBrandingKind,
  config: QrBrandingConfig,
): Promise<void> {
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
  const existing = await getDocs(
    query(collection(db, 'tables'), where('companyId', '==', companyId)),
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
    })
  })

  await batch.commit()
}

function mapCompany(id: string, data: Record<string, unknown>): Company {
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
    characteristics: Array.isArray(data.characteristics)
      ? (data.characteristics as string[]).slice(0, 5)
      : [],
    timeSlotMinutes: (data.timeSlotMinutes as number) ?? 120,
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
    floorPlan: parseFloorPlan(data.floorPlan),
    emailTemplates: parseCompanyEmailTemplatesFromFirestore(data.emailTemplates),
    qrBranding: parseCompanyQrBranding(data.qrBranding),
    ...parseCompanyReviewStats(data),
    stripeAccountId: typeof data.stripeAccountId === 'string' ? data.stripeAccountId : null,
    stripeChargesEnabled: data.stripeChargesEnabled === true,
    stripePayoutsEnabled: data.stripePayoutsEnabled === true,
    stripeDetailsSubmitted: data.stripeDetailsSubmitted === true,
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
