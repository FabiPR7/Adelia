import { describe, expect, it } from 'vitest'
import {
  claimWindowError,
  countClaimsForPromotion,
  isPromotionSoldOut,
  readMaxClaimsPerCustomer,
} from '../customerPromotionRules.ts'

// 2026-11-10 es horario de invierno: Madrid = UTC+1.
const madrid = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 10, hour - 1, minute))

describe('claimWindowError', () => {
  const window = { claimWindowEnabled: true, activeFromTime: '13:00', activeToTime: '16:00' }

  it('deja reclamar dentro de la franja (hora de España)', () => {
    expect(claimWindowError(window, madrid(14))).toBeNull()
  })

  it('rechaza fuera de la franja con un mensaje claro', () => {
    expect(claimWindowError(window, madrid(12, 59))).toBe('Este premio solo se puede reclamar de 13:00 a 16:00.')
    expect(claimWindowError(window, madrid(16))).not.toBeNull()
  })

  it('sin interruptor no limita, aunque haya horas guardadas', () => {
    expect(claimWindowError({ activeFromTime: '13:00', activeToTime: '16:00' }, madrid(10))).toBeNull()
  })

  it('franja que cruza la medianoche', () => {
    const night = { claimWindowEnabled: true, activeFromTime: '22:00', activeToTime: '02:00' }
    expect(claimWindowError(night, madrid(23))).toBeNull()
    expect(claimWindowError(night, madrid(1))).toBeNull()
    expect(claimWindowError(night, madrid(12))).not.toBeNull()
  })
})

describe('límites', () => {
  it('lee el límite por cliente solo si es un entero positivo', () => {
    expect(readMaxClaimsPerCustomer({ maxClaimsPerCustomer: 2 })).toBe(2)
    expect(readMaxClaimsPerCustomer({ maxClaimsPerCustomer: 0 })).toBeNull()
    expect(readMaxClaimsPerCustomer({})).toBeNull()
  })

  it('detecta promos agotadas', () => {
    expect(isPromotionSoldOut({ maxRedemptions: 5, currentRedemptions: 5 })).toBe(true)
    expect(isPromotionSoldOut({ maxRedemptions: 5, currentRedemptions: 4 })).toBe(false)
    expect(isPromotionSoldOut({ maxRedemptions: null })).toBe(false)
  })

  it('cuenta reclamos sin contar la reserva actual', () => {
    const claims = [
      { promotionId: 'p1', reservationId: 'r1' },
      { promotionId: 'p1', reservationId: 'r2' },
      { promotionId: 'p2' },
    ]
    expect(countClaimsForPromotion(claims, 'p1')).toBe(2)
    expect(countClaimsForPromotion(claims, 'p1', 'r2')).toBe(1)
    expect(countClaimsForPromotion('nada', 'p1')).toBe(0)
  })
})
