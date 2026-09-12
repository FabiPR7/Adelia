import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readSavedPromotionIds, toggleSavedPromotionId } from '../savedPromotions'

describe('savedPromotions', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns an empty set when nothing is stored', () => {
    expect(readSavedPromotionIds('user@example.com').size).toBe(0)
  })

  it('adds then removes an id, persisting across reads', () => {
    const afterAdd = toggleSavedPromotionId('user@example.com', 'promo-1')
    expect(afterAdd.has('promo-1')).toBe(true)
    expect(readSavedPromotionIds('user@example.com').has('promo-1')).toBe(true)

    const afterRemove = toggleSavedPromotionId('user@example.com', 'promo-1')
    expect(afterRemove.has('promo-1')).toBe(false)
    expect(readSavedPromotionIds('user@example.com').size).toBe(0)
  })

  it('keeps lists separate per user key', () => {
    toggleSavedPromotionId('a@example.com', 'promo-a')
    toggleSavedPromotionId('b@example.com', 'promo-b')

    expect(readSavedPromotionIds('a@example.com')).toEqual(new Set(['promo-a']))
    expect(readSavedPromotionIds('b@example.com')).toEqual(new Set(['promo-b']))
  })

  it('ignores an empty user key', () => {
    expect(toggleSavedPromotionId('', 'promo-1').size).toBe(1)
    expect(readSavedPromotionIds('').size).toBe(0)
  })
})
