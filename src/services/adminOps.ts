import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { adminApi } from './adminApi'
import { db } from '../config/firebase'
import { isPermissionDenied } from './firestoreErrors'
import { parseCompanyPlanStartedAt } from '../data/companyPlans'
import { allMissionDefinitions } from '../data/gamificationMissions'
import type {
  AdminCustomerRow,
  AdminLoginLock,
  AdminMissionRow,
  AdminSecurityEvent,
  IndexedReview,
  SaasSubscriptionLead,
} from '../types/adminOps'
import {
  ADMIN_EVENTS_PAGE_SIZE,
  ADMIN_LIST_PAGE_SIZE,
  ADMIN_REVIEWS_PAGE_SIZE,
} from './firestoreQuery'

function toDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date
    }
  }
  return new Date(0)
}

export async function listAdminCustomers(): Promise<{ rows: AdminCustomerRow[]; totalCount: number }> {
  const customersQuery = query(
    collection(db, 'users'),
    where('role', '==', 'customer'),
    orderBy('createdAt', 'desc'),
    limit(ADMIN_LIST_PAGE_SIZE),
  )

  const [usersSnap, totalSnap] = await Promise.all([
    getDocs(customersQuery).catch(() => getDocs(
      query(collection(db, 'users'), where('role', '==', 'customer'), limit(ADMIN_LIST_PAGE_SIZE)),
    )),
    getCountFromServer(query(collection(db, 'users'), where('role', '==', 'customer'))).catch(() => null),
  ])

  const rows = usersSnap.docs
    .map((item) => {
      const data = item.data()
      if (data.role !== 'customer') {
        return null
      }
      const gamification = data.gamification && typeof data.gamification === 'object'
        ? data.gamification as Record<string, unknown>
        : {}
      return {
        id: item.id,
        displayName: typeof data.displayName === 'string' ? data.displayName : 'Comensal',
        email: typeof data.email === 'string' ? data.email : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        phoneVerified: data.phoneVerified === true,
        onboardingCompleted: data.onboardingCompleted === true,
        homeCity: typeof data.homeCity === 'string' ? data.homeCity : '',
        homeCountry: typeof data.homeCountry === 'string' ? data.homeCountry : '',
        createdAt: toDate(data.createdAt),
        blocked: data.blocked === true,
        xp: typeof gamification.xp === 'number' ? gamification.xp : typeof data.xp === 'number' ? data.xp : 0,
        adelinas: typeof gamification.adelinas === 'number'
          ? gamification.adelinas
          : typeof data.adelinas === 'number'
            ? data.adelinas
            : 0,
        reservationCount: typeof data.reservationCount === 'number' ? data.reservationCount : 0,
      } satisfies AdminCustomerRow
    })
    .filter((item): item is AdminCustomerRow => item !== null)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

  // El perfil no guarda cuántas reservas tiene (salía 0 para todos): se cuentan
  // en el servidor con una consulta de recuento por cliente de esta página.
  await Promise.all(rows.map(async (row) => {
    const snap = await getCountFromServer(
      query(collection(db, 'reservations'), where('customerUid', '==', row.id)),
    ).catch(() => null)
    if (snap) row.reservationCount = snap.data().count
  }))

  return {
    rows,
    totalCount: totalSnap?.data().count ?? rows.length,
  }
}

export async function listTopCustomersByAdelinas(limitCount = 8): Promise<AdminCustomerRow[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'users'),
      where('role', '==', 'customer'),
      orderBy('adelinas', 'desc'),
      limit(limitCount),
    ),
  ).catch(() => getDocs(
    query(collection(db, 'users'), where('role', '==', 'customer'), limit(40)),
  ))

  return snapshot.docs
    .map((item) => {
      const data = item.data()
      if (data.role !== 'customer') {
        return null
      }
      const gamification = data.gamification && typeof data.gamification === 'object'
        ? data.gamification as Record<string, unknown>
        : {}
      const adelinas = typeof gamification.adelinas === 'number'
        ? gamification.adelinas
        : typeof data.adelinas === 'number'
          ? data.adelinas
          : 0
      return {
        id: item.id,
        displayName: typeof data.displayName === 'string' ? data.displayName : 'Comensal',
        email: typeof data.email === 'string' ? data.email : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        phoneVerified: data.phoneVerified === true,
        onboardingCompleted: data.onboardingCompleted === true,
        homeCity: typeof data.homeCity === 'string' ? data.homeCity : '',
        homeCountry: typeof data.homeCountry === 'string' ? data.homeCountry : '',
        createdAt: toDate(data.createdAt),
        blocked: data.blocked === true,
        xp: typeof gamification.xp === 'number' ? gamification.xp : typeof data.xp === 'number' ? data.xp : 0,
        adelinas,
        reservationCount: typeof data.reservationCount === 'number' ? data.reservationCount : 0,
      } satisfies AdminCustomerRow
    })
    .filter((item): item is AdminCustomerRow => item !== null)
    .sort((left, right) => right.adelinas - left.adelinas || right.xp - left.xp)
    .slice(0, limitCount)
}

export async function setCustomerBlocked(userId: string, blocked: boolean): Promise<void> {
  // Por la API del admin (queda apuntado en el registro de acciones).
  await adminApi.blockCustomer(userId, blocked)
}

export async function listIndexedReviews(): Promise<IndexedReview[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'reviewIndex'), orderBy('createdAt', 'desc'), limit(ADMIN_REVIEWS_PAGE_SIZE)),
    ).catch(() => getDocs(query(collection(db, 'reviewIndex'), limit(ADMIN_REVIEWS_PAGE_SIZE))))
    return snapshot.docs
      .map((item) => {
        const data = item.data()
        return {
          id: item.id,
          companyId: typeof data.companyId === 'string' ? data.companyId : '',
          companyName: typeof data.companyName === 'string' ? data.companyName : 'Restaurante',
          companySlug: typeof data.companySlug === 'string' ? data.companySlug : '',
          customerUid: typeof data.customerUid === 'string' ? data.customerUid : '',
          rating: typeof data.rating === 'number' ? data.rating : 0,
          hasPhoto: data.hasPhoto === true,
          commentExcerpt: typeof data.commentExcerpt === 'string' ? data.commentExcerpt : '',
          createdAt: toDate(data.createdAt),
        } satisfies IndexedReview
      })
      .filter((item) => item.companyId && item.customerUid)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
  } catch (error) {
    if (isPermissionDenied(error)) {
      return []
    }
    throw error
  }
}

export async function deleteIndexedReview(review: IndexedReview): Promise<void> {
  // El servidor borra la reseña y descuenta su nota del restaurante solo si existía.
  await adminApi.deleteReview(review.companyId, review.customerUid, review.id)
}

export async function listSecurityEvents(): Promise<AdminSecurityEvent[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'securityEvents'), orderBy('timestamp', 'desc'), limit(ADMIN_EVENTS_PAGE_SIZE)),
    ).catch(() => getDocs(query(collection(db, 'securityEvents'), limit(ADMIN_EVENTS_PAGE_SIZE))))
    return snapshot.docs
      .map((item) => {
        const data = item.data()
        return {
          id: item.id,
          type: typeof data.type === 'string' ? data.type : 'evento',
          severity: typeof data.severity === 'string' ? data.severity : 'low',
          email: typeof data.email === 'string' ? data.email : '',
          resource: typeof data.resource === 'string' ? data.resource : '',
          action: typeof data.action === 'string' ? data.action : '',
          timestamp: toDate(data.timestamp ?? data.createdAt),
        } satisfies AdminSecurityEvent
      })
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
  } catch (error) {
    if (isPermissionDenied(error)) {
      return []
    }
    throw error
  }
}

export async function listLoginLocks(): Promise<AdminLoginLock[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'loginAttempts'), orderBy('attemptCount', 'desc'), limit(ADMIN_EVENTS_PAGE_SIZE)),
    ).catch(() => getDocs(query(collection(db, 'loginAttempts'), limit(ADMIN_EVENTS_PAGE_SIZE))))
    return snapshot.docs
      .map((item) => {
        const data = item.data()
        const lockedUntil = parseCompanyPlanStartedAt(data.lockedUntil)
        return {
          id: item.id,
          attemptCount: typeof data.attemptCount === 'number' ? data.attemptCount : 0,
          lockedUntil,
          lastAttemptAt: parseCompanyPlanStartedAt(data.lastAttemptAt),
        } satisfies AdminLoginLock
      })
      .filter((item) => item.attemptCount > 0 || item.lockedUntil)
      .sort((left, right) => (right.lockedUntil?.getTime() ?? 0) - (left.lockedUntil?.getTime() ?? 0))
  } catch {
    return []
  }
}

export async function listAdminMissions(): Promise<AdminMissionRow[]> {
  try {
    const snapshot = await getDocs(query(collection(db, 'missionCatalog'), limit(300)))
    const fromStore = snapshot.docs.map((item) => {
      const data = item.data()
      return {
        id: item.id,
        name: typeof data.name === 'string' ? data.name : item.id,
        description: typeof data.description === 'string' ? data.description : '',
        xp: typeof data.xp === 'number' ? data.xp : 0,
        target: typeof data.target === 'number' ? data.target : 1,
        cadence: typeof data.cadence === 'string' ? data.cadence : 'weekly',
        category: typeof data.category === 'string' ? data.category : '',
        icon: typeof data.icon === 'string' ? data.icon : '🏅',
      } satisfies AdminMissionRow
    })

    if (fromStore.length > 0) {
      return fromStore.sort((left, right) => left.name.localeCompare(right.name, 'es'))
    }
  } catch {
    // Catálogo local si Firestore no deja leer.
  }

  return allMissionDefinitions().map((mission) => ({
    id: mission.id,
    name: mission.name,
    description: mission.description,
    xp: mission.xp,
    target: mission.target,
    cadence: mission.cadence,
    category: mission.category ?? '',
    icon: mission.icon,
  }))
}

export async function saveAdminMission(mission: AdminMissionRow): Promise<void> {
  await adminApi.catalogBatch([{
    type: 'set',
    path: `missionCatalog/${mission.id}`,
    merge: true,
    data: {
      name: mission.name.trim(),
      description: mission.description.trim(),
      xp: Math.max(0, Math.trunc(mission.xp)),
      target: Math.max(1, Math.trunc(mission.target)),
      cadence: mission.cadence,
      category: mission.category,
      icon: mission.icon,
    },
  }])
}

export async function listSaasSubscriptionLeads(): Promise<SaasSubscriptionLead[]> {
  const snapshot = await getDocs(
    query(collection(db, 'saasSubscriptions'), orderBy('createdAt', 'desc'), limit(40)),
  ).catch(() => getDocs(query(collection(db, 'saasSubscriptions'), limit(40))))

  return snapshot.docs.map((item) => {
    const data = item.data()
    return {
      id: item.id,
      planName: typeof data.planName === 'string' ? data.planName : '',
      planId: typeof data.planId === 'string' ? data.planId : '',
      status: typeof data.status === 'string' ? data.status : '',
      customerEmail: typeof data.customerEmail === 'string' ? data.customerEmail : '',
      restaurantName: typeof data.restaurantName === 'string' ? data.restaurantName : '',
      city: typeof data.city === 'string' ? data.city : '',
      amountTotal: typeof data.amountTotal === 'number' ? data.amountTotal : 0,
      currency: typeof data.currency === 'string' ? data.currency : 'eur',
      livemode: data.livemode === true,
      createdAt: toDate(data.createdAt),
    }
  })
}

/** Busca un cliente por su correo en toda la base (la lista solo trae los más recientes). */
export async function findCustomerIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) {
    return null
  }
  const snapshot = await getDocs(
    query(collection(db, 'users'), where('email', '==', normalized), limit(3)),
  )
  const match = snapshot.docs.find((item) => item.data().role === 'customer')
  return match?.id ?? null
}
