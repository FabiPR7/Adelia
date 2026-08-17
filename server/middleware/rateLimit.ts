import type { NextFunction, Request, Response } from 'express'

interface RateEntry {
  count: number
  resetAt: number
}

export function createRateLimit(maxRequests: number, windowMs: number) {
  const entries = new Map<string, RateEntry>()

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const key = req.ip || req.socket.remoteAddress || 'unknown'
    const current = entries.get(key)

    if (!current || current.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (current.count >= maxRequests) {
      res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' })
      return
    }

    current.count += 1
    next()
  }
}
