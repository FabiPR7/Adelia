import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { QrKind } from './helpers'

/**
 * Escaneos de los QR impresos del local. Se cuentan aunque se rechacen las
 * cookies: solo se suma 1 al contador del restaurante, sin identificador del
 * dispositivo ni de la cuenta, y sin guardar nada en el móvil.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ENDPOINT = `${API_BASE}/api/public/events`
const QR_KINDS: QrKind[] = ['reservas', 'carta', 'promo']

const counted = new Set<string>()
/** Locales a los que se llegó por un QR en esta visita (solo en memoria). */
const qrCompanies = new Set<string>()

export function parseQrKind(value: string | null): QrKind | null {
  return QR_KINDS.includes(value as QrKind) ? (value as QrKind) : null
}

export function cameFromQr(companyId: string): boolean {
  return qrCompanies.has(companyId)
}

function send(event: Record<string, string>): void {
  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analyticsConsent: false, events: [event] }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Nunca rompe la página.
  }
}

export function trackQrScan(companyId: string, kind: QrKind, entityId?: string): void {
  const key = `${kind}:${companyId}:${entityId ?? ''}`
  if (!companyId || counted.has(key)) return
  counted.add(key)
  qrCompanies.add(companyId)
  send({ type: 'qr_scan', companyId, entityKind: kind, ...(entityId ? { entityId } : {}) })
}

/** Reserva hecha después de llegar por un QR del local. */
export function trackReservationFromQr(companyId: string): void {
  if (!cameFromQr(companyId)) return
  send({ type: 'reservation_from_qr', companyId })
}

/**
 * En las páginas a las que lleva un QR: si el enlace trae `?qr=`, cuenta el
 * escaneo una vez y quita la marca (así recargar o compartir no suma otro).
 */
export function useQrScan(companyId: string | undefined | null, entityId?: string | null): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const kind = parseQrKind(searchParams.get('qr'))

  useEffect(() => {
    if (!kind || !companyId) return
    trackQrScan(companyId, kind, entityId ?? undefined)
    const next = new URLSearchParams(searchParams)
    next.delete('qr')
    setSearchParams(next, { replace: true })
  }, [kind, companyId, entityId, searchParams, setSearchParams])
}
