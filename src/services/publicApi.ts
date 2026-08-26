import type { CompanySchedule, FloorPlan, Reservation } from '../types'
import type {
  ReviewMediaItem,
  ReviewTaggedProduct,
  ReviewTaggedPromotion,
} from '../types/review'
import { getFirestoreErrorMessage } from './firestore'
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
  floorPlanId: string
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
  venueTypes: string[]
  amenities: string[]
  priceRange: import('../data/companyProfileFacilities').CompanyPriceRange
  latitude: number | null
  longitude: number | null
  timeSlotMinutes: number
  reservationMode: import('../data/companyReservationMode').CompanyReservationMode
  schedule: CompanySchedule
  floorPlan: FloorPlan
  floorPlans: FloorPlan[]
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
  useDepositPass?: boolean
  useExtraPax?: boolean
  inviteeUids?: string[]
}

async function readPublicError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  return payload.error ?? fallback
}

export async function fetchPublicBookingPage(slug: string): Promise<{
  company: PublicBookingCompany
  tables: PublicBookingTable[]
}> {
  const response = await fetch(`${API_BASE}/api/public/booking/${encodeURIComponent(slug)}`)

  if (!response.ok) {
    throw new Error(await readPublicError(response, 'No se pudo cargar el restaurante.'))
  }

  const payload = (await response.json()) as {
    company?: PublicBookingCompany
    tables?: PublicBookingTable[]
  }

  if (!payload.company) {
    throw new Error('Restaurante no encontrado.')
  }

  return {
    company: payload.company,
    tables: (payload.tables ?? []).map((table) => ({
      id: table.id,
      name: table.name,
      capacity: table.capacity,
      sortOrder: table.sortOrder,
      floorPlanId: table.floorPlanId || '',
    })),
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
): Promise<{ id: string; message: string; inventory?: Record<string, number> }> {
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
    inventory?: Record<string, number>
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo crear la reserva.')
  }

  return {
    id: data.id ?? '',
    message: data.message ?? 'Hemos recibido tu reserva.',
    ...(data.inventory && typeof data.inventory === 'object' ? { inventory: data.inventory } : {}),
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
    const { company } = await fetchPublicBookingPage(slug)
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
    throw new Error(error instanceof Error ? error.message : getFirestoreErrorMessage(error))
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
  hasCustomerAccount?: boolean
  cancelShieldCount?: number
  xpPenalty?: PublicCancelXpPenalty | null
}

export interface PublicCancelXpPenalty {
  xpLost: number
  percent: number
  strikeCount: number
  nextPercent: number | null
  promoLocked: boolean
  justLocked: boolean
  warning: string
  xpAfter: number
  xpBefore: number
  shielded?: boolean
}

export interface PublicCancelResult {
  message: string
  depositOutcome: 'none' | 'captured' | 'released'
  depositCharged: boolean
  xpPenalty?: PublicCancelXpPenalty | null
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

export async function cancelPublicReservation(
  token: string,
  options?: { useCancelShield?: boolean },
): Promise<PublicCancelResult> {
  const response = await fetch(`${API_BASE}/api/public/booking/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      useCancelShield: options?.useCancelShield === true,
    }),
  })

  const data = (await response.json().catch(() => ({}))) as PublicCancelResult & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo cancelar la reserva.')
  }

  return {
    message: data.message ?? 'Tu reserva ha sido cancelada correctamente.',
    depositOutcome: data.depositOutcome ?? 'none',
    depositCharged: data.depositCharged === true,
    xpPenalty: data.xpPenalty ?? null,
  }
}
