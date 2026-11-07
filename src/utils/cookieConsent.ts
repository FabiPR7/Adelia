export const COOKIE_CONSENT_STORAGE_KEY = 'adelia.cookieConsent.v1'
export const COOKIE_SETTINGS_EVENT = 'adelia:open-cookie-settings'
/** La AEPD recomienda renovar el consentimiento como máximo cada 24 meses. */
const CONSENT_MAX_AGE_MS = 24 * 30 * 24 * 60 * 60 * 1000

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
    const decidedAt = typeof parsed.decidedAt === 'string' ? Date.parse(parsed.decidedAt) : NaN
    if (Number.isNaN(decidedAt) || Date.now() - decidedAt > CONSENT_MAX_AGE_MS) {
      return null
    }
    return {
      necessary: true,
      analytics: parsed.analytics,
      decidedAt: parsed.decidedAt as string,
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

/** Al retirar el consentimiento se borra lo que solo existía por él. */
export function clearAnalyticsStorage(): void {
  try {
    window.localStorage.removeItem('adelia_anon_id')
  } catch {
    // Sin almacenamiento disponible no hay nada que borrar.
  }
  const hostParts = window.location.hostname.split('.')
  const domains = ['', ...hostParts.map((_, index) => `.${hostParts.slice(index).join('.')}`)]
  for (const entry of document.cookie.split(';')) {
    const name = entry.split('=')[0].trim()
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const domain of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`
      }
    }
  }
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))
}
