import { createHash } from 'node:crypto'
import type { Request } from 'express'

export function hashRateKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

/**
 * IP real detrás de un proxy de confianza (Firebase / Cloud Run).
 * Nunca uses el primer X-Forwarded-For: un atacante lo puede rotar.
 */
export function clientKey(req: Request): string {
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '').trim()
  return ip || 'unknown'
}

/**
 * Firebase ID tokens share the same JWT header, so slicing the first
 * characters would put every user in the same bucket.
 */
export function authKey(req: Request): string {
  const header = req.headers.authorization
  if (typeof header === 'string' && header.startsWith('Bearer ') && header.length > 40) {
    return `tok:${hashRateKey(header.slice(7))}`
  }
  return `ip:${clientKey(req)}`
}
