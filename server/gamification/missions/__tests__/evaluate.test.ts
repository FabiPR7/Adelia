import { afterEach, describe, expect, it } from 'vitest'
import { runMissionEngine, normalizeGamificationState, type MissionInputs } from '../evaluate.ts'
import { setEngineNowForTests, toMadridWall } from '../engineSupport.ts'
import { CONFIRMED_RESERVATION_XP } from '../types.ts'

afterEach(() => setEngineNowForTests(null))

function inputs(overrides: Partial<MissionInputs> = {}): MissionInputs {
  return {
    reservations: [],
    consumptions: [],
    favoriteSlugs: [],
    promotionCompanyIds: new Set(),
    restaurants: new Map([['c1', { zone: 'Logroño', categories: ['Tapas'], venueTypes: ['bar'], reservationMode: 'optional' }]]),
    ...overrides,
  }
}

function reservation(id: string, startIso: string, status = 'confirmed') {
  const start = toMadridWall(new Date(startIso))
  return {
    id,
    companyId: 'c1',
    tableId: 't1',
    pax: 2,
    startTime: start,
    endTime: new Date(start.getTime() + 3600_000),
    createdAt: start,
    status,
  }
}

describe('toMadridWall', () => {
  it('da la hora de pared de España en cualquier servidor', () => {
    // 22:30 UTC en invierno = 23:30 en Madrid; 22:30 UTC en verano = 00:30 del día siguiente.
    expect(toMadridWall(new Date('2026-01-15T22:30:00Z')).getHours()).toBe(23)
    const summer = toMadridWall(new Date('2026-07-15T22:30:00Z'))
    expect([summer.getHours(), summer.getDate()]).toEqual([0, 16])
  })
})

describe('runMissionEngine', () => {
  it('da la XP de una visita confirmada una sola vez', () => {
    setEngineNowForTests(new Date('2026-11-20T12:00:00Z'))
    const data = inputs({ reservations: [reservation('r1', '2026-11-18T19:00:00Z')] })
    const first = runMissionEngine({}, data)
    expect(first.state.awardedReservationXpIds).toContain('r1')
    expect(first.state.xp).toBeGreaterThanOrEqual(CONFIRMED_RESERVATION_XP)
    const second = runMissionEngine(first.state as unknown as Record<string, unknown>, data)
    expect(second.state.xp).toBe(first.state.xp)
  })

  it('una reserva sin confirmar no da XP', () => {
    setEngineNowForTests(new Date('2026-11-20T12:00:00Z'))
    const result = runMissionEngine({}, inputs({ reservations: [reservation('r1', '2026-11-25T19:00:00Z', 'completed')] }))
    expect(result.state.awardedReservationXpIds).not.toContain('r1')
  })

  it('devuelve el progreso de las misiones de la semana, del mes y de siempre', () => {
    setEngineNowForTests(new Date('2026-11-20T12:00:00Z'))
    const result = runMissionEngine({}, inputs())
    expect(result.weeklyProgress.length).toBeGreaterThan(0)
    expect(result.monthlyProgress.length).toBeGreaterThan(0)
    expect(result.historicalProgress.length).toBeGreaterThan(0)
    expect(result.state.weekKey).toMatch(/^2026-W\d{2}$/)
  })

  it('no pierde lo que el servidor guardó aparte (cartas, canjes, penalizaciones)', () => {
    setEngineNowForTests(new Date('2026-11-20T12:00:00Z'))
    const stored = { xp: 500, inventory: { llave_maestra: 2 }, xpPenaltyTotal: 30, cancellationStrikeCount: 1, promoLocked: false }
    const result = runMissionEngine(stored, inputs())
    expect(result.state.inventory).toEqual({ llave_maestra: 2 })
    expect(result.state.xpPenaltyTotal).toBe(30)
    expect(result.state.xp).toBeGreaterThanOrEqual(500)
  })

  it('normaliza estados guardados raros', () => {
    const state = normalizeGamificationState({ xp: 'mucho', weeklyCompleted: 'x', inventory: { a: 1, b: 'dos' } })
    expect(state.xp).toBe(0)
    expect(state.weeklyCompleted).toEqual([])
    expect(state.inventory).toEqual({ a: 1 })
  })
})
