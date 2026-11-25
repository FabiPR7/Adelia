import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import styles from './OpenInAppPrompt.module.css'

// Al abrir en el móvil una página de restaurante (lo normal al leer un QR de
// mesa, carta o promo) preguntamos si seguir en el navegador o abrirla en la
// app de Adelia. La app entiende las mismas rutas con su esquema adeliamobile://.
const APP_SCHEME = 'adeliamobile'
const ANDROID_PACKAGE = 'com.adelia'
const DECIDED_KEY = 'adelia-open-in-app-decided'
const MISSING_PARAM = 'sin-app'

type Platform = 'android' | 'ios' | null

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  // iPad con iPadOS se presenta como Mac con pantalla táctil.
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  return null
}

function readDecided(): boolean {
  try {
    return window.sessionStorage.getItem(DECIDED_KEY) === '1'
  } catch {
    return false
  }
}

function saveDecided() {
  try {
    window.sessionStorage.setItem(DECIDED_KEY, '1')
  } catch {
    // Sin almacenamiento: volverá a preguntar en la siguiente página, sin más.
  }
}

function isStandaloneApp(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
}

export default function OpenInAppPrompt() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [missingApp, setMissingApp] = useState(false)
  const platform = detectPlatform()

  const params = new URLSearchParams(location.search)
  const cameBackWithoutApp = params.has(MISSING_PARAM)
  // /cancelar no: el enlace del correo lleva un código que la app no sabe usar
  // (abriría la ficha del local y el invitado no podría cancelar).
  const eligiblePath = location.pathname.startsWith('/reservar/')
    && !/\/cancelar\/?$/.test(location.pathname)

  useEffect(() => {
    if (!platform || !eligiblePath || isStandaloneApp()) return
    if (cameBackWithoutApp) {
      // Android nos devuelve aquí cuando la app no está instalada.
      saveDecided()
      setMissingApp(true)
      return
    }
    if (!readDecided()) setOpen(true)
  }, [platform, eligiblePath, cameBackWithoutApp])

  useEffect(() => {
    if (!missingApp) return undefined
    const timer = window.setTimeout(() => setMissingApp(false), 6000)
    return () => window.clearTimeout(timer)
  }, [missingApp])

  if (!platform || !eligiblePath) return null

  // Sin `qr`: el escaneo ya lo contó la web, la app no tiene que sumarlo otra vez.
  const appSearchParams = new URLSearchParams(location.search)
  appSearchParams.delete('qr')
  const appSearch = appSearchParams.toString()
  const appPath = `${location.pathname.replace(/^\/+/, '')}${appSearch ? `?${appSearch}` : ''}`

  const stayInBrowser = () => {
    saveDecided()
    setOpen(false)
  }

  const openInApp = () => {
    saveDecided()
    setOpen(false)

    if (platform === 'android') {
      const fallback = new URL(window.location.href)
      fallback.searchParams.set(MISSING_PARAM, '1')
      window.location.href = `intent://${appPath}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};`
        + `S.browser_fallback_url=${encodeURIComponent(fallback.toString())};end`
      return
    }

    // iOS: si la app no está, la página sigue visible y lo avisamos.
    const startedAt = Date.now()
    window.location.href = `${APP_SCHEME}://${appPath}`
    window.setTimeout(() => {
      if (document.visibilityState === 'visible' && Date.now() - startedAt < 4000) {
        setMissingApp(true)
      }
    }, 1800)
  }

  // Fuera de #root: el aviso de cookies deja #root inerte mientras no se decide.
  return createPortal(
    <>
      {open ? (
        <div className={styles.backdrop} role="presentation">
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-in-app-title"
            aria-describedby="open-in-app-text"
          >
            <span className={styles.grabber} aria-hidden="true" />
            <p className={styles.eyebrow}>Adelia</p>
            <h2 id="open-in-app-title" className={styles.title}>¿Dónde quieres verlo?</h2>
            <p id="open-in-app-text" className={styles.text}>
              Ábrelo en la app de Adelia o sigue aquí en el navegador. Verás lo mismo en los dos.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={openInApp}>
                Abrir en la app
              </button>
              <button type="button" className={styles.secondary} onClick={stayInBrowser}>
                Seguir en el navegador
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {missingApp ? (
        <div className={styles.toast} role="status">
          No hemos encontrado la app de Adelia en este móvil. Sigue aquí en el navegador.
        </div>
      ) : null}
    </>,
    document.body,
  )
}
