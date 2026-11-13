import { describe, expect, it } from 'vitest'

describe('applyMissionCatalog', () => {
  it('con catálogo publicado deja solo las misiones que conoce el servidor, con su XP', async () => {
    const mod = await import('../gamificationMissions')
    const all = mod.allMissionDefinitions()
    const kept = all.slice(0, 3).map((mission) => ({ ...mission, xp: 999 }))
    mod.applyMissionCatalog(kept)
    const after = mod.allMissionDefinitions()
    expect(after.map((mission) => mission.id).sort()).toEqual(kept.map((mission) => mission.id).sort())
    expect(after.every((mission) => mission.xp === 999)).toBe(true)
  })

  it('sin catálogo (base vacía o sin conexión) mantiene las del código', async () => {
    const mod = await import('../gamificationMissions?fresh')
    const before = mod.allMissionDefinitions().length
    mod.applyMissionCatalog([])
    expect(mod.allMissionDefinitions().length).toBe(before)
  })
})
