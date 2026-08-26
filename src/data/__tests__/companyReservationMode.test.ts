import { describe, expect, it } from 'vitest'
import {
  companyAcceptsReservations,
  companyAllowsWalkInConsumption,
  companyRequiresReservation,
  parseCompanyReservationMode,
  promoVisitCompletePath,
  restaurantReserveCtaLabel,
} from '../companyReservationMode'

describe('companyReservationMode', () => {
  it('defaults unknown values to optional so locales actuales siguen aceptando reserva', () => {
    expect(parseCompanyReservationMode(undefined)).toBe('optional')
    expect(parseCompanyReservationMode('foo')).toBe('optional')
    expect(companyAcceptsReservations(undefined)).toBe(true)
    expect(companyRequiresReservation(undefined)).toBe(false)
  })

  it('blocks public booking only in none mode', () => {
    expect(companyAcceptsReservations('none')).toBe(false)
    expect(companyAcceptsReservations('required')).toBe(true)
    expect(companyRequiresReservation('required')).toBe(true)
    expect(restaurantReserveCtaLabel('none')).toBe('Ver restaurante')
    expect(restaurantReserveCtaLabel('optional')).toBe('Reservar mesa')
  })

  it('elige reservar, consumo o ambos al completar una oferta', () => {
    expect(promoVisitCompletePath('optional')).toBe('choose')
    expect(promoVisitCompletePath('required')).toBe('reserve')
    expect(promoVisitCompletePath('none')).toBe('consume')
    expect(companyAllowsWalkInConsumption('optional')).toBe(true)
    expect(companyAllowsWalkInConsumption('none')).toBe(true)
    expect(companyAllowsWalkInConsumption('required')).toBe(false)
  })
})
