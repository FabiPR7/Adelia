import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/auth', () => ({
  getIdToken: vi.fn(async () => null),
}))

vi.mock('../cookieConsent', () => ({
  readCookieConsent: vi.fn(),
}))

const { readCookieConsent } = await import('../cookieConsent')

function loadModule() {
  vi.resetModules()
  return import('../appEvents')
}

const consentGranted = { necessary: true as const, analytics: true, decidedAt: '' }
const consentDenied = { necessary: true as const, analytics: false, decidedAt: '' }

describe('trackAppEvent', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'anon12345678'),
      setItem: vi.fn(),
    })
    vi.mocked(readCookieConsent).mockReturnValue(consentGranted)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('does nothing without analytics consent', async () => {
    vi.mocked(readCookieConsent).mockReturnValue(consentDenied)
    const { trackAppEvent } = await loadModule()
    for (let i = 0; i < 30; i += 1) {
      trackAppEvent('restaurant_view', { companyId: `c${i}` })
    }
    await vi.advanceTimersByTimeAsync(20_000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does nothing when disabled (company/admin session)', async () => {
    const { trackAppEvent, setAppEventsDisabled } = await loadModule()
    setAppEventsDisabled(true)
    for (let i = 0; i < 30; i += 1) {
      trackAppEvent('menu_zone_view', { companyId: `c${i}` })
    }
    await vi.advanceTimersByTimeAsync(20_000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('flushes once the queue fills up', async () => {
    const { trackAppEvent } = await loadModule()
    for (let i = 0; i < 15; i += 1) {
      trackAppEvent('promo_view', { companyId: `c${i}`, entityId: `p${i}` })
    }
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.anonId).toBe('anon12345678')
    expect(body.events).toHaveLength(15)
    expect(body.events[0]).toMatchObject({ type: 'promo_view', companyId: 'c0', entityId: 'p0' })
  })

  it('dedupes the same event within 30s', async () => {
    const { trackAppEvent } = await loadModule()
    trackAppEvent('restaurant_view', { companyId: 'c1' })
    trackAppEvent('restaurant_view', { companyId: 'c1' })
    trackAppEvent('restaurant_view', { companyId: 'c1' })
    await vi.advanceTimersByTimeAsync(12_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.events).toHaveLength(1)
  })

  it('flushes queued events on the interval timer', async () => {
    const { trackAppEvent } = await loadModule()
    trackAppEvent('favorite_add', { companyId: 'c1' })
    trackAppEvent('favorite_add', { companyId: 'c2' })
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(12_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
