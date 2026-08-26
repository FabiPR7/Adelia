export type CompanyReservationMode = 'required' | 'optional' | 'none'

export const COMPANY_RESERVATION_MODE_OPTIONS: {
  id: CompanyReservationMode
  label: string
  hint: string
}[] = [
  {
    id: 'required',
    label: 'Obligatorio',
    hint: 'Solo se atiende con reserva previa.',
  },
  {
    id: 'optional',
    label: 'Opcional',
    hint: 'Se puede reservar o venir sin reserva.',
  },
  {
    id: 'none',
    label: 'Sin reservas',
    hint: 'No se aceptan reservas. Solo mesa libre.',
  },
]

export function parseCompanyReservationMode(value: unknown): CompanyReservationMode {
  if (value === 'required' || value === 'optional' || value === 'none') {
    return value
  }
  return 'optional'
}

export function companyAcceptsReservations(mode: unknown): boolean {
  return parseCompanyReservationMode(mode) !== 'none'
}

export function companyRequiresReservation(mode: unknown): boolean {
  return parseCompanyReservationMode(mode) === 'required'
}

export function reservationModeHint(mode: unknown): string {
  const parsed = parseCompanyReservationMode(mode)
  return COMPANY_RESERVATION_MODE_OPTIONS.find((option) => option.id === parsed)?.hint ?? ''
}

export function restaurantReserveCtaLabel(mode: unknown): string {
  return companyAcceptsReservations(mode) ? 'Reservar mesa' : 'Ver restaurante'
}

export function restaurantReserveCtaShortLabel(mode: unknown): string {
  return companyAcceptsReservations(mode) ? 'Reservar' : 'Ver restaurante'
}

/** Cómo completar una oferta: reserva, consumo o elegir. */
export type PromoVisitCompletePath = 'choose' | 'reserve' | 'consume'

export function promoVisitCompletePath(mode: unknown): PromoVisitCompletePath {
  const parsed = parseCompanyReservationMode(mode)
  if (parsed === 'none') {
    return 'consume'
  }
  if (parsed === 'required') {
    return 'reserve'
  }
  return 'choose'
}

export function companyAllowsWalkInConsumption(mode: unknown): boolean {
  return parseCompanyReservationMode(mode) !== 'required'
}
