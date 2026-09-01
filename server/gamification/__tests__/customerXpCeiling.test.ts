import { describe, expect, it } from 'vitest'
import { xpCeilingFrom } from '../customerXpCeiling.ts'

// Totales del catálogo local (src/data/gamificationMissions.ts).
const CATALOG = {
  weeklyMissionXp: 980,
  monthlyMissionXp: 2330,
  historicalMissionXp: 30_730,
  weeklyBonusXp: 150,
  perVisitXp: 25,
}

describe('xpCeilingFrom', () => {
  it('cliente recién registrado, sin visitas', () => {
    const ceiling = xpCeilingFrom({
      ...CATALOG,
      visitCount: 0,
      weeksActive: 2,
      monthsActive: 2,
    })
    // historical 30730 + 2*(980+150) + 2*2330 + slack 3000
    expect(ceiling).toBe(30_730 + 2 * 1130 + 2 * 2330 + 3000)
  })

  it('crece con las visitas confirmadas', () => {
    const base = xpCeilingFrom({ ...CATALOG, visitCount: 0, weeksActive: 4, monthsActive: 2 })
    const withVisits = xpCeilingFrom({ ...CATALOG, visitCount: 10, weeksActive: 4, monthsActive: 2 })
    expect(withVisits - base).toBe(10 * 25)
  })

  it('crece con las semanas y meses activos', () => {
    const y1 = xpCeilingFrom({ ...CATALOG, visitCount: 0, weeksActive: 52, monthsActive: 12 })
    const y2 = xpCeilingFrom({ ...CATALOG, visitCount: 0, weeksActive: 104, monthsActive: 24 })
    expect(y2).toBeGreaterThan(y1)
    expect(y2 - y1).toBe(52 * 1130 + 12 * 2330)
  })

  it('nunca es negativo y trata los periodos mínimos como 1', () => {
    const ceiling = xpCeilingFrom({
      visitCount: -5,
      weeksActive: 0,
      monthsActive: 0,
      weeklyMissionXp: -1,
      monthlyMissionXp: -1,
      historicalMissionXp: -1,
      weeklyBonusXp: -1,
      perVisitXp: -1,
    })
    expect(ceiling).toBeGreaterThanOrEqual(0)
  })

  it('un jugador legítimo de un año está muy por debajo del techo', () => {
    // Nivel 7 (máximo) ronda los 10 000 XP; el techo de un año debe superarlo
    // con holgura para no recortar a nadie real.
    const ceiling = xpCeilingFrom({ ...CATALOG, visitCount: 50, weeksActive: 54, monthsActive: 14 })
    expect(ceiling).toBeGreaterThan(90_000)
  })
})
