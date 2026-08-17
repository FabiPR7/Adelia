export const COOKIE_CONSENT_STORAGE_KEY = 'adelia.cookieConsent.v1'
export const COOKIE_SETTINGS_EVENT = 'adelia:open-cookie-settings'

export interface CookieConsent {
  necessary: true
  analytics: boolean
  decidedAt: string
}

export function readCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<CookieConsent>
    if (parsed.necessary !== true || typeof parsed.analytics !== 'boolean') {
      return null
    }
    return {
      necessary: true,
      analytics: parsed.analytics,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function writeCookieConsent(analytics: boolean): CookieConsent {
  const consent: CookieConsent = {
    necessary: true,
    analytics,
    decidedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent))
  } catch {
    // modo privado u almacenamiento lleno: seguimos en memoria
  }
  return consent
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))
}
