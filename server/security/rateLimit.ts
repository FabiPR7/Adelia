import type { NextFunction, Request, Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { authKey, clientKey, hashRateKey } from './requestIdentity.ts'

// Cada sesión puede pedir un token nuevo cuando quiera: si el límite fuera por
// token, bastaría con renovarlo para saltárselo. Se cuenta por usuario.
const tokenUidCache = new Map<string, string>()

async function stableAuthKey(req: Request, fallback: string): Promise<string> {
  const header = req.headers.authorization
  if (!canUseAdminSdk || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return fallback
  }
  const cached = tokenUidCache.get(fallback)
  if (cached) {
    return cached
  }
  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7))
    const key = `uid:${decoded.uid}`
    if (tokenUidCache.size > 5000) {
      tokenUidCache.clear()
    }
    tokenUidCache.set(fallback, key)
    return key
  } catch {
    return fallback
  }
}

interface RateEntry {
  count: number
  resetAt: number
}

const stores = new Map<string, Map<string, RateEntry>>()

function storeFor(name: string): Map<string, RateEntry> {
  let store = stores.get(name)
  if (!store) {
    store = new Map()
    stores.set(name, store)
  }
  return store
}

function take(store: Map<string, RateEntry>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  if (store.size > 4_000) {
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(entryKey)
      }
    }
    if (store.size > 12_000) {
      store.clear()
    }
  }

  const current = store.get(key)
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= max) {
    return false
  }
  current.count += 1
  return true
}

async function takeDistributed(
  name: string,
  key: string,
  max: number,
  windowMs: number,
  failClosed = false,
): Promise<boolean> {
  if (!canUseAdminSdk) {
    return true
  }

  const now = Date.now()
  const docId = hashRateKey(`${name}:${key}`)
  const ref = adminDb.collection('rateLimits').doc(docId)

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref)
      const data = snap.data() as { count?: number; resetAt?: number } | undefined
      if (!data || typeof data.resetAt !== 'number' || data.resetAt <= now) {
        transaction.set(ref, {
          count: 1,
          resetAt: now + windowMs,
          name,
          updatedAt: FieldValue.serverTimestamp(),
        })
        return true
      }
      if ((data.count ?? 0) >= max) {
        return false
      }
      transaction.update(ref, {
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return true
    })
  } catch (error) {
    console.error('Distributed rate limit error:', error)
    // Para buckets sensibles (auth) fallamos cerrado: si Firestore no responde,
    // preferimos rechazar el intento a quedarnos sin protección anti fuerza
    // bruta. El resto de buckets fallan abiertos para no tumbar la API.
    return !failClosed
  }
}

/**
 * Intentos de PIN de promociones por cliente y restaurante, compartidos entre
 * todas las copias del servidor. El PIN tiene 4 cifras: sin este tope se podía
 * adivinar probando combinaciones.
 */
export const PIN_ATTEMPTS_MESSAGE = 'Demasiados intentos con el PIN. Espera un rato o pide ayuda al personal.'

export async function takePromotionPinAttempt(uid: string, companyId: string): Promise<boolean> {
  return takeDistributed('promo-pin', `${uid}:${companyId}`, 12, 60 * 60_000)
}

/**
 * Correos que se mandan a una dirección concreta (recuperar contraseña): tope
 * por dirección y no solo por IP, para que no se pueda inundar un buzón desde
 * muchas IPs.
 */
export async function takeEmailSend(kind: string, email: string): Promise<boolean> {
  return takeDistributed(`mail-${kind}`, email.trim().toLowerCase(), 3, 60 * 60_000)
}

/** Reportes de restaurantes por cliente: 5 al día, para que no se usen para acosar a un local. */
export async function takeRestaurantReport(uid: string): Promise<boolean> {
  return takeDistributed('restaurant-report', uid, 5, 24 * 60 * 60_000)
}

/** Sugerencias por cliente: 5 al día. */
export async function takeSuggestion(uid: string): Promise<boolean> {
  return takeDistributed('suggestion', uid, 5, 24 * 60 * 60_000)
}

export function createRateLimit(maxRequests: number, windowMs: number, name = 'default') {
  const store = storeFor(`${name}:${maxRequests}:${windowMs}`)
  return (req: Request, res: Response, next: NextFunction) => {
    if (take(store, clientKey(req), maxRequests, windowMs)) {
      next()
      return
    }
    res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)))
    res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' })
  }
}

function bucketFor(req: Request): {
  name: string
  max: number
  windowMs: number
  key: string
  distributed?: boolean
  failClosed?: boolean
} {
  const url = req.originalUrl || req.path

  if (url.startsWith('/api/stripe/webhook') || url === '/api/health') {
    return { name: 'skip', max: 10_000, windowMs: 60_000, key: clientKey(req) }
  }

  if (
    url.startsWith('/api/auth/forgot-password')
    || url.startsWith('/api/auth/customer/forgot-password')
    || url.startsWith('/api/auth/reset-password')
    || url.startsWith('/api/auth/resolve-login')
    || url.startsWith('/api/auth/customer/pre-login')
    || url.startsWith('/api/auth/customer/register')
    || url.startsWith('/api/auth/change-initial-password')
    || url.startsWith('/api/auth/complete-initial-password-change')
  ) {
    return { name: 'auth', max: 20, windowMs: 15 * 60_000, key: clientKey(req), distributed: true, failClosed: true }
  }

  // Cada llamada manda un correo: sin tope propio servía para inundar un buzón.
  if (url.startsWith('/api/auth/customer/send-verification-email')) {
    return { name: 'verifyEmail', max: 4, windowMs: 30 * 60_000, key: authKey(req), distributed: true, failClosed: true }
  }

  if (url.startsWith('/api/auth/customer/bootstrap')) {
    return { name: 'authBootstrap', max: 12, windowMs: 15 * 60_000, key: clientKey(req), distributed: true, failClosed: true }
  }

  if (
    req.method === 'POST'
    && (
      (url.includes('/public/booking/') && url.endsWith('/reservations'))
      || url.includes('/deposit-intent')
      || url.includes('/public/booking/cancel')
      || url.startsWith('/api/public/billing/checkout')
      || url.startsWith('/api/public/billing/complete-signup')
      || url.startsWith('/api/public/billing/complete-free-signup')
    )
  ) {
    return { name: 'publicWrite', max: 8, windowMs: 60_000, key: clientKey(req), distributed: true, failClosed: true }
  }

  // Analítica de app: lotes de eventos. Distribuido para que N instancias no
  // multipliquen el cupo; tope bajo para evitar amplificación de escritura.
  if (req.method === 'POST' && url.startsWith('/api/public/events')) {
    return { name: 'appEvents', max: 40, windowMs: 5 * 60_000, key: clientKey(req), distributed: true, failClosed: true }
  }

  // Fallos de la web: tope por IP para que no sirva para llenar los registros.
  if (req.method === 'POST' && url.startsWith('/api/public/client-errors')) {
    return { name: 'clientErrors', max: 20, windowMs: 10 * 60_000, key: clientKey(req) }
  }

  // Firmas de subida a Cloudinary: con sesión, por usuario; sin sesión (alta de
  // restaurante), por IP y con tope bajo para que no sirva para subir en masa.
  if (req.method === 'POST' && url.startsWith('/api/uploads/cloudinary-signature')) {
    const signedIn = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')
    return signedIn
      ? { name: 'uploadSign', max: 60, windowMs: 10 * 60_000, key: authKey(req), distributed: true, failClosed: true }
      : { name: 'uploadSignAnon', max: 15, windowMs: 60 * 60_000, key: clientKey(req), distributed: true, failClosed: true }
  }

  if (
    url.startsWith('/api/public/cities')
    || url.startsWith('/api/public/geocode')
    || url.startsWith('/api/public/promotions')
    || url.startsWith('/api/public/billing')
    || url.startsWith('/api/public/booking')
    || url.startsWith('/api/public/discovery')
    || url.startsWith('/api/public/menus')
  ) {
    return { name: 'publicRead', max: 45, windowMs: 60_000, key: clientKey(req), distributed: true }
  }

  // Baja de cuenta (RGPD): pocas llamadas, distribuido y fail-closed.
  if (req.method === 'POST' && url.startsWith('/api/customer/account/delete')) {
    return { name: 'accountDelete', max: 5, windowMs: 60 * 60_000, key: authKey(req), distributed: true, failClosed: true }
  }

  if (url.startsWith('/api/customer/friends/search')) {
    return { name: 'search', max: 20, windowMs: 60_000, key: authKey(req), distributed: true }
  }

  // Envío de solicitudes de amistad: cada una genera notificación al destinatario.
  // Límite para que una cuenta no pueda spamear a muchos usuarios distintos.
  if (req.method === 'POST' && /^\/api\/customer\/friends\/requests\/[^/]+$/.test(url.split('?')[0])) {
    return { name: 'friendRequests', max: 20, windowMs: 10 * 60_000, key: authKey(req), distributed: true }
  }

  // Sincronización de progreso del cliente: el cuerpo lleva XP propuesta por el
  // navegador. Límite estricto y distribuido para que no se pueda inflar XP a
  // base de repetir la llamada. El tope diario real está en la ruta.
  if (req.method === 'POST' && url.startsWith('/api/customer/gamification/sync')) {
    return { name: 'gamificationSync', max: 30, windowMs: 5 * 60_000, key: authKey(req), distributed: true }
  }

  // Endpoints que validan el PIN de 4 dígitos del restaurante. Sin límite
  // distribuido, el PIN se puede fuerza-bruta a 10/min × nº de instancias.
  if (
    req.method === 'POST'
    && (
      url.includes('/verify-minimum-spend')
      || url.includes('/promotions/validate-pin')
      || url.includes('/promotions/register-consumption')
    )
  ) {
    return { name: 'pinCheck', max: 12, windowMs: 5 * 60_000, key: authKey(req), distributed: true, failClosed: true }
  }

  if (req.method === 'POST' && url.includes('/game/maze-move')) {
    return { name: 'mazeMove', max: 180, windowMs: 60_000, key: authKey(req) }
  }

  if (url.includes('/api/customer/reservation-challenges')) {
    return { name: 'challenges', max: 120, windowMs: 60_000, key: authKey(req) }
  }

  return { name: 'api', max: 180, windowMs: 60_000, key: authKey(req) }
}

export async function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const bucket = bucketFor(req)
  if (bucket.name === 'skip') {
    next()
    return
  }
  if (bucket.key.startsWith('tok:')) {
    bucket.key = await stableAuthKey(req, bucket.key)
  }

  const store = storeFor(bucket.name)
  const retryAfter = String(Math.ceil(bucket.windowMs / 1000))
  if (!take(store, bucket.key, bucket.max, bucket.windowMs)) {
    res.setHeader('Retry-After', retryAfter)
    res.status(429).json({ error: 'Demasiadas peticiones. Espera un momento.' })
    return
  }

  if (bucket.distributed) {
    const allowed = await takeDistributed(
      bucket.name,
      bucket.key,
      bucket.max,
      bucket.windowMs,
      bucket.failClosed,
    )
    if (!allowed) {
      res.setHeader('Retry-After', retryAfter)
      res.status(429).json({ error: 'Demasiadas peticiones. Espera un momento.' })
      return
    }
  }

  next()
}
