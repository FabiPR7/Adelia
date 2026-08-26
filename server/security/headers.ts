import type { NextFunction, Request, Response } from 'express'
import { API_CSP } from './csp.ts'

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
  res.setHeader('Content-Security-Policy', API_CSP)
  res.setHeader('Cache-Control', 'no-store')
  const https = req.secure || req.headers['x-forwarded-proto'] === 'https'
  if (https) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  if (req.path !== '/api/health') {
    res.setHeader('Pragma', 'no-cache')
  }
  next()
}
