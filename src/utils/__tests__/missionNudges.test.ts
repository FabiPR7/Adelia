import { describe, expect, it } from 'vitest'
import type { MissionProgress } from '../../types/gamification'
import {
  closestMission,
  formatPendingBadge,
  isAlmostDone,
  missionAction,
  missionsFedByReservation,
  nextWeekStart,
  pendingMissions,
  remainingLabel,
  weekTimeLeftLabel,
} from '../missionNudges'

const mission = (id: string, current: number, target: number, xp = 50, completed = false): MissionProgress => ({
  mission: { id, name: id, description: '', xp, cadence: 'weekly', icon: '🏅', target },
  current,
  completed,
  progress: completed ? 1 : current / target,
})

describe('mission nudges', () => {
  it('only counts missions that are not completed', () => {
    const pending = pendingMissions([mission('a', 0, 1), mission('b', 1, 1, 50, true)], [mission('c', 1, 3)])
    expect(pending.map((item) => item.mission.id)).toEqual(['a', 'c'])
  })

  it('picks the closest mission, preferring more XP on a tie', () => {
    const closest = closestMission([mission('a', 1, 4, 100), mission('b', 2, 3, 40), mission('c', 2, 3, 90)])
    expect(closest?.mission.id).toBe('c')
    expect(closestMission([])).toBeNull()
  })

  it('treats half-way as almost done, but not finished missions', () => {
    expect(isAlmostDone(mission('a', 1, 2))).toBe(true)
    expect(isAlmostDone(mission('a', 1, 3))).toBe(false)
    expect(isAlmostDone(mission('a', 1, 1, 50, true))).toBe(false)
  })

  it('says how much is left in plain words', () => {
    expect(remainingLabel(mission('a', 0, 1))).toBe('Solo una vez')
    expect(remainingLabel(mission('a', 0, 3))).toBe('3 para completarla')
    expect(remainingLabel(mission('a', 2, 3))).toBe('Te falta 1')
    expect(remainingLabel(mission('a', 1, 5))).toBe('Te faltan 4')
  })

  it('sends each kind of mission to the screen where it can be advanced', () => {
    expect(missionAction({ id: 'reserva_confirmada_semana' }).to).toBe('/app/explorar')
    expect(missionAction({ id: 'consumo_sin_reserva_semana' }).to).toBe('/app/promociones')
    expect(missionAction({ id: 'critico_foto' }).to).toBe('/app/reservas')
    expect(missionAction({ id: 'visita_bar_semana' }).to).toBe('/app/explorar')
    expect(missionAction({ id: 'algo_nuevo' })).toEqual({ label: 'Ver misión', to: '/app/misiones' })
  })

  it('finds the missions an upcoming reservation will advance', () => {
    const fed = missionsFedByReservation([mission('reserva_confirmada_semana', 0, 1), mission('critico_foto', 0, 1)])
    expect(fed.map((item) => item.mission.id)).toEqual(['reserva_confirmada_semana'])
  })

  it('computes the time left in the week (weeks start on Monday)', () => {
    const wednesday = new Date(2026, 10, 11, 10, 0, 0)
    expect(nextWeekStart(wednesday).getDay()).toBe(1)
    expect(nextWeekStart(wednesday).getDate()).toBe(16)
    expect(weekTimeLeftLabel(wednesday)).toBe('Quedan 5 días')
    expect(weekTimeLeftLabel(new Date(2026, 10, 15, 20, 0, 0))).toBe('Termina en 4 h')
    expect(nextWeekStart(new Date(2026, 10, 16, 8, 0, 0)).getDate()).toBe(23)
  })

  it('caps the badge', () => {
    expect(formatPendingBadge(3)).toBe('3')
    expect(formatPendingBadge(14)).toBe('9+')
  })
})
