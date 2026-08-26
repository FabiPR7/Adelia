import { describe, expect, it } from 'vitest'
import { getBadgesForProfile } from '../gamificationBadges'

describe('getBadgesForProfile', () => {
  it('does not unlock a pile of badges from a single first visit', () => {
    expect(getBadgesForProfile(1, 1, 0, 1)).toEqual(['first_reservation'])
  })

  it('does not treat one mission as explorer or social diner', () => {
    const badges = getBadgesForProfile(1, 1, 0)
    expect(badges).not.toContain('explorer')
    expect(badges).not.toContain('social_diner')
    expect(badges).not.toContain('mission_hunter')
    expect(badges).not.toContain('offer_hunter')
  })

  it('keeps level badges tied to actual level', () => {
    expect(getBadgesForProfile(4, 20, 8, 10)).not.toContain('level_5')
    expect(getBadgesForProfile(5, 20, 8, 10)).toContain('level_5')
  })
})
