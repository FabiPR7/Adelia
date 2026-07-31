import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { AppUser, AdminCompany, Company, Reservation, ReservationStatus } from '../types'
import { isSameDay } from '../utils/helpers'

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
    mustChangePassword: data.mustChangePassword === true,
    mustChangePasswordCleared: data.mustChangePassword === false,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  }
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

export async function getReservationsForDate(
  companyId: string,
  date: Date,
): Promise<Reservation[]> {
  const all = await getReservationsByCompany(companyId)
  return all.filter((reservation) => isSameDay(reservation.startTime, date))
}

export async function getReservationCountsByMonth(
  companyId: string,
  year: number,
  month: number,
): Promise<Record<number, number>> {
  const all = await getReservationsByCompany(companyId)
  const counts: Record<number, number> = {}

  for (const reservation of all) {
    const start = reservation.startTime

    if (start.getFullYear() !== year || start.getMonth() !== month) {
      continue
    }

    if (reservation.status === 'cancelled') {
      continue
    }

    const day = start.getDate()
    counts[day] = (counts[day] ?? 0) + 1
  }

  return counts
}

export async function getTableNamesByCompany(
  companyId: string,
): Promise<Record<string, string>> {
  const snapshot = await getDocs(
    query(collection(db, 'tables'), where('companyId', '==', companyId)),
  )

  return Object.fromEntries(
    snapshot.docs.map((item) => [item.id, item.data().name as string]),
  )
}

function mapCompany(id: string, data: Record<string, unknown>): Company {
  return {
    id,
    name: data.name as string,
    slug: data.slug as string,
    ownerUid: data.ownerUid as string,
    phone: data.phone as string,
    website: (data.website as string) ?? '',
    location: data.location as string,
    timeSlotMinutes: (data.timeSlotMinutes as number) ?? 120,
    schedule: data.schedule as Company['schedule'],
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
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
    startTime: (data.startTime as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    endTime: (data.endTime as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    status: data.status as ReservationStatus,
    cancelToken: data.cancelToken as string,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  }
}

export function getFirestoreErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    if (error.code === 'permission-denied') {
      return 'Sin permiso para leer Firestore. Revisa las reglas en Firebase Console.'
    }

    if (error.code === 'unavailable' || error.code === 'not-found') {
      return 'Firestore no está disponible. Crea la base de datos (default) y ejecuta npm run seed.'
    }
  }

  return 'No se pudieron cargar los datos.'
}
