import { describe, expect, it } from 'vitest'
import { leaderboardFromLiveRows } from '../gamificationLeaderboard'

const row = (uid: string, xp: number, isYou = false) => ({
  uid, displayName: uid, xp, photoUrl: '', homeCountry: 'España', homeCity: '', isYou,
})

const rankOf = (rows: ReturnType<typeof row>[], uid: string) =>
  leaderboardFromLiveRows(rows).find((entry) => entry.id === uid)?.rank

describe('ranking: sube y baja con el XP', () => {
  it('ordena por XP: más XP, mejor puesto', () => {
    const rows = [row('stan', 2970, true), row('fabi', 7511), row('fabian', 150)]
    expect(rankOf(rows, 'fabi')).toBe(1)
    expect(rankOf(rows, 'stan')).toBe(2)
    expect(rankOf(rows, 'fabian')).toBe(3)
  })

  it('si Stan gana XP y adelanta a Fabi, sube al 1 y Fabi baja al 2', () => {
    const rows = [row('stan', 7600, true), row('fabi', 7511), row('fabian', 150)]
    expect(rankOf(rows, 'stan')).toBe(1)
    expect(rankOf(rows, 'fabi')).toBe(2)
  })

  it('si Fabi pierde XP por una cancelación, baja de puesto', () => {
    const rows = [row('stan', 2970, true), row('fabi', 2000), row('fabian', 150)]
    expect(rankOf(rows, 'fabi')).toBe(2)
    expect(rankOf(rows, 'stan')).toBe(1)
  })
})
