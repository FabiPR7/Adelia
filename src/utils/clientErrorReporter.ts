/**
 * Manda al servidor los fallos de la web (sin datos personales) para que salgan en
 * Google Cloud Error Reporting. Como mucho 5 por visita y sin repetir el mismo.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? ''
const MAX_REPORTS_PER_VISIT = 5

let sent = 0
let installed = false
const seen = new Set<string>()

/** Quita correos, tokens y números largos que pudieran colarse en un mensaje. */
export function scrubErrorText(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
    .replace(/\b(eyJ[\w-]{10,}\.[\w-]+\.[\w-]+)\b/g, '[token]')
    .replace(/\b\d{7,}\b/g, '[número]')
    .slice(0, 4000)
}

export function reportClientError(error: unknown, origin: string): void {
  if (sent >= MAX_REPORTS_PER_VISIT || import.meta.env.DEV) {
    return
  }
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Error desconocido')
  const message = scrubErrorText(`${err.name}: ${err.message}`)
  if (seen.has(message)) {
    return
  }
  seen.add(message)
  sent += 1

  const body = JSON.stringify({
    message,
    stack: scrubErrorText(err.stack ?? ''),
    origin,
    path: window.location.pathname,
  })
  try {
    if (!navigator.sendBeacon?.(`${API_BASE}/api/public/client-errors`, new Blob([body], { type: 'application/json' }))) {
      void fetch(`${API_BASE}/api/public/client-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => undefined)
    }
  } catch {
    // Informar de un fallo nunca debe provocar otro.
  }
}

export function installClientErrorReporter(): void {
  if (installed || typeof window === 'undefined') {
    return
  }
  installed = true
  window.addEventListener('error', (event) => {
    reportClientError(event.error ?? event.message, 'window.error')
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'unhandledrejection')
  })
}
