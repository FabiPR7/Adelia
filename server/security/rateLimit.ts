import type { NextFunction, Request, Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { authKey, clientKey, hashRateKey } from './requestIdentity.ts'

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
    return { name: 'publicWrite', max: 8, windowMs: 60_000, key: clientKey(req), distributed: true }
  }

  if (
    url.startsWith('/api/public/cities')
    || url.startsWith('/api/public/geocode')
    || url.startsWith('/api/public/promotions')
    || url.startsWith('/api/public/billing')
    || url.startsWith('/api/public/booking')
  ) {
    return { name: 'publicRead', max: 45, windowMs: 60_000, key: clientKey(req) }
  }

  if (url.startsWith('/api/customer/friends/search')) {
    return { name: 'search', max: 20, windowMs: 60_000, key: authKey(req) }
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
    return { name: 'pinCheck', max: 12, windowMs: 5 * 60_000, key: authKey(req), distributed: true }
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
