import { describe, it, expect } from 'vitest'
import {
  sanitizeInput,
  ALLOWED_USER_PROFILE_FIELDS,
  ALLOWED_COMPANY_PROFILE_FIELDS,
  sanitizeUserProfileUpdate,
  sanitizeCompanyProfileUpdate,
  detectInjectionAttempt,
  sanitizeSearchInput,
  isValidEmail,
  isValidPhone,
  isValidUrl,
  truncateString,
  safeErrorMessage,
  randomDelay,
  rateLimiter,
} from '../securityHelpers'

describe('securityHelpers', () => {
  describe('sanitizeInput', () => {
    it('debería permitir solo campos en la whitelist', () => {
      const input = {
        name: 'Juan',
        email: 'juan@test.com',
        role: 'admin', // ¡Campo peligroso!
        xp: 999999, // ¡Cheat!
      }

      const result = sanitizeInput(input, ['name', 'email'])

      expect(result).toEqual({
        name: 'Juan',
        email: 'juan@test.com',
      })
      expect(result).not.toHaveProperty('role')
      expect(result).not.toHaveProperty('xp')
    })

    it('debería manejar campos inexistentes sin error', () => {
      const input = { name: 'Test' }
      const result = sanitizeInput(input, ['name', 'email', 'phone'])

      expect(result).toEqual({ name: 'Test' })
    })

    it('debería retornar objeto vacío si no hay campos permitidos', () => {
      const input = { role: 'admin', xp: 100 }
      const result = sanitizeInput(input, ['name', 'email'])

      expect(result).toEqual({})
    })
  })

  describe('sanitizeUserProfileUpdate', () => {
    it('debería filtrar campos de perfil de usuario', () => {
      const input = {
        displayName: 'Juan Pérez',
        phone: '612345678',
        role: 'admin', // ¡Intento de escalación!
        xp: 999999,
      }

      const result = sanitizeUserProfileUpdate(input)

      expect(result).toHaveProperty('displayName')
      expect(result).toHaveProperty('phone')
      expect(result).not.toHaveProperty('role')
      expect(result).not.toHaveProperty('xp')
    })
  })

  describe('sanitizeCompanyProfileUpdate', () => {
    it('debería filtrar campos de perfil de empresa', () => {
      const input = {
        name: 'Mi Restaurante',
        email: 'info@restaurante.com',
        promotionPin: '1234', // ¡Campo secreto!
        verified: true, // ¡Solo admin puede cambiar esto!
      }

      const result = sanitizeCompanyProfileUpdate(input)

      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('email')
      expect(result).not.toHaveProperty('promotionPin')
      expect(result).not.toHaveProperty('verified')
    })
  })

  describe('detectInjectionAttempt', () => {
    it('debería detectar <script> tags', () => {
      expect(detectInjectionAttempt('<script>alert("XSS")</script>')).toBe(true)
      expect(detectInjectionAttempt('<SCRIPT>alert("XSS")</SCRIPT>')).toBe(true)
    })

    it('debería detectar javascript: protocol', () => {
      expect(detectInjectionAttempt('javascript:alert("XSS")')).toBe(true)
      expect(detectInjectionAttempt('JAVASCRIPT:alert(1)')).toBe(true)
    })

    it('debería detectar event handlers', () => {
      expect(detectInjectionAttempt('onclick=alert(1)')).toBe(true)
      expect(detectInjectionAttempt('onerror=alert(1)')).toBe(true)
      expect(detectInjectionAttempt('onload =alert(1)')).toBe(true)
    })

    it('debería detectar <iframe> tags', () => {
      expect(detectInjectionAttempt('<iframe src="evil.com"></iframe>')).toBe(true)
    })

    it('debería detectar document. y window.', () => {
      expect(detectInjectionAttempt('document.cookie')).toBe(true)
      expect(detectInjectionAttempt('window.location')).toBe(true)
    })

    it('debería detectar eval()', () => {
      expect(detectInjectionAttempt('eval(malicious)')).toBe(true)
    })

    it('NO debería detectar texto normal', () => {
      expect(detectInjectionAttempt('Hola, me encanta este restaurante')).toBe(false)
      expect(detectInjectionAttempt('Mi email es juan@test.com')).toBe(false)
    })
  })

  describe('sanitizeSearchInput', () => {
    it('debería eliminar < y >', () => {
      expect(sanitizeSearchInput('<script>alert()</script>')).toBe('scriptalert()/script')
      expect(sanitizeSearchInput('búsqueda < normal >')).toBe('búsqueda  normal ')
    })

    it('debería hacer trim', () => {
      expect(sanitizeSearchInput('  búsqueda  ')).toBe('búsqueda')
    })

    it('debería limitar longitud a 100 caracteres', () => {
      const longString = 'a'.repeat(150)
      const result = sanitizeSearchInput(longString)

      expect(result.length).toBe(100)
    })
  })

  describe('isValidEmail', () => {
    it('debería aceptar emails válidos', () => {
      expect(isValidEmail('usuario@example.com')).toBe(true)
      expect(isValidEmail('test.user+tag@domain.co.uk')).toBe(true)
      expect(isValidEmail('user_123@sub.example.com')).toBe(true)
    })

    it('debería rechazar emails inválidos', () => {
      expect(isValidEmail('usuario')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('usuario@')).toBe(false)
      expect(isValidEmail('usuario @example.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })

    it('debería rechazar emails demasiado largos', () => {
      const longEmail = 'a'.repeat(250) + '@test.com'
      expect(isValidEmail(longEmail)).toBe(false)
    })
  })

  describe('isValidPhone', () => {
    it('debería aceptar teléfonos E.164 válidos', () => {
      expect(isValidPhone('+34612345678')).toBe(true)
      expect(isValidPhone('+1234567890123')).toBe(true)
      expect(isValidPhone('612345678')).toBe(true)
    })

    it('debería rechazar teléfonos inválidos', () => {
      expect(isValidPhone('abc123')).toBe(false)
      expect(isValidPhone('+0123')).toBe(false)
      expect(isValidPhone('')).toBe(false)
      expect(isValidPhone('123')).toBe(false) // Muy corto
    })

    it('debería aceptar formato con espacios/guiones', () => {
      expect(isValidPhone('+34 612 34 56 78'.replace(/[\s()-]/g, ''))).toBe(true)
    })
  })

  describe('isValidUrl', () => {
    it('debería aceptar URLs válidas', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://subdomain.example.com/path')).toBe(true)
      expect(isValidUrl('https://example.com:8080/page')).toBe(true)
    })

    it('debería rechazar protocolos no permitidos', () => {
      expect(isValidUrl('javascript:alert(1)')).toBe(false)
      expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isValidUrl('ftp://example.com')).toBe(false)
    })

    it('debería rechazar IPs privadas (SSRF protection)', () => {
      expect(isValidUrl('http://localhost')).toBe(false)
      expect(isValidUrl('http://127.0.0.1')).toBe(false)
      expect(isValidUrl('http://192.168.1.1')).toBe(false)
      expect(isValidUrl('http://10.0.0.1')).toBe(false)
      expect(isValidUrl('http://172.16.0.1')).toBe(false)
    })

    it('debería rechazar URLs malformadas', () => {
      expect(isValidUrl('not a url')).toBe(false)
      expect(isValidUrl('')).toBe(false)
    })
  })

  describe('truncateString', () => {
    it('debería truncar strings largos', () => {
      const long = 'Este es un texto muy largo que necesita ser truncado'
      expect(truncateString(long, 20)).toBe('Este es un texto ...')
    })

    it('NO debería truncar strings cortos', () => {
      expect(truncateString('Corto', 20)).toBe('Corto')
    })

    it('debería manejar maxLength exacto', () => {
      expect(truncateString('12345', 5)).toBe('12345')
      expect(truncateString('123456', 5)).toBe('12...')
    })
  })

  describe('safeErrorMessage', () => {
    it('debería retornar mensaje genérico en producción', () => {
      // Simular producción
      const originalEnv = import.meta.env.DEV
      ;(import.meta.env as any).DEV = false

      const error = new Error('Usuario "admin" no existe en /users/admin/private/secrets')
      const result = safeErrorMessage(error, 'Error genérico')

      expect(result).toBe('Error genérico')
      expect(result).not.toContain('admin')
      expect(result).not.toContain('private')

      // Restaurar
      ;(import.meta.env as any).DEV = originalEnv
    })

    it('debería retornar error real en desarrollo', () => {
      // Simular desarrollo
      const originalEnv = import.meta.env.DEV
      ;(import.meta.env as any).DEV = true

      const error = new Error('Error detallado con información sensible')
      const result = safeErrorMessage(error, 'Error genérico')

      expect(result).toBe('Error detallado con información sensible')

      // Restaurar
      ;(import.meta.env as any).DEV = originalEnv
    })
  })

  describe('randomDelay', () => {
    it('debería esperar entre min y max', async () => {
      const start = Date.now()
      await randomDelay(100, 200)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(90) // Margen de error
      expect(elapsed).toBeLessThan(250)
    })

    it('debería usar valores por defecto', async () => {
      const start = Date.now()
      await randomDelay()
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(90)
      expect(elapsed).toBeLessThan(350)
    })
  })

  describe('rateLimiter', () => {
    it('debería permitir intentos dentro del límite', () => {
      const key = 'test-user-1'
      const maxAttempts = 5
      const windowMs = 60000

      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
      }
    })

    it('debería bloquear después de exceder límite', () => {
      const key = 'test-user-2'
      const maxAttempts = 3
      const windowMs = 60000

      // Primeros 3 intentos OK
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)

      // Cuarto intento bloqueado
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)
    })

    it('debería resetear después de llamar reset()', () => {
      const key = 'test-user-3'
      const maxAttempts = 2
      const windowMs = 60000

      // Agotar límite
      rateLimiter.check(key, maxAttempts, windowMs)
      rateLimiter.check(key, maxAttempts, windowMs)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)

      // Reset
      rateLimiter.reset(key)

      // Ahora debería permitir de nuevo
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
    })

    it('debería limpiar intentos viejos', () => {
      const key = 'test-user-4'
      const maxAttempts = 3
      const windowMs = 100 // 100ms (muy corto para testing)

      // Hacer 3 intentos
      rateLimiter.check(key, maxAttempts, windowMs)
      rateLimiter.check(key, maxAttempts, windowMs)
      rateLimiter.check(key, maxAttempts, windowMs)

      // Bloqueado
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)

      // Esperar que expire la ventana
      return new Promise(resolve => {
        setTimeout(() => {
          // Ahora debería permitir de nuevo
          expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
          resolve(undefined)
        }, 150)
      })
    })
  })
})
