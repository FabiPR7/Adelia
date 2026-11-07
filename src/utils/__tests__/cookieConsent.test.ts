import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAnalyticsStorage,
  COOKIE_CONSENT_STORAGE_KEY,
  readCookieConsent,
  writeCookieConsent,
} from '../cookieConsent'

const store = (decidedAt: string) => localStorage.setItem(
  COOKIE_CONSENT_STORAGE_KEY,
  JSON.stringify({ necessary: true, analytics: true, decidedAt }),
)

describe('cookie consent', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps a recent decision', () => {
    writeCookieConsent(true)

    expect(readCookieConsent()?.analytics).toBe(true)
  })

  it('asks again after 24 months', () => {
    store(new Date(Date.now() - 25 * 30 * 24 * 60 * 60 * 1000).toISOString())

    expect(readCookieConsent()).toBeNull()
  })

  it('does not treat a decision without a valid date as consent', () => {
    store('sin fecha')

    expect(readCookieConsent()).toBeNull()
  })

  it('removes the analytics identifier when consent is withdrawn', () => {
    localStorage.setItem('adelia_anon_id', 'abc')

    clearAnalyticsStorage()

    expect(localStorage.getItem('adelia_anon_id')).toBeNull()
  })
})
