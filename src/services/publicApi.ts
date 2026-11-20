import { BOOKING_RULES_UNKNOWN, type BookingRules } from '../types/bookingRules'
import type { CompanySchedule, FloorPlan } from '../types'
import { executeRecaptcha, loadRecaptchaScript } from './recaptcha'
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

const publicGetCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>()
const PUBLIC_GET_TTL_MS = 30_000

function cachedPublicGet<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = publicGetCache.get(key)
  if (hit && hit.expiresAt > now) {
    return hit.value as Promise<T>
  }

  const value = loader().catch((error) => {
    publicGetCache.delete(key)
    throw error
  })
  publicGetCache.set(key, { expiresAt: now + PUBLIC_GET_TTL_MS, value })
  return value
}

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
  planId: import('../data/companyPlans').CompanyPlanId
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
  /** Lo decide el servidor: si se puede reservar, avisos y fianza. */
  booking: BookingRules
}> {
  return cachedPublicGet(`booking:${slug}`, async () => {
    const response = await fetch(`${API_BASE}/api/public/booking/${encodeURIComponent(slug)}`)

    if (!response.ok) {
      throw new Error(await readPublicError(response, 'No se pudo cargar el restaurante.'))
    }

    const payload = (await response.json()) as {
      company?: PublicBookingCompany
      tables?: PublicBookingTable[]
      booking?: BookingRules
    }

    if (!payload.company) {
      throw new Error('Restaurante no encontrado.')
    }

    return {
      company: payload.company,
      booking: payload.booking ?? BOOKING_RULES_UNKNOWN,
      tables: (payload.tables ?? []).map((table) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        sortOrder: table.sortOrder,
        floorPlanId: table.floorPlanId || '',
      })),
    }
  })
}

/** Una hora del día con sus mesas libres y, si se reserva con promo, por qué no vale. */
export interface DayAvailabilitySlot {
  time: string
  freeTableIds: string[]
  promoReason: string | null
}

/** Disponibilidad de un día: la calcula el servidor (hora de España, mesas y reglas de la promo). */
export interface DayAvailability {
  slots: DayAvailabilitySlot[]
  /** Asistencia puntual: hoy todavía no empieza o ya terminó. */
  promoDayBlock: string | null
}

export async function fetchPublicAvailability(
  slug: string,
  date: Date,
  promotionId?: string | null,
): Promise<DayAvailability> {
  const params = new URLSearchParams({ date: dateToIsoDate(date) })
  if (promotionId) params.set('promotionId', promotionId)
  const response = await fetch(
    `${API_BASE}/api/public/booking/${encodeURIComponent(slug)}/availability?${params.toString()}`,
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'No se pudo cargar la disponibilidad.')
  }

  const payload = (await response.json()) as Partial<DayAvailability>
  return {
    slots: (payload.slots ?? []).map((slot) => ({
      time: slot.time,
      freeTableIds: Array.isArray(slot.freeTableIds) ? slot.freeTableIds : [],
      promoReason: slot.promoReason ?? null,
    })),
    promoDayBlock: payload.promoDayBlock ?? null,
  }
}

export async function createPublicReservation(
  slug: string,
  payload: PublicBookingPayload,
): Promise<{ id: string; message: string; inventory?: Record<string, number> }> {
  const token = await getIdToken().catch(() => null)
  // Sin sesión, el servidor pide captcha (invisible) para frenar reservas falsas.
  let recaptchaToken = ''
  if (!token) {
    try {
      await loadRecaptchaScript()
      recaptchaToken = await executeRecaptcha('booking')
    } catch {
      recaptchaToken = ''
    }
  }

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
        ...(recaptchaToken ? { recaptchaToken } : {}),
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
  return cachedPublicGet(`reviews:${slug}`, async () => {
    const response = await fetch(
      `${API_BASE}/api/public/booking/${encodeURIComponent(slug)}/reviews`,
    )

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(payload.error ?? 'No se pudieron cargar las reseñas.')
    }

    return response.json() as Promise<PublicReviewsResponse>
  })
}

export async function fetchPublicMenu(slug: string): Promise<{
  company: PublicBookingCompany
  booking: BookingRules
  boards: MenuBoard[]
  nodes: MenuNode[]
}> {
  try {
    const { company, booking } = await fetchPublicBookingPage(slug)
    const [boards, nodes] = await Promise.all([
      getPublicCompanyMenuBoards(company.id, company.planId),
      getPublicCompanyMenuNodes(company.id),
    ])

    const activeBoardIds = new Set(boards.map((board) => board.id))
    const activeNodes = nodes.filter((node) => activeBoardIds.has(node.boardId))

    return {
      company,
      booking,
      boards,
      nodes: activeNodes,
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : getFirestoreErrorMessage(error))
  }
}


export { dateToIsoDate }

export interface PublicCancelPreview {
  companyName: string
  clientName: string
  pax: number | null
  startTime: string | null
  status: string
  alreadyCancelled: boolean
  /** `false` si la reserva ya se atendió o ya pasó la hora. */
  canCancel?: boolean
  cancelBlockedReason?: string | null
  depositAmountCents: number | null
  depositCancellationHours: number | null
  hasAuthorizedDeposit: boolean
  willChargeDeposit: boolean
  hasCustomerAccount?: boolean
  cancelShieldCount?: number
  xpPenalty?: PublicCancelXpPenalty | null
  /** Horas para cancelar gratis (regla del servidor). */
  freeCancelHours?: number
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
  /** Cancelada con 24 h o más: no cuenta como falta. */
  free?: boolean
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
