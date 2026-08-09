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
  Reservation,
  ReservationFormData,
  ReservationStatus,
  RestaurantTable,
  TableInput,
} from '../types'
import { defaultGamificationState } from '../types/gamification'
import type { CustomerGamificationState, ClaimedPromotionRecord } from '../types/gamification'
import type { PublicPromotion } from './publicPromotions'
import { getNextLadderPromotionId } from '../utils/promotionReservationProgress'
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
import { notifyReservationConfirmationEmail, notifyReservationReceivedEmail, syncReservationClient } from './reservationEmailApi'
import { upsertCompanyClientFromReservation } from './companyClients'

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

  const byLoginName = await getDocs(
    query(collection(db, 'logins'), where('loginName', '==', trimmed)),
  )

  if (!byLoginName.empty) {
    const authEmail = byLoginName.docs[0].data().authEmail as string | undefined

    if (authEmail) {
      return authEmail
    }
  }

  const companyLogins = await getDocs(
    query(collection(db, 'logins'), where('role', '==', 'company')),
  )

  const loginByDisplayName = companyLogins.docs.find((item) => {
    const storedLoginName = item.data().loginName as string | undefined

    if (!storedLoginName) {
      return false
    }

    return storedLoginName === trimmed || slugify(storedLoginName) === normalized
  })

  if (loginByDisplayName) {
    const authEmail = loginByDisplayName.data().authEmail as string | undefined

    if (authEmail) {
      return authEmail
    }
  }

  const companies = await getDocs(collection(db, 'companies'))
  const companyMatch = companies.docs.find((item) => {
    const name = item.data().name as string
    return name === trimmed || slugify(name) === normalized
  })

  if (companyMatch) {
    const byCompanyId = companyLogins.docs.find(
      (item) => item.data().companyId === companyMatch.id,
    )

    if (byCompanyId) {
      const authEmail = byCompanyId.data().authEmail as string | undefined

      if (authEmail) {
        return authEmail
      }
    }

    const credentialsAuthEmail = await getCompanyAuthEmail(companyMatch.id)

    if (credentialsAuthEmail) {
      return credentialsAuthEmail
    }

    return slugToAuthEmail(companyMatch.data().slug as string)
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
    redemptionsCount: typeof gamification.redemptionsCount === 'number' ? gamification.redemptionsCount : 0,
    helpfulReviewVotes: typeof gamification.helpfulReviewVotes === 'number' ? gamification.helpfulReviewVotes : 0,
    favoritesAddedThisWeek: typeof gamification.favoritesAddedThisWeek === 'number'
      ? gamification.favoritesAddedThisWeek
      : 0,
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
): Promise<void> {
  await updateDoc(doc(db, 'reservations', reservationId), { status })

  if (status === 'confirmed') {
    await notifyReservationConfirmationEmail(reservationId)
  }
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
    schedule: normalizeCompanySchedule((data.schedule as Company['schedule']) ?? defaultSchedule()),
    turns: (data.turns as Company['turns']) ?? defaultTurns(),
    floorPlan: parseFloorPlan(data.floorPlan),
    emailTemplates: parseCompanyEmailTemplatesFromFirestore(data.emailTemplates),
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

function mapReservation(id: string, data: Record<string, unknown>): Reservation {
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
  }
}

export function getFirestoreErrorMessage(
  error: unknown,
  context: 'load' | 'save' = 'load',
): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    if (error.code === 'permission-denied') {
      return context === 'save'
        ? 'Sin permiso para guardar. Publica las reglas en la base de datos «adelia» (Firebase Console → Firestore → adelia → Reglas).'
        : 'Sin permiso para leer Firestore. Revisa las reglas en Firebase Console.'
    }

    if (error.code === 'unavailable' || error.code === 'not-found') {
      return 'Firestore no está disponible. Crea la base de datos «adelia» y ejecuta npm run seed.'
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return context === 'save'
    ? 'No se pudieron guardar los cambios.'
    : 'No se pudieron cargar los datos.'
}
