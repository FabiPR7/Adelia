import { describe, expect, it } from 'vitest'
import { getCurrentCycleClaimedIds } from '../promotionLadderStatus'
import type { PublicPromotion } from '../../services/publicPromotions'
import type { ClaimedPromotionRecord } from '../../types/gamification'

const C = 'rest1'
const ladder = [
  { id: 'a', companyId: C, type: 'reservation_ladder', requiredReservations: 1 },
  { id: 'b', companyId: C, type: 'reservation_ladder', requiredReservations: 2 },
] as PublicPromotion[]

const claim = (promotionId: string, day: number, promotionType?: string) => ({
  promotionId,
  companyId: C,
  claimedAt: `2026-08-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  promotionType,
}) as ClaimedPromotionRecord

describe('vuelta actual del mapa', () => {
  it('usa el premio activo del servidor: lo anterior está reclamado', () => {
    const claims = [claim('a', 1), claim('b', 2), claim('a', 3)]
    expect([...getCurrentCycleClaimedIds(C, 2, claims, { [C]: 1 }, ladder, { [C]: 'b' })]).toEqual(['a'])
    expect([...getCurrentCycleClaimedIds(C, 2, claims, { [C]: 1 }, ladder, { [C]: 'a' })]).toEqual([])
  })

  it('sin dato del servidor, los premios de horario no descuadran la vuelta', () => {
    const claims = [claim('a', 1), claim('t', 2, 'time_limited'), claim('b', 3), claim('t', 4, 'time_limited')]
    expect([...getCurrentCycleClaimedIds(C, 2, claims, { [C]: 1 })]).toEqual([])
  })
})
