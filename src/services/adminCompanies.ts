import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../config/firebase'
import type {
  AdminCompany,
  Company,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from '../types'
import { defaultTurns, withFloorPlans, defaultCompanyEmailTemplates } from '../types/company'
import { defaultCompanyQrBranding } from '../utils/qrBranding'
import { defaultSchedule } from '../utils/helpers'
import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string }
    return data.error ?? data.message ?? fallback
  } catch {
    return fallback
  }
}

async function adminCompaniesRequest<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<T> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Sesión de administrador caducada. Vuelve a entrar.')
  }

  const response = await fetch(`${API_BASE}/api/companies${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'No se pudo completar la operación de empresa.'))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function companyFromApi(
  apiCompany: Record<string, unknown>,
  payload: Partial<CreateCompanyPayload & UpdateCompanyPayload>,
  fallback?: AdminCompany,
): Company {
  const planId =
    apiCompany.planId === 'basic' || apiCompany.planId === 'premium' || apiCompany.planId === 'premium_plus'
      ? apiCompany.planId
      : payload.planId ?? fallback?.planId ?? 'free'

  const floors = withFloorPlans(fallback?.floorPlans ?? [])

  return {
    id: String(apiCompany.id ?? fallback?.id ?? ''),
    name: String(apiCompany.name ?? payload.name ?? fallback?.name ?? ''),
    slug: String(apiCompany.slug ?? fallback?.slug ?? ''),
    ownerUid: String(apiCompany.ownerUid ?? fallback?.ownerUid ?? ''),
    phone: String(apiCompany.phone ?? payload.phone ?? fallback?.phone ?? ''),
    website: String(apiCompany.website ?? payload.website ?? fallback?.website ?? ''),
    location: String(apiCompany.location ?? payload.location ?? fallback?.location ?? ''),
    contactEmail: String(payload.contactEmail ?? fallback?.contactEmail ?? ''),
    logoUrl: fallback?.logoUrl ?? '',
    municipality: String(payload.municipality ?? fallback?.municipality ?? ''),
    country: String(payload.country ?? fallback?.country ?? 'España'),
    postalCode: String(payload.postalCode ?? fallback?.postalCode ?? ''),
    latitude: fallback?.latitude ?? null,
    longitude: fallback?.longitude ?? null,
    timeSlotMinutes: typeof apiCompany.timeSlotMinutes === 'number' ? apiCompany.timeSlotMinutes : 120,
    reservationMode: fallback?.reservationMode ?? 'optional',
    schedule: fallback?.schedule ?? defaultSchedule(),
    photos: fallback?.photos ?? [],
    videos: fallback?.videos ?? [],
    characteristics: fallback?.characteristics ?? [],
    venueTypes: fallback?.venueTypes ?? [],
    amenities: fallback?.amenities ?? [],
    priceRange: fallback?.priceRange ?? '',
    description: fallback?.description ?? '',
    emailTemplates: fallback?.emailTemplates ?? defaultCompanyEmailTemplates(),
    qrBranding: fallback?.qrBranding ?? defaultCompanyQrBranding(),
    reviewCount: fallback?.reviewCount ?? 0,
    reviewRatingSum: fallback?.reviewRatingSum ?? 0,
    reviewAdelinas: fallback?.reviewAdelinas ?? 0,
    mainPhotoIndex: fallback?.mainPhotoIndex ?? 0,
    depositMinPax: fallback?.depositMinPax ?? null,
    depositPerGuestCents: fallback?.depositPerGuestCents ?? null,
    depositEnabled: fallback?.depositEnabled ?? false,
    depositCancellationHours: fallback?.depositCancellationHours ?? null,
    stripeAccountId: fallback?.stripeAccountId ?? null,
    stripeChargesEnabled: fallback?.stripeChargesEnabled ?? false,
    stripePayoutsEnabled: fallback?.stripePayoutsEnabled ?? false,
    stripeDetailsSubmitted: fallback?.stripeDetailsSubmitted ?? false,
    planId,
    planBilling:
      planId === 'free' ? null : payload.planBilling ?? fallback?.planBilling ?? 'monthly',
    planStartedAt: fallback?.planStartedAt ?? payload.planStartedAt ?? null,
    planLastPaidAt: fallback?.planLastPaidAt ?? null,
    pendingPlanId: fallback?.pendingPlanId ?? null,
    pendingPlanAt: fallback?.pendingPlanAt ?? null,
    discoveryFeatured: payload.discoveryFeatured ?? fallback?.discoveryFeatured ?? false,
    deactivated: fallback?.deactivated ?? false,
    deactivatedAt: fallback?.deactivatedAt ?? null,
    createdAt: fallback?.createdAt ?? new Date(),
    turns: fallback?.turns ?? defaultTurns(),
    ...floors,
  }
}

function serializeAdminPayload(payload: CreateCompanyPayload | UpdateCompanyPayload): Record<string, unknown> {
  return {
    ...payload,
    planStartedAt: payload.planStartedAt instanceof Date
      ? payload.planStartedAt.toISOString()
      : payload.planStartedAt ?? null,
    ...('planLastPaidAt' in payload
      ? {
          planLastPaidAt:
            payload.planLastPaidAt instanceof Date
              ? 'now'
              : payload.planLastPaidAt,
        }
      : {}),
  }
}

export async function createCompany(payload: CreateCompanyPayload): Promise<{
  company: Company
  loginName: string
  password: string
}> {
  const data = await adminCompaniesRequest<{
    company: Record<string, unknown>
    loginName: string
    password?: string
  }>('/', 'POST', serializeAdminPayload(payload))

  return {
    company: companyFromApi(data.company, payload),
    loginName: data.loginName || payload.name.trim(),
    password: data.password || payload.password,
  }
}

export async function updateCompany(
  companyId: string,
  company: AdminCompany,
  payload: UpdateCompanyPayload,
): Promise<{ company: Company; loginName: string; password?: string }> {
  const data = await adminCompaniesRequest<{
    company: Record<string, unknown>
    loginName: string
  }>(`/${companyId}`, 'PUT', serializeAdminPayload(payload))

  return {
    company: companyFromApi(data.company, payload, company),
    loginName: data.loginName || payload.name?.trim() || company.loginName,
    password: payload.password?.trim() || undefined,
  }
}

export async function deleteCompany(companyId: string, _company: AdminCompany): Promise<void> {
  await adminCompaniesRequest(`/${companyId}`, 'DELETE')
}

export async function countCompanyMenuBoards(companyId: string): Promise<number> {
  try {
    const snap = await getCountFromServer(collection(db, 'companies', companyId, 'menuBoards'))
    return snap.data().count
  } catch {
    return 0
  }
}
