import { describe, expect, it } from 'vitest'
import { madridDateTime } from '../../utils/madridDateTime.ts'
import {
  countCustomerPromotionUses,
  getPromotionAvailability,
  isWithinPromotionHours,
  type PromotionForAvailability,
} from '../promotionAvailability.ts'

function promo(overrides: Partial<PromotionForAvailability> = {}): PromotionForAvailability {
  return {
    type: 'time_limited',
    activeFromTime: '13:00',
    activeToTime: '16:00',
    maxRedemptions: null,
    currentRedemptions: 0,
    maxClaimsPerCustomer: null,
    reservationMode: 'optional',
    ...overrides,
  }
}

/** Hora de España, sea cual sea la zona del servidor. */
function at(hours: number, minutes = 0): Date {
  return madridDateTime('2026-11-10', `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
}

const base = { promoLocked: false, customerUses: 0 }

describe('isWithinPromotionHours', () => {
  it('respeta la franja normal', () => {
    expect(isWithinPromotionHours(promo(), at(14))).toBe(true)
    expect(isWithinPromotionHours(promo(), at(16))).toBe(false)
    expect(isWithinPromotionHours(promo(), at(12, 59))).toBe(false)
  })

  it('admite franjas que cruzan la medianoche', () => {
    const late = promo({ activeFromTime: '22:00', activeToTime: '02:00' })
    expect(isWithinPromotionHours(late, at(23))).toBe(true)
    expect(isWithinPromotionHours(late, at(1))).toBe(true)
    expect(isWithinPromotionHours(late, at(12))).toBe(false)
  })

  it('sin franja no decide', () => {
    expect(isWithinPromotionHours(promo({ activeFromTime: '', activeToTime: '' }), at(12))).toBeNull()
  })
})

describe('getPromotionAvailability', () => {
  it('disponible dentro de la franja y sin límite', () => {
    const result = getPromotionAvailability(promo(), { ...base, now: at(14) })
    expect(result.locked).toBe(false)
    expect(result.usesLabel).toBe('Sin límite de usos')
  })

  it('fuera de horario: candado y propone reservar', () => {
    const result = getPromotionAvailability(promo(), { ...base, now: at(10) })
    expect(result).toMatchObject({ locked: true, reason: 'outside_hours', action: 'reserve', badge: '13:00–16:00' })
    expect(result.message).toContain('de 13:00 a 16:00')
  })

  it('fuera de horario en un local sin reservas: ir en ese horario', () => {
    const result = getPromotionAvailability(promo({ reservationMode: 'none' }), { ...base, now: at(10) })
    expect(result.action).toBe('restaurant')
    expect(result.message).toContain('no hace reservas')
  })

  it('asistencia ya terminada hoy', () => {
    const result = getPromotionAvailability(promo({ type: 'attendance' }), { ...base, now: at(18) })
    expect(result.reason).toBe('ended_today')
  })

  it('agotada gana a fuera de horario', () => {
    const result = getPromotionAvailability(
      promo({ maxRedemptions: 10, currentRedemptions: 10 }),
      { ...base, now: at(10) },
    )
    expect(result.reason).toBe('sold_out')
  })

  it('límite por cliente alcanzado', () => {
    const result = getPromotionAvailability(promo({ maxClaimsPerCustomer: 2 }), { ...base, customerUses: 2, now: at(14) })
    expect(result).toMatchObject({ locked: true, reason: 'customer_limit', usesLeft: 0 })
  })

  it('cuenta los usos que quedan', () => {
    const result = getPromotionAvailability(promo({ maxClaimsPerCustomer: 3 }), { ...base, customerUses: 1, now: at(14) })
    expect(result.locked).toBe(false)
    expect(result.usesLabel).toBe('Te quedan 2 de 3 usos')
  })

  it('bloqueo por cancelaciones gana a todo', () => {
    const result = getPromotionAvailability(
      promo({ maxRedemptions: 1, currentRedemptions: 1 }),
      { ...base, promoLocked: true, now: at(10) },
    )
    expect(result.reason).toBe('promo_locked')
  })

  it('avisa de pocas plazas y de la reserva ya hecha', () => {
    const result = getPromotionAvailability(
      promo({ maxRedemptions: 10, currentRedemptions: 8 }),
      { ...base, now: at(14), upcomingReservationStart: at(20) },
    )
    expect(result.notes).toEqual(['Ya tienes una reserva con esta promo hoy a las 20:00.', 'Quedan 2 plazas.'])
  })
})

describe('countCustomerPromotionUses', () => {
  it('suma reclamadas y reservas vivas sin contar dos veces la misma', () => {
    const claims = [
      { promotionId: 'p1', reservationId: 'r1' },
      { promotionId: 'otra' },
    ]
    const reservations = [
      { id: 'r1', promotionId: 'p1', status: 'confirmed' },
      { id: 'r2', promotionId: 'p1', status: 'completed' },
      { id: 'r3', promotionId: 'p1', status: 'cancelled' },
    ]
    expect(countCustomerPromotionUses('p1', claims, reservations)).toBe(2)
  })
})
