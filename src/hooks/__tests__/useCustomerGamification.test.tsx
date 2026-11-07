import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultGamificationState } from '../../types/gamification'
import type { CustomerGamificationState } from '../../types/gamification'
import { getWeekKey, rotateMonthlyMissions, rotateWeeklyMissions } from '../../utils/gamificationProgress'

const mocks = vi.hoisted(() => ({
  gamification: null as unknown,
  sync: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1' },
    profile: { role: 'customer', gamification: mocks.gamification },
    patchProfileGamification: vi.fn(),
  }),
}))

vi.mock('../../services/firestore', () => ({
  updateCustomerGamification: mocks.sync,
}))

vi.mock('../../services/customerNotifications', () => ({
  syncGamificationNotifications: vi.fn(async () => undefined),
}))

import { useCustomerGamification } from '../useCustomerGamification'

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function renderWith(state: CustomerGamificationState) {
  mocks.gamification = state
  return renderHook(() => useCustomerGamification({
    reservations: [],
    favoriteSlugs: [],
    restaurants: [],
    promotionCompanyIds: new Set<string>(),
    consumptions: [],
    enabled: true,
  } as unknown as Parameters<typeof useCustomerGamification>[0]))
}

describe('useCustomerGamification period rollover', () => {
  beforeEach(() => {
    mocks.sync.mockReset()
    mocks.sync.mockResolvedValue({ inventory: {}, grantedItemKeys: [], newItemGrantBatches: [], deferred: false })
  })

  it('does not pay again the missions completed in a previous week and month', async () => {
    const weekly = rotateWeeklyMissions().map((mission) => mission.id)
    const monthly = rotateMonthlyMissions().map((mission) => mission.id)

    renderWith({
      ...defaultGamificationState(),
      xp: 1000,
      weekKey: '2020-W01',
      monthKey: '2020-01',
      weeklyCompleted: weekly,
      monthlyCompleted: monthly,
    })

    await waitFor(() => expect(mocks.sync).toHaveBeenCalled())
    const proposed = mocks.sync.mock.calls[0][1] as CustomerGamificationState

    expect(proposed.weekKey).toBe(getWeekKey())
    expect(proposed.monthKey).toBe(currentMonthKey())
    expect(proposed.weeklyCompleted).toEqual([])
    expect(proposed.monthlyCompleted).toEqual([])
    expect(proposed.xp).toBe(1000)
  })

  it('keeps missions completed in the current period without paying them twice', async () => {
    const weekly = rotateWeeklyMissions().map((mission) => mission.id).slice(0, 1)

    renderWith({
      ...defaultGamificationState(),
      xp: 1000,
      weekKey: getWeekKey(),
      monthKey: currentMonthKey(),
      weeklyCompleted: weekly,
      favoriteSlugs: [],
    } as CustomerGamificationState)

    await waitFor(() => expect(mocks.sync).toHaveBeenCalled())
    const proposed = mocks.sync.mock.calls[0][1] as CustomerGamificationState

    expect(proposed.weeklyCompleted).toEqual(weekly)
    expect(proposed.xp).toBe(1000)
  })
})
