import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { CompanyClient } from '../types'
import { normalizeClientEmail } from '../utils/clientIdentity'
import type { Reservation } from '../types'
import {
  getDemoClients,
  isDemoCompanyId,
} from '../data/companyPanelDemo'

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

export const COMPANY_CLIENTS_PAGE_SIZE = 100

export interface CompanyClientsPage {
  clients: CompanyClient[]
  /** Último documento de la página: se pasa para pedir la siguiente (null = no hay más). */
  cursor: QueryDocumentSnapshot | null
}

/** Clientes del restaurante por páginas, del más reciente al más antiguo. */
export async function getCompanyClientsPage(
  companyId: string,
  after: QueryDocumentSnapshot | null = null,
): Promise<CompanyClientsPage> {
  if (isDemoCompanyId(companyId)) {
    return { clients: after ? [] : getDemoClients(), cursor: null }
  }

  const clientsRef = collection(db, 'companies', companyId, 'clients')
  const constraints = [orderBy('lastReservationDate', 'desc'), ...(after ? [startAfter(after)] : []), limit(COMPANY_CLIENTS_PAGE_SIZE)]
  const snapshot = await getDocs(query(clientsRef, ...constraints))

  return {
    clients: snapshot.docs.map((clientDoc) =>
      mapCompanyClient(clientDoc.id, clientDoc.data() as Record<string, unknown>),
    ),
    cursor: snapshot.size === COMPANY_CLIENTS_PAGE_SIZE ? snapshot.docs[snapshot.docs.length - 1] : null,
  }
}

export async function getCompanyClients(companyId: string): Promise<CompanyClient[]> {
  return (await getCompanyClientsPage(companyId)).clients
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

