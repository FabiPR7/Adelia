export type VerifiedConsumptionSource = 'reservation' | 'walk_in'
export type VerifiedConsumptionMode = 'total' | 'products' | 'skip'

export interface VerifiedConsumptionCompanyCard {
  companyName: string
  companySlug: string
  photoUrl: string
}

export interface CustomerConsumptionLineItemDto {
  name: string
  quantity: number
  lineTotalCents: number
}

export interface CustomerConsumptionDto {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  photoUrl: string
  verifiedAt: string
  visitAt: string
  totalCents: number
  mode: VerifiedConsumptionMode
  source: VerifiedConsumptionSource
  promotionId: string | null
  promotionTitle: string | null
  minimumSpendCents: number
  lineItems: CustomerConsumptionLineItemDto[]
  meetsMinimumSpend: boolean
}

export function resolveCompanyCardFields(
  companyData: FirebaseFirestore.DocumentData | Record<string, unknown> | undefined,
): VerifiedConsumptionCompanyCard {
  const data = companyData ?? {}
  const photos = Array.isArray(data.photos) ? data.photos : []
  const logoUrl = typeof data.logoUrl === 'string' ? data.logoUrl : ''
  const mainPhotoIndex = typeof data.mainPhotoIndex === 'number'
    ? Math.max(0, Math.min(Math.max(photos.length - 1, 0), data.mainPhotoIndex))
    : 0
  const mainPhoto = typeof photos[mainPhotoIndex] === 'string' ? photos[mainPhotoIndex] : ''
  const firstPhoto = typeof photos[0] === 'string' ? photos[0] : ''

  return {
    companyName: typeof data.name === 'string' && data.name.trim()
      ? data.name.trim()
      : 'Restaurante',
    companySlug: typeof data.slug === 'string' ? data.slug : '',
    photoUrl: mainPhoto || firstPhoto || logoUrl,
  }
}

export function inferConsumptionSource(data: Record<string, unknown>): VerifiedConsumptionSource {
  if (data.source === 'reservation' || data.source === 'walk_in') {
    return data.source
  }

  const reservationId = typeof data.reservationId === 'string' ? data.reservationId : ''
  if (reservationId.startsWith('consume-')) {
    return 'walk_in'
  }

  return 'reservation'
}

export function timestampToIso(value: unknown): string | null {
  if (!value) {
    return null
  }

  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString()
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }

  if (typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate()
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  return null
}

export function mapConsumptionLineItems(raw: unknown): CustomerConsumptionLineItemDto[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const row = item as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const quantity = typeof row.quantity === 'number' && Number.isFinite(row.quantity)
      ? Math.max(0, Math.trunc(row.quantity))
      : 0
    const rawTotal = typeof row.lineTotalCents === 'number' && Number.isFinite(row.lineTotalCents)
      ? row.lineTotalCents
      : typeof row.lineTotalCents === 'number' && Number.isFinite(row.lineTotalCents)
        ? row.lineTotalCents
        : typeof row.lineTotalCents === 'number' && Number.isFinite(row.lineTotalCents)
          ? row.lineTotalCents
          : 0
    const lineTotalCents = Math.round(rawTotal)

    if (!name || quantity < 1) {
      return []
    }

    return [{ name, quantity, lineTotalCents }]
  })
}

export function mapVerifiedConsumptionDoc(
  id: string,
  data: Record<string, unknown>,
  companyIdFromPath = '',
): CustomerConsumptionDto {
  const verifiedAt = timestampToIso(data.verifiedAt) ?? new Date(0).toISOString()
  const visitAt = timestampToIso(data.reservationStartTime) ?? verifiedAt
  const mode: VerifiedConsumptionMode = data.mode === 'products' || data.mode === 'skip'
    ? data.mode
    : 'total'
  const totalCents = typeof data.totalCents === 'number' && Number.isFinite(data.totalCents)
    ? Math.max(0, Math.round(data.totalCents))
    : 0

  return {
    id,
    companyId: typeof data.companyId === 'string' && data.companyId
      ? data.companyId
      : companyIdFromPath,
    companyName: typeof data.companyName === 'string' && data.companyName.trim()
      ? data.companyName.trim()
      : 'Restaurante',
    companySlug: typeof data.companySlug === 'string' ? data.companySlug : '',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
    verifiedAt,
    visitAt,
    totalCents,
    mode,
    source: inferConsumptionSource(data),
    promotionId: typeof data.promotionId === 'string' && data.promotionId
      ? data.promotionId
      : null,
    promotionTitle: typeof data.promotionTitle === 'string' && data.promotionTitle.trim()
      ? data.promotionTitle.trim()
      : null,
    minimumSpendCents: typeof data.minimumSpendCents === 'number'
      ? Math.max(0, Math.round(data.minimumSpendCents))
      : 0,
    lineItems: mapConsumptionLineItems(data.lineItems),
    meetsMinimumSpend: data.meetsMinimumSpend === true,
  }
}

export function filterConsumptionsForCustomer<T extends { customerUid?: unknown }>(
  rows: T[],
  uid: string,
): T[] {
  return rows.filter((row) => row.customerUid === uid)
}

export function sortConsumptionsByVerifiedAtDesc<T extends { verifiedAt: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt))
}

export type WalkInConsumptionDecision =
  | { ok: false; status: number; error: string; grantCredit: false; writeRecord: false }
  | { ok: true; status: 200; grantCredit: boolean; writeRecord: true; promotionId: string | null }

export function evaluateWalkInConsumption(input: {
  pinMatches: boolean
  reservationRequired: boolean
  ladderPromotionIds: string[]
  requestedPromotionId: string
  captureError: string | null
  requiredCents: number
  totalCents: number
}): WalkInConsumptionDecision {
  if (input.reservationRequired) {
    return {
      ok: false,
      status: 409,
      error: 'Este restaurante solo admite reservas. Reserva mesa para completar la oferta.',
      grantCredit: false,
      writeRecord: false,
    }
  }

  const requested = input.requestedPromotionId.trim()
  if (requested && !input.ladderPromotionIds.includes(requested)) {
    return {
      ok: false,
      status: 404,
      error: 'Promoción no encontrada.',
      grantCredit: false,
      writeRecord: false,
    }
  }

  if (input.captureError) {
    return {
      ok: false,
      status: 400,
      error: input.captureError,
      grantCredit: false,
      writeRecord: false,
    }
  }

  if (input.requiredCents > 0 && input.totalCents < input.requiredCents) {
    return {
      ok: false,
      status: 400,
      error: 'El consumo indicado no alcanza el gasto mínimo requerido.',
      grantCredit: false,
      writeRecord: false,
    }
  }

  if (!input.pinMatches) {
    return {
      ok: false,
      status: 403,
      error: 'Código PIN incorrecto. Pídeselo de nuevo al empleado.',
      grantCredit: false,
      writeRecord: false,
    }
  }

  const promotionId = requested || input.ladderPromotionIds[0] || null
  return {
    ok: true,
    status: 200,
    grantCredit: Boolean(promotionId),
    writeRecord: true,
    promotionId,
  }
}
