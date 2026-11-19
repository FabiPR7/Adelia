import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { enableFirebaseAnalytics } from '../config/firebase'
import {
  clearAnalyticsStorage,
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
  clearAnalyticsStorage()
  if (previousAnalytics === true) {
    window.location.reload()
  }
}

/**
 * Aviso de cookies. Hasta que la persona acepta, rechaza o configura, la web
 * queda bloqueada detrás de él. Solo en las páginas legales se deja leer sin
 * bloquear, para poder consultar la política antes de decidir.
 */
function CookieConsentBanner() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [configure, setConfigure] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const onLegalPage = location.pathname.startsWith('/legal')
  const blocking = visible && !onLegalPage

  useEffect(() => {
    const stored = readCookieConsent()
    if (stored?.analytics) {
      void enableFirebaseAnalytics()
    } else {
      // Sin consentimiento no debe quedar ninguna cookie de analítica: Google
      // puede reescribir alguna justo antes de recargar al retirarlo.
      clearAnalyticsStorage()
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

  // Mientras bloquea: el resto de la web no se puede tocar, ni con el teclado,
  // y no se desplaza por detrás.
  useEffect(() => {
    if (!blocking) {
      return undefined
    }
    const root = document.getElementById('root')
    const previousOverflow = document.body.style.overflow
    root?.setAttribute('inert', '')
    root?.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => firstButtonRef.current?.focus())

    return () => {
      root?.removeAttribute('inert')
      root?.removeAttribute('aria-hidden')
      document.body.style.overflow = previousOverflow
    }
  }, [blocking])

  // Mantiene el foco dentro del aviso (para navegadores sin «inert»).
  useEffect(() => {
    if (!blocking) {
      return undefined
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !cardRef.current) {
        return
      }
      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>('a[href], button, input'),
      ).filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) {
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!cardRef.current.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [blocking])

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

  return createPortal(
    <div
      className={`${styles.wrap} ${blocking ? styles.wrapBlocking : ''}`}
      role="dialog"
      aria-modal={blocking ? 'true' : undefined}
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-text"
    >
      <div ref={cardRef} className={styles.card}>
        <p className={styles.eyebrow}>Cookies</p>
        <h2 id="cookie-consent-title">Tu privacidad en Adelia</h2>
        <p id="cookie-consent-text" className={styles.lead}>
          Usamos cookies necesarias para que la web funcione (sesión y seguridad). Si aceptas, también
          medimos el uso con Google Analytics y con estadísticas propias para mejorar Adelia y dar
          informes agregados a los restaurantes. No hay publicidad de terceros.{' '}
          <Link to="/legal/cookies">Política de cookies</Link>
          {' · '}
          <Link to="/legal/privacidad">Privacidad</Link>
        </p>
        {blocking ? (
          <p className={styles.required}>Elige una opción para seguir usando Adelia.</p>
        ) : null}

        {configure ? (
          <div className={styles.options}>
            <div className={styles.option}>
              <span>
                <strong>Necesarias</strong>
                <small>Sesión, seguridad y tus preferencias. Siempre activas.</small>
              </span>
              <span className={styles.always}>Siempre</span>
            </div>
            <label className={styles.option}>
              <span>
                <strong>Analíticas</strong>
                <small>Google Analytics y estadísticas propias.</small>
              </span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
              />
            </label>
          </div>
        ) : null}

        <div className={styles.actions}>
          {configure ? (
            <button
              ref={firstButtonRef}
              type="button"
              className={styles.primary}
              onClick={() => save(analytics)}
            >
              Guardar mi elección
            </button>
          ) : (
            <>
              <button
                ref={firstButtonRef}
                type="button"
                className={styles.primary}
                onClick={() => save(true)}
              >
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
    </div>,
    document.body,
  )
}

export default CookieConsentBanner
