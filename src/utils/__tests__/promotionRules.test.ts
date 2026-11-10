import { describe, expect, it } from 'vitest'
import { describePromotionRules } from '../promotionRules'

describe('describePromotionRules', () => {
  it('franja horaria con plazas, límite y gasto mínimo', () => {
    expect(describePromotionRules({
      type: 'time_limited',
      activeFromTime: '13:00',
      activeToTime: '16:00',
      maxRedemptions: 10,
      currentRedemptions: 3,
      maxClaimsPerCustomer: 1,
      minimumSpendEnabled: true,
      minimumSpendCents: 1250,
    })).toEqual(['De 13:00 a 16:00', 'Solo 10 plazas', '1 vez por cliente', 'Gasto mín. 12,50 €'])
  })

  it('el restaurante ve las plazas usadas', () => {
    expect(describePromotionRules(
      { type: 'attendance', activeFromTime: '20:00', activeToTime: '22:00', arrivalWindowMinutes: 30, maxRedemptions: 5, currentRedemptions: 2 },
      { showUsedSpots: true },
    )).toEqual(['De 20:00 a 22:00', 'Llegar en 30 min', '2 de 5 plazas usadas', 'Sin límite por cliente'])
  })

  it('por reservas o consumos', () => {
    expect(describePromotionRules({ type: 'reservation_ladder', requiredReservations: 3, maxClaimsPerCustomer: 2 }))
      .toEqual(['Tras 3 reservas o consumos', '2 veces por cliente'])
  })

  it('por reservas o consumos con franja de canje', () => {
    expect(describePromotionRules({
      type: 'reservation_ladder',
      requiredReservations: 2,
      claimWindowEnabled: true,
      activeFromTime: '13:00',
      activeToTime: '16:00',
    })).toEqual(['Tras 2 reservas o consumos', 'Se canjea de 13:00 a 16:00', 'Sin límite por cliente'])
  })

  it('sin interruptor, la hora guardada de una escalera no cuenta', () => {
    expect(describePromotionRules({
      type: 'reservation_ladder',
      requiredReservations: 2,
      activeFromTime: '12:00',
      activeToTime: '16:00',
    })).toEqual(['Tras 2 reservas o consumos', 'Sin límite por cliente'])
  })
})
