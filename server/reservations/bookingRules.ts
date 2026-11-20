import { companyAcceptsReservations, parseCompanyReservationMode } from '../utils.ts'
import { parseStoredPlanId, planAllowsDeposits } from '../company/planLimits.ts'

/**
 * Reglas de reserva de un local, decididas SOLO aquí. La web y la app las reciben
 * ya calculadas en GET /api/public/booking/:slug (campo `booking`) y no las repiten.
 */

export interface DepositRule {
  /** Desde cuántas personas se pide fianza. */
  fromPax: number
  perGuestCents: number
  /** Si se cancela con al menos estas horas, no se cobra. */
  cancellationHours: number | null
}

export interface BookingRules {
  /** Se puede reservar por Adelia ahora mismo (admite reservas y tiene mesas). */
  canReserve: boolean
  /** El local solo atiende con reserva. */
  reservationRequired: boolean
  /** Se puede ir sin reserva y validar el consumo con PIN. */
  walkInAllowed: boolean
  /** Cómo se completa una promo de visita en este local. */
  completePath: 'choose' | 'reserve' | 'consume'
  /** Texto del botón principal de la ficha. */
  ctaLabel: string
  /** Aviso corto sobre las reservas del local. */
  note: string
  /** Fianza que se pedirá al reservar, o null si este local no pide fianza. */
  deposit: DepositRule | null
  /**
   * El local puede cobrar la fianza (Stripe conectado). Si pide fianza y no puede
   * cobrarla, las reservas que la necesiten no se pueden hacer.
   */
  depositsReady: boolean
}

type CompanyData = Record<string, unknown>

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null
}

/** Regla de fianza configurada (sin mirar si Stripe está listo). */
export function depositRuleFromCompany(data: CompanyData): DepositRule | null {
  if (!planAllowsDeposits(parseStoredPlanId(data.planId))) return null
  if (data.depositEnabled === false) return null
  const fromPax = positiveInt(data.depositMinPax)
  const perGuestCents = positiveInt(data.depositPerGuestCents)
  if (!fromPax || !perGuestCents) return null
  return { fromPax, perGuestCents, cancellationHours: positiveInt(data.depositCancellationHours) }
}

export function depositAmountCents(rule: DepositRule | null, pax: number): number {
  if (!rule || pax < rule.fromPax) return 0
  return rule.perGuestCents * pax
}

export function companyCanChargeDeposits(data: CompanyData): boolean {
  return typeof data.stripeAccountId === 'string'
    && data.stripeAccountId.length > 0
    && data.stripeChargesEnabled === true
}

export function buildBookingRules(data: CompanyData, bookableTableCount: number): BookingRules {
  const mode = parseCompanyReservationMode(data.reservationMode)
  const accepts = companyAcceptsReservations(mode)
  const hasTables = bookableTableCount > 0
  const canReserve = accepts && hasTables

  let note: string
  if (accepts && !hasTables) note = 'Por ahora no acepta reservas por Adelia. Puedes ir sin reserva.'
  else if (mode === 'required') note = 'Este local trabaja solo con reserva.'
  else if (accepts) note = 'Reserva opcional: también puedes venir sin mesa.'
  else note = 'No se aceptan reservas. Solo mesa libre.'

  const rule = depositRuleFromCompany(data)

  return {
    canReserve,
    reservationRequired: mode === 'required',
    walkInAllowed: mode !== 'required',
    completePath: mode === 'none' ? 'consume' : mode === 'required' ? 'reserve' : 'choose',
    ctaLabel: canReserve ? 'Reservar mesa' : 'Sin reservas',
    note,
    deposit: canReserve ? rule : null,
    depositsReady: companyCanChargeDeposits(data),
  }
}
