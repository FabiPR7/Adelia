import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { enableFirebaseAnalytics } from '../config/firebase'
import {
  COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  writeCookieConsent,
} from '../utils/cookieConsent'
import styles from './CookieConsentBanner.module.css'

function applyAnalyticsConsent(enabled: boolean, previousAnalytics: boolean | null) {
  if (enabled) {
    void enableFirebaseAnalytics()
    return
  }
  if (previousAnalytics === true) {
    window.location.reload()
  }
}

function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [configure, setConfigure] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    const stored = readCookieConsent()
    if (stored?.analytics) {
      void enableFirebaseAnalytics()
    }
    if (!stored) {
      setVisible(true)
    }

    const onOpen = () => {
      const current = readCookieConsent()
      setAnalytics(current?.analytics === true)
      setConfigure(true)
      setVisible(true)
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, onOpen)
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, onOpen)
  }, [])

  const save = (nextAnalytics: boolean) => {
    const previous = readCookieConsent()?.analytics ?? null
    writeCookieConsent(nextAnalytics)
    setVisible(false)
    setConfigure(false)
    applyAnalyticsConsent(nextAnalytics, previous)
  }

  if (!visible) {
    return null
  }

  return (
    <div className={styles.wrap} role="dialog" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-text">
      <div className={styles.card}>
        <p className={styles.eyebrow}>Cookies</p>
        <h2 id="cookie-consent-title">Tu privacidad en Adelia</h2>
        <p id="cookie-consent-text" className={styles.lead}>
          Usamos cookies necesarias para que la web funcione (sesión y seguridad).
          Las analíticas de Firebase solo se activan si tú lo aceptas.{' '}
          <Link to="/legal/cookies">Política de cookies</Link>
          {' · '}
          <Link to="/legal/privacidad">Privacidad</Link>
        </p>

        {configure ? (
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
            />
            <span>Cookies analíticas (Firebase Analytics)</span>
          </label>
        ) : null}

        <div className={styles.actions}>
          {configure ? (
            <button type="button" className={styles.primary} onClick={() => save(analytics)}>
              Guardar
            </button>
          ) : (
            <>
              <button type="button" className={styles.primary} onClick={() => save(true)}>
                Aceptar
              </button>
              <button type="button" className={styles.secondary} onClick={() => save(false)}>
                Rechazar
              </button>
              <button type="button" className={styles.ghost} onClick={() => setConfigure(true)}>
                Configurar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CookieConsentBanner
