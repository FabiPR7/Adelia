import type { NextFunction, Request, Response } from 'express'

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

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown'
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function authKey(req: Request): string {
  const header = req.headers.authorization
  if (typeof header === 'string' && header.startsWith('Bearer ') && header.length > 20) {
    return `tok:${header.slice(7, 27)}`
  }
  return `ip:${clientKey(req)}`
}

function take(store: Map<string, RateEntry>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  if (store.size > 20_000) {
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(entryKey)
      }
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

function bucketFor(req: Request): { name: string; max: number; windowMs: number; key: string } {
  const path = `${req.method} ${req.originalUrl || req.path}`
  const url = req.originalUrl || req.path

  if (url.startsWith('/api/stripe/webhook') || url === '/api/health') {
    return { name: 'skip', max: 10_000, windowMs: 60_000, key: clientKey(req) }
  }

  if (
    url.startsWith('/api/auth/forgot-password')
    || url.startsWith('/api/auth/reset-password')
    || url.startsWith('/api/auth/resolve-login')
    || url.startsWith('/api/auth/change-initial-password')
    || url.startsWith('/api/auth/complete-initial-password-change')
  ) {
    return { name: 'auth', max: 8, windowMs: 15 * 60_000, key: clientKey(req) }
  }

  if (
    req.method === 'POST'
    && (
      url.includes('/public/booking/') && url.endsWith('/reservations')
      || url.includes('/deposit-intent')
      || url.includes('/public/booking/cancel')
    )
  ) {
    return { name: 'publicWrite', max: 12, windowMs: 60_000, key: clientKey(req) }
  }

  if (
    url.startsWith('/api/public/cities')
    || url.startsWith('/api/public/geocode')
    || url.startsWith('/api/public/promotions')
    || url.startsWith('/api/public/booking')
  ) {
    return { name: 'publicRead', max: 60, windowMs: 60_000, key: clientKey(req) }
  }

  if (url.startsWith('/api/customer/friends/search')) {
    return { name: 'search', max: 20, windowMs: 60_000, key: authKey(req) }
  }

  if (req.method === 'POST' && url.includes('/game/maze-move')) {
    return { name: 'mazeMove', max: 900, windowMs: 60_000, key: authKey(req) }
  }

  if (url.includes('/api/customer/reservation-challenges')) {
    return { name: 'challenges', max: 360, windowMs: 60_000, key: authKey(req) }
  }

  return { name: 'api', max: 240, windowMs: 60_000, key: authKey(req) }
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const bucket = bucketFor(req)
  if (bucket.name === 'skip') {
    next()
    return
  }
  const store = storeFor(bucket.name)
  if (take(store, bucket.key, bucket.max, bucket.windowMs)) {
    next()
    return
  }
  res.setHeader('Retry-After', '60')
  res.status(429).json({ error: 'Demasiadas peticiones. Espera un momento.' })
}
