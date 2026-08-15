import type { CompanySchedule, FloorPlan, Reservation } from '../types'
import type {
  ReviewMediaItem,
  ReviewTaggedProduct,
  ReviewTaggedPromotion,
} from '../types/review'
import {
  getCompanyBySlug,
  getFirestoreErrorMessage,
  getTablesByCompany,
} from './firestore'
import { getPublicCompanyMenuBoards, getPublicCompanyMenuNodes } from './companyMenu'
import type { MenuBoard, MenuNode } from '../types/company'
import { dateToIsoDate } from '../utils/helpers'
import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

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
  municipality: string
  country: string
  postalCode: string
  description: string
  logoUrl: string
  photos: string[]
  mainPhotoIndex: number
  videos: string[]
  characteristics: string[]
  latitude: number | null
  longitude: number | null
  timeSlotMinutes: number
  schedule: CompanySchedule
  floorPlan: FloorPlan
  reviewCount: number
  reviewRatingSum: number
  reviewAdelinas: number
  depositMinPax: number | null
  depositPerGuestCents: number | null
  depositEnabled: boolean
  depositCancellationHours: number | null
  stripeAccountId: string | null
  stripeChargesEnabled: boolean
  stripeDetailsSubmitted: boolean
}

export interface PublicCompanyReview {
  id: string
  customerName: string
  rating: number
  comment: string
  hasPhoto: boolean
  mediaItems: ReviewMediaItem[]
  taggedProducts: ReviewTaggedProduct[]
  taggedPromotions: ReviewTaggedPromotion[]
  createdAt: string
  ownerReply?: {
    text: string
    createdAt: string
    updatedAt?: string
  } | null
}

export interface PublicReviewsResponse {
  stats: {
    reviewCount: number
    reviewRatingSum: number
    averageRating: number
  }
  reviews: PublicCompanyReview[]
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
  promotionId?: string
  depositPaymentIntentId?: string
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
  const dateParam = dateToIsoDate(date)
  const response = await fetch(
    `${API_BASE}/api/public/booking/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(dateParam)}`,
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'No se pudo cargar la disponibilidad.')
  }

  const payload = (await response.json()) as { reservations?: PublicAvailabilityReservation[] }
  return payload.reservations ?? []
}

export async function createPublicReservation(
  slug: string,
  payload: PublicBookingPayload,
): Promise<{ id: string; message: string }> {
  const token = await getIdToken().catch(() => null)

  const response = await fetch(
    `${API_BASE}/api/public/booking/${encodeURIComponent(slug)}/reservations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...payload,
        clientEmail: payload.clientEmail.trim().toLowerCase(),
      }),
    },
  )

  const data = (await response.json().catch(() => ({}))) as {
    id?: string
    message?: string
    error?: string
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo crear la reserva.')
  }

  return {
    id: data.id ?? '',
    message: data.message ?? 'Hemos recibido tu reserva.',
  }
}

export async function fetchPublicReviews(slug: string): Promise<PublicReviewsResponse> {
  const response = await fetch(
    `${API_BASE}/api/public/booking/${encodeURIComponent(slug)}/reviews`,
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'No se pudieron cargar las reseñas.')
  }

  return response.json() as Promise<PublicReviewsResponse>
}

export async function fetchPublicMenu(slug: string): Promise<{
  company: PublicBookingCompany
  boards: MenuBoard[]
  nodes: MenuNode[]
}> {
  try {
    const company = await getCompanyOrThrow(slug)
    const [boards, nodes] = await Promise.all([
      getPublicCompanyMenuBoards(company.id),
      getPublicCompanyMenuNodes(company.id),
    ])

    const activeBoardIds = new Set(boards.map((board) => board.id))
    const activeNodes = nodes.filter((node) => activeBoardIds.has(node.boardId))

    return {
      company,
      boards,
      nodes: activeNodes,
    }
  } catch (error) {
    throw new Error(getFirestoreErrorMessage(error))
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

export interface PublicCancelPreview {
  companyName: string
  clientName: string
  pax: number | null
  startTime: string | null
  status: string
  alreadyCancelled: boolean
  depositAmountCents: number | null
  depositCancellationHours: number | null
  hasAuthorizedDeposit: boolean
  willChargeDeposit: boolean
}

export interface PublicCancelResult {
  message: string
  depositOutcome: 'none' | 'captured' | 'released'
  depositCharged: boolean
}

export async function fetchPublicCancelPreview(token: string): Promise<PublicCancelPreview> {
  const response = await fetch(
    `${API_BASE}/api/public/booking/cancel/preview?token=${encodeURIComponent(token)}`,
  )

  const data = (await response.json().catch(() => ({}))) as PublicCancelPreview & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo cargar la información de cancelación.')
  }

  return data
}

export async function cancelPublicReservation(token: string): Promise<PublicCancelResult> {
  const response = await fetch(`${API_BASE}/api/public/booking/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  const data = (await response.json().catch(() => ({}))) as PublicCancelResult & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo cancelar la reserva.')
  }

  return {
    message: data.message ?? 'Tu reserva ha sido cancelada correctamente.',
    depositOutcome: data.depositOutcome ?? 'none',
    depositCharged: data.depositCharged === true,
  }
}
