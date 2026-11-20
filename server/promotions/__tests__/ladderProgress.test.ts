import { describe, expect, it } from 'vitest'
import { buildLadderState, reservationCountsForLadder, sortLadderSteps } from '../ladderProgress.ts'
import { checkLadderClaim } from '../../data/ladderRules.ts'

const steps = [
  { id: 'cafe', requiredReservations: 3 },
  { id: 'tostada', requiredReservations: 1 },
  { id: 'cena', requiredReservations: 5 },
]

function state(overrides: Partial<Parameters<typeof buildLadderState>[0]> = {}) {
  return buildLadderState({
    companyId: 'c1',
    steps,
    activePromotionId: null,
    confirmedCount: 0,
    baseline: 0,
    pendingCount: 0,
    completions: 0,
    ...overrides,
  })
}

describe('buildLadderState', () => {
  it('ordena por visitas y empieza por el primero', () => {
    const result = state()
    expect(result.steps.map((step) => step.promotionId)).toEqual(['tostada', 'cafe', 'cena'])
    expect(result.steps.map((step) => step.status)).toEqual(['active', 'locked', 'locked'])
  })

  it('listo para reclamar con las visitas desde el último canje', () => {
    const result = state({ activePromotionId: 'cafe', confirmedCount: 4, baseline: 1 })
    expect(result.steps.map((step) => step.status)).toEqual(['claimed', 'claimable', 'locked'])
    expect(result.steps[1].current).toBe(3)
  })

  it('en curso y a la espera de confirmar', () => {
    const result = state({ activePromotionId: 'cafe', confirmedCount: 2, baseline: 1, pendingCount: 1 })
    expect(result.steps[1]).toMatchObject({ status: 'in_progress', current: 1, required: 3, awaiting: true })
  })

  it('si el activo guardado ya no existe, vuelve al primero', () => {
    expect(state({ activePromotionId: 'borrado' }).activePromotionId).toBe('tostada')
  })

  it('reclamable aquí ⇔ el canje lo acepta', () => {
    for (const confirmedCount of [0, 1, 2, 3, 4, 6]) {
      const result = state({ activePromotionId: 'cafe', confirmedCount, baseline: 1 })
      const step = result.steps.find((item) => item.promotionId === 'cafe')!
      const check = checkLadderClaim({
        promotionId: 'cafe',
        ladderIds: sortLadderSteps(steps).map((item) => item.id),
        activePromotionId: 'cafe',
        required: 3,
        confirmedCount,
        baseline: 1,
      })
      expect(step.status === 'claimable').toBe(check.ok)
    }
  })
})

describe('reservationCountsForLadder', () => {
  it('cuenta confirmadas; con gasto mínimo solo si se validó', () => {
    expect(reservationCountsForLadder({ status: 'confirmed' })).toBe(true)
    expect(reservationCountsForLadder({ status: 'completed' })).toBe(false)
    expect(reservationCountsForLadder({ status: 'confirmed', minimumSpendCents: 500 })).toBe(false)
    expect(reservationCountsForLadder({ status: 'confirmed', minimumSpendCents: 500, promotionVisitStatus: 'eligible' })).toBe(true)
  })
})
