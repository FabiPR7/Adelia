import type { CompanySchedule, FloorPlan, Reservation } from '../types'
import {
  createPublicReservation as createPublicReservationInFirestore,
  getCompanyBySlug,
  getFirestoreErrorMessage,
  getReservationsForDate,
  getTablesByCompany,
} from './firestore'
import { dateToIsoDate } from '../utils/helpers'

export interface PublicBookingTable {
  id: string
  name: string
  capacity: number
  sortOrder: number
}

export interface PublicBookingCompany {
  id: string
  name: string
  slug: string
  phone: string
  contactEmail: string
  location: string
  logoUrl: string
  timeSlotMinutes: number
  schedule: CompanySchedule
  floorPlan: FloorPlan
}

export interface PublicAvailabilityReservation {
  id: string
  tableId: string
  startTime: string
  endTime: string
  status: string
}

export interface PublicBookingPayload {
  date: string
  time: string
  tableId: string
  clientName: string
  clientEmail: string
  clientPhone: string
  pax: number
  notes: string
}

function parseBookingDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())

  if (!match) {
    throw new Error('Fecha inválida.')
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    throw new Error('Fecha inválida.')
  }

  return date
}

async function getCompanyOrThrow(slug: string) {
  const company = await getCompanyBySlug(slug)

  if (!company) {
    throw new Error('Restaurante no encontrado.')
  }

  return company
}

export async function fetchPublicBookingPage(slug: string): Promise<{
  company: PublicBookingCompany
  tables: PublicBookingTable[]
}> {
  try {
    const company = await getCompanyOrThrow(slug)
    const tables = await getTablesByCompany(company.id)

    return {
      company,
      tables: tables.map((table) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        sortOrder: table.sortOrder,
      })),
    }
  } catch (error) {
    throw new Error(getFirestoreErrorMessage(error))
  }
}

export async function fetchPublicAvailability(
  slug: string,
  date: Date,
): Promise<PublicAvailabilityReservation[]> {
  try {
    const company = await getCompanyOrThrow(slug)
    const reservations = await getReservationsForDate(company.id, date)

    return reservations.map((reservation) => ({
      id: reservation.id,
      tableId: reservation.tableId,
      startTime: reservation.startTime.toISOString(),
      endTime: reservation.endTime.toISOString(),
      status: reservation.status,
    }))
  } catch (error) {
    throw new Error(getFirestoreErrorMessage(error))
  }
}

export async function createPublicReservation(
  slug: string,
  payload: PublicBookingPayload,
): Promise<{ id: string; message: string }> {
  try {
    const company = await getCompanyOrThrow(slug)
    const date = parseBookingDate(payload.date)
    const dayReservations = await getReservationsForDate(company.id, date)

    const created = await createPublicReservationInFirestore(
      company.id,
      date,
      {
        clientName: payload.clientName,
        clientEmail: payload.clientEmail,
        clientPhone: payload.clientPhone,
        pax: payload.pax,
        tableId: payload.tableId,
        time: payload.time,
        notes: payload.notes,
      },
      company.timeSlotMinutes,
      company.schedule,
      dayReservations,
    )

    return {
      id: created.id,
      message: 'Reserva confirmada.',
    }
  } catch (error) {
    if (error instanceof Error && error.message.trim()) {
      throw error
    }

    throw new Error(getFirestoreErrorMessage(error, 'save'))
  }
}

export function availabilityToReservations(items: PublicAvailabilityReservation[]): Reservation[] {
  return items.map((item) => ({
    id: item.id,
    companyId: '',
    tableId: item.tableId,
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    pax: 0,
    notes: '',
    startTime: new Date(item.startTime),
    endTime: new Date(item.endTime),
    status: item.status as Reservation['status'],
    cancelToken: '',
    createdAt: new Date(),
  }))
}

export { dateToIsoDate }
