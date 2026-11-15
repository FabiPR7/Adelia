import { describe, expect, it } from 'vitest'
import { barAndRestaurantProgress } from '../gamificationProgress'

const types = new Map<string, string[]>([
  ['solo-bar', ['bar']],
  ['solo-restaurante', ['restaurant']],
  ['los-dos', ['bar', 'restaurant']],
])

describe('misión De Barra y Mantel', () => {
  it('un local que es bar y restaurante no la completa solo', () => {
    expect(barAndRestaurantProgress([{ companyId: 'los-dos' }], types)).toEqual({ current: 1, completed: false })
  })

  it('un bar y un restaurante distintos la completan', () => {
    expect(barAndRestaurantProgress([{ companyId: 'solo-bar' }, { companyId: 'solo-restaurante' }], types).completed).toBe(true)
  })

  it('el local mixto cuenta como restaurante si además va a un bar', () => {
    expect(barAndRestaurantProgress([{ companyId: 'los-dos' }, { companyId: 'solo-bar' }], types).completed).toBe(true)
  })

  it('sin visitas, 0', () => {
    expect(barAndRestaurantProgress([], types)).toEqual({ current: 0, completed: false })
  })
})
