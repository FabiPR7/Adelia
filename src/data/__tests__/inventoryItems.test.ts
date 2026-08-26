import { describe, expect, it } from 'vitest'
import { matchingReservationTokens, rewardsForLevel, rewardsForMission, rewardsForWeeklyBonus } from '../inventoryItems'

describe('matchingReservationTokens', () => {
  it('rejects cards that do not cover the promo minimum', () => {
    const inventory = {
      mesa_1: 2,
      mesa_1_15: 1,
      mesa_1_40: 1,
    }

    const forForty = matchingReservationTokens(inventory, 4000)
    expect(forForty.map((item) => item.id)).toEqual(['mesa_1_40'])

    const forFifteen = matchingReservationTokens(inventory, 1500)
    expect(forFifteen.map((item) => item.id)).toEqual(['mesa_1_15', 'mesa_1_40'])
  })

  it('allows free mesa cards only when the promo has no minimum', () => {
    const inventory = { mesa_1: 1, mesa_1_15: 1 }
    const free = matchingReservationTokens(inventory, 0)
    expect(free.map((item) => item.id)).toEqual(['mesa_1', 'mesa_1_15'])
  })

  it('always allows keys and stamps that cover min spend', () => {
    const inventory = { llave_promo: 1, mesa_1: 1 }
    const tokens = matchingReservationTokens(inventory, 4000)
    expect(tokens.map((item) => item.id)).toEqual(['llave_promo'])
  })
})

describe('mission and level rewards', () => {
  it('does not give inventory loot for easy weekly missions', () => {
    expect(rewardsForMission('reserva_confirmada_semana', 'weekly', 60)).toEqual([])
    expect(rewardsForMission('fiel_seguidor', 'weekly', 45)).toEqual([])
    expect(rewardsForMission('voz_experiencia', 'weekly', 40)).toEqual([])
  })

  it('does not give inventory loot for first historical badges', () => {
    expect(rewardsForMission('debut_gastronomico', 'historical', 150)).toEqual([])
    expect(rewardsForMission('primer_consumo_libre', 'historical', 150)).toEqual([])
    expect(rewardsForMission('corazon_favorito', 'historical', 150)).toEqual([])
  })

  it('gives a single modest prize for a harder weekly mechanic', () => {
    const grants = rewardsForMission('gasto_minimo_semana', 'weekly', 90)
    expect(grants).toHaveLength(1)
    expect(['mesa_1', 'invitacion_extra']).toContain(grants[0]?.itemId)
  })

  it('does not dump several cards on level 2', () => {
    expect(rewardsForLevel(2)).toEqual([{ itemId: 'mesa_1', quantity: 1 }])
  })

  it('keeps cancel shields off early levels', () => {
    const early = [2, 3, 4, 5].flatMap((level) => rewardsForLevel(level).map((grant) => grant.itemId))
    expect(early).not.toContain('escudo_mesa')
    expect(early).not.toContain('sello_casa')
    expect(rewardsForLevel(6).some((grant) => grant.itemId === 'escudo_mesa')).toBe(true)
  })

  it('gives a single easy card for the weekly bonus pack', () => {
    expect(rewardsForWeeklyBonus('2026-W35')).toHaveLength(1)
  })
})


describe('matchingReservationTokens', () => {
  it('rejects cards that do not cover the promo minimum', () => {
    const inventory = {
      mesa_1: 2,
      mesa_1_15: 1,
      mesa_1_40: 1,
    }

    const forForty = matchingReservationTokens(inventory, 4000)
    expect(forForty.map((item) => item.id)).toEqual(['mesa_1_40'])

    const forFifteen = matchingReservationTokens(inventory, 1500)
    expect(forFifteen.map((item) => item.id)).toEqual(['mesa_1_15', 'mesa_1_40'])
  })

  it('allows free mesa cards only when the promo has no minimum', () => {
    const inventory = { mesa_1: 1, mesa_1_15: 1 }
    const free = matchingReservationTokens(inventory, 0)
    expect(free.map((item) => item.id)).toEqual(['mesa_1', 'mesa_1_15'])
  })

  it('always allows keys and stamps that cover min spend', () => {
    const inventory = { llave_promo: 1, mesa_1: 1 }
    const tokens = matchingReservationTokens(inventory, 4000)
    expect(tokens.map((item) => item.id)).toEqual(['llave_promo'])
  })
})
