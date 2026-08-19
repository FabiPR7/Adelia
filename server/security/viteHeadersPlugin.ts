import type { Plugin } from 'vite'
import { DEV_CSP, PRODUCTION_CSP } from './csp.ts'

function applyHeaders(res: { setHeader: (name: string, value: string) => void }, csp: string) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(self)')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  res.setHeader('Content-Security-Policy', csp)
}

export function adeliaSecurityHeadersPlugin(): Plugin {
  return {
    name: 'adelia-security-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          applyHeaders(res, DEV_CSP)
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          applyHeaders(res, PRODUCTION_CSP)
        }
        next()
      })
    },
  }
}
