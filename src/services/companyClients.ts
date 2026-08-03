import {
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { CompanyClient } from '../types'
import { clientDocIdFromEmail, isValidClientEmail, normalizeClientEmail } from '../utils/clientIdentity'
import type { Reservation } from '../types'

function mapCompanyClient(id: string, data: Record<string, unknown>): CompanyClient {
  return {
    id,
    email: (data.email as string) ?? id,
    name: (data.name as string) ?? '',
    phone: (data.phone as string) ?? '',
    firstReservationDate:
      (data.firstReservationDate as Timestamp | undefined)?.toDate?.() ?? new Date(0),
    lastReservationDate:
      (data.lastReservationDate as Timestamp | undefined)?.toDate?.() ?? new Date(0),
    reservationCount: typeof data.reservationCount === 'number' ? data.reservationCount : 0,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.() ?? new Date(0),
    updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate?.() ?? new Date(0),
  }
}

export async function getCompanyClients(companyId: string): Promise<CompanyClient[]> {
  const clientsRef = collection(db, 'companies', companyId, 'clients')
  const snapshot = await getDocs(query(clientsRef, orderBy('lastReservationDate', 'desc')))

  return snapshot.docs.map((clientDoc) =>
    mapCompanyClient(clientDoc.id, clientDoc.data() as Record<string, unknown>),
  )
}

export function filterReservationsByClientEmail(
  reservations: Reservation[],
  email: string,
): Reservation[] {
  const normalized = normalizeClientEmail(email)

  return reservations
    .filter((reservation) => normalizeClientEmail(reservation.clientEmail) === normalized)
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
}

export function isNewCompanyClient(client: CompanyClient, withinDays = 30): boolean {
  const threshold = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return client.firstReservationDate.getTime() >= threshold
}

export async function upsertCompanyClientFromReservation(
  companyId: string,
  reservationId: string,
  input: {
    clientEmail: string
    clientName: string
    clientPhone: string
    reservationDate: Date
  },
): Promise<boolean> {
  const email = normalizeClientEmail(input.clientEmail)

  if (!isValidClientEmail(email)) {
    return false
  }

  const reservationRef = doc(db, 'reservations', reservationId)
  const clientRef = doc(db, 'companies', companyId, 'clients', clientDocIdFromEmail(email))
  const name = input.clientName.trim() || 'Cliente'
  const phone = input.clientPhone.trim()
  const reservationTimestamp = Timestamp.fromDate(input.reservationDate)

  let synced = false

  await runTransaction(db, async (tx) => {
    const reservationSnap = await tx.get(reservationRef)

    if (!reservationSnap.exists() || reservationSnap.data()?.clientSyncedAt) {
      return
    }

    const clientSnap = await tx.get(clientRef)

    if (clientSnap.exists()) {
      tx.update(clientRef, {
        email,
        name,
        phone,
        lastReservationDate: reservationTimestamp,
        reservationCount: increment(1),
        updatedAt: serverTimestamp(),
      })
    } else {
      tx.set(clientRef, {
        email,
        name,
        phone,
        firstReservationDate: reservationTimestamp,
        lastReservationDate: reservationTimestamp,
        reservationCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    tx.update(reservationRef, {
      clientSyncedAt: serverTimestamp(),
    })

    synced = true
  })

  return synced
}
