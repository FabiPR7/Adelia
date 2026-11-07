import { describe, expect, it } from 'vitest'
import {
  evaluateWalkInConsumption,
  filterConsumptionsForCustomer,
  inferConsumptionSource,
  mapVerifiedConsumptionDoc,
  sortConsumptionsByVerifiedAtDesc,
} from '../verifiedConsumption.ts'

describe('customer verified consumption', () => {
  it('lists only the signed-in customer and newest first', () => {
    const rows = [
      { customerUid: 'a', verifiedAt: '2026-01-01T10:00:00.000Z' },
      { customerUid: 'b', verifiedAt: '2026-08-01T10:00:00.000Z' },
      { customerUid: 'a', verifiedAt: '2026-08-20T18:00:00.000Z' },
    ]

    const mine = sortConsumptionsByVerifiedAtDesc(
      filterConsumptionsForCustomer(rows, 'a'),
    )

    expect(mine.map((row) => row.verifiedAt)).toEqual([
      '2026-08-20T18:00:00.000Z',
      '2026-01-01T10:00:00.000Z',
    ])
  })

  it('maps a reservation min-spend record as Con reserva with amount', () => {
    const mapped = mapVerifiedConsumptionDoc('res-1', {
      companyId: 'co-1',
      companyName: 'Casa Luna',
      customerUid: 'u1',
      source: 'reservation',
      mode: 'total',
      totalCents: 4200,
      verifiedAt: '2026-08-21T21:00:00.000Z',
      reservationStartTime: '2026-08-21T21:00:00.000Z',
      lineItems: [],
    })

    expect(mapped.source).toBe('reservation')
    expect(mapped.totalCents).toBe(4200)
    expect(mapped.companyName).toBe('Casa Luna')
  })

  it('maps a walk-in as Sin reserva', () => {
    const mapped = mapVerifiedConsumptionDoc('consume-u1-1', {
      companyId: 'co-2',
      source: 'walk_in',
      mode: 'skip',
      totalCents: 0,
      verifiedAt: '2026-08-22T13:00:00.000Z',
    })

    expect(mapped.source).toBe('walk_in')
    expect(inferConsumptionSource({ reservationId: 'consume-u1-1' })).toBe('walk_in')
  })

  it('rejects a wrong PIN without writing or granting credit', () => {
    const decision = evaluateWalkInConsumption({
      pinMatches: false,
      reservationRequired: false,
      ladderPromotionIds: ['promo-1'],
      requestedPromotionId: '',
      captureError: null,
      requiredCents: 0,
      totalCents: 1500,
    })

    expect(decision).toEqual({
      ok: false,
      status: 403,
      error: 'Código PIN incorrecto. Pídeselo de nuevo al empleado.',
      grantCredit: false,
      writeRecord: false,
    })
  })

  it('writes a walk-in with PIN even if there is no ladder, without promo credit', () => {
    const decision = evaluateWalkInConsumption({
      pinMatches: true,
      reservationRequired: false,
      ladderPromotionIds: [],
      requestedPromotionId: '',
      captureError: null,
      requiredCents: 0,
      totalCents: 1800,
    })

    expect(decision).toEqual({
      ok: true,
      status: 200,
      grantCredit: false,
      writeRecord: true,
      promotionId: null,
    })
  })

  it('grants promo credit when a ladder exists and the PIN is valid', () => {
    const decision = evaluateWalkInConsumption({
      pinMatches: true,
      reservationRequired: false,
      ladderPromotionIds: ['ladder-1'],
      requestedPromotionId: '',
      captureError: null,
      requiredCents: 1500,
      totalCents: 1800,
    })

    expect(decision.ok).toBe(true)
    if (decision.ok) {
      expect(decision.grantCredit).toBe(true)
      expect(decision.writeRecord).toBe(true)
      expect(decision.promotionId).toBe('ladder-1')
    }
  })

  it('accepts a min-spend offer that is not a ladder, without granting map credit', () => {
    const decision = evaluateWalkInConsumption({
      pinMatches: true,
      reservationRequired: false,
      ladderPromotionIds: ['ladder-1'],
      eligiblePromotionIds: ['ladder-1', 'minspend-offer'],
      requestedPromotionId: 'minspend-offer',
      captureError: null,
      requiredCents: 2000,
      totalCents: 2500,
    })

    expect(decision).toEqual({
      ok: true,
      status: 200,
      grantCredit: false,
      writeRecord: true,
      promotionId: 'minspend-offer',
    })
  })

  it('rejects an unknown promotion id even if ladders exist', () => {
    const decision = evaluateWalkInConsumption({
      pinMatches: true,
      reservationRequired: false,
      ladderPromotionIds: ['ladder-1'],
      eligiblePromotionIds: ['ladder-1', 'minspend-offer'],
      requestedPromotionId: 'other-promo',
      captureError: null,
      requiredCents: 0,
      totalCents: 1000,
    })

    expect(decision.ok).toBe(false)
    if (!decision.ok) {
      expect(decision.status).toBe(404)
      expect(decision.error).toBe('Promoción no encontrada.')
    }
  })

  it('rejects a requested promotion when the restaurant has no active promotions', () => {
    const decision = evaluateWalkInConsumption({
      pinMatches: true,
      reservationRequired: false,
      ladderPromotionIds: [],
      eligiblePromotionIds: [],
      requestedPromotionId: 'inactive-promo',
      captureError: null,
      requiredCents: 0,
      totalCents: 1000,
    })

    expect(decision).toEqual({
      ok: false,
      status: 404,
      error: 'Promoción no encontrada.',
      grantCredit: false,
      writeRecord: false,
    })
  })
})
