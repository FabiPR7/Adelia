// El catálogo base del juego existe en la web (src/data, que se copia a la app) y en el
// servidor (que es quien calcula). Este test falla si se cambia uno y no el otro.
import { describe, expect, it } from 'vitest'
import * as webMissions from '../../../../src/data/gamificationMissions'
import * as webLevels from '../../../../src/data/gamificationLevels'
import * as webTypes from '../../../../src/types/gamification'
import * as serverMissions from '../missionsData.ts'
import * as serverLevels from '../levelsData.ts'
import * as serverTypes from '../types.ts'

describe('catálogo del juego: servidor = web', () => {
  it('mismas misiones (id, xp, objetivo, grupo)', () => {
    const pick = (list: Array<{ id: string; xp: number; target: number; cadence: string; rotationGroup?: string }>) =>
      list.map(({ id, xp, target, cadence, rotationGroup }) => ({ id, xp, target, cadence, rotationGroup }))
    expect(pick(serverMissions.WEEKLY_MISSIONS)).toEqual(pick(webMissions.WEEKLY_MISSIONS))
    expect(pick(serverMissions.MONTHLY_MISSION_POOL)).toEqual(pick(webMissions.MONTHLY_MISSION_POOL))
    expect(pick(serverMissions.HISTORICAL_MISSIONS)).toEqual(pick(webMissions.HISTORICAL_MISSIONS))
  })

  it('mismos niveles', () => {
    expect(serverLevels.GAMIFICATION_LEVELS.map(({ level, minXp, maxXp }) => ({ level, minXp, maxXp })))
      .toEqual(webLevels.GAMIFICATION_LEVELS.map(({ level, minXp, maxXp }) => ({ level, minXp, maxXp })))
  })

  it('mismos ajustes y estado inicial', () => {
    expect(serverTypes.WEEKLY_MISSION_BONUS_XP).toBe(webTypes.WEEKLY_MISSION_BONUS_XP)
    expect(serverTypes.WEEKLY_BONUS_TARGET).toBe(webTypes.WEEKLY_BONUS_TARGET)
    expect(serverTypes.CONFIRMED_RESERVATION_XP).toBe(webTypes.CONFIRMED_RESERVATION_XP)
    expect(Object.keys(serverTypes.defaultGamificationState()).sort())
      .toEqual(Object.keys(webTypes.defaultGamificationState()).sort())
  })
})
