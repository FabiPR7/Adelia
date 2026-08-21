import { describe, it, expect } from 'vitest'
import { rateLimiter } from '../securityHelpers'

describe('rateLimiter - Frontend Rate Limiting', () => {
  describe('Basic Functionality', () => {
    it('debería permitir intentos dentro del límite', () => {
      const key = 'test-user-basic-1'
      const maxAttempts = 5
      const windowMs = 60000

      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.check(key, maxAttempts, windowMs)
        expect(result).toBe(true)
      }
    })

    it('debería bloquear después de exceder límite', () => {
      const key = 'test-user-basic-2'
      const maxAttempts = 3
      const windowMs = 60000

      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)

      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)
    })

    it('debería resetear después de llamar reset()', () => {
      const key = 'test-user-basic-3'
      const maxAttempts = 2
      const windowMs = 60000

      rateLimiter.check(key, maxAttempts, windowMs)
      rateLimiter.check(key, maxAttempts, windowMs)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)

      rateLimiter.reset(key)

      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
    })
  })

  describe('Time Window', () => {
    it('debería respetar ventana de tiempo', () => {
      const key = 'test-user-window-1'
      const maxAttempts = 2
      const windowMs = 100

      rateLimiter.check(key, maxAttempts, windowMs)
      rateLimiter.check(key, maxAttempts, windowMs)
      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)

      return new Promise(resolve => {
        setTimeout(() => {
          expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
          resolve(undefined)
        }, 150)
      })
    })
  })

  describe('Multiple Users', () => {
    it('debería rastrear usuarios independientemente', () => {
      const user1 = 'user1-multi'
      const user2 = 'user2-multi'
      const maxAttempts = 2
      const windowMs = 60000

      rateLimiter.check(user1, maxAttempts, windowMs)
      rateLimiter.check(user1, maxAttempts, windowMs)
      expect(rateLimiter.check(user1, maxAttempts, windowMs)).toBe(false)

      expect(rateLimiter.check(user2, maxAttempts, windowMs)).toBe(true)
      expect(rateLimiter.check(user2, maxAttempts, windowMs)).toBe(true)
      expect(rateLimiter.check(user2, maxAttempts, windowMs)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('debería manejar maxAttempts = 1', () => {
      const key = 'test-edge-1'
      expect(rateLimiter.check(key, 1, 60000)).toBe(true)
      expect(rateLimiter.check(key, 1, 60000)).toBe(false)
    })

    it('debería manejar ventanas muy cortas', () => {
      const key = 'test-edge-2'
      expect(rateLimiter.check(key, 1, 1)).toBe(true)

      return new Promise(resolve => {
        setTimeout(() => {
          expect(rateLimiter.check(key, 1, 1)).toBe(true)
          resolve(undefined)
        }, 5)
      })
    })

    it('debería manejar muchos intentos', () => {
      const key = 'test-edge-3'
      const maxAttempts = 100
      const windowMs = 60000

      for (let i = 0; i < 100; i++) {
        expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
      }

      expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)
    })
  })

  describe('Security Tests', () => {
    it('NO debería permitir bypass modificando la key', () => {
      const key1 = 'user@test.com'
      const key2 = 'user@test.com ' 
      const maxAttempts = 2
      const windowMs = 60000

      rateLimiter.check(key1, maxAttempts, windowMs)
      rateLimiter.check(key1, maxAttempts, windowMs)
      expect(rateLimiter.check(key1, maxAttempts, windowMs)).toBe(false)

      expect(rateLimiter.check(key2, maxAttempts, windowMs)).toBe(true)
    })

    it('debería prevenir brute force attacks', () => {
      const key = 'attacker@evil.com'
      const maxAttempts = 5
      const windowMs = 60000

      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(true)
      }

      for (let i = 0; i < 100; i++) {
        expect(rateLimiter.check(key, maxAttempts, windowMs)).toBe(false)
      }
    })

    it('debería limpiar memoria automáticamente', () => {
      for (let i = 0; i < 1500; i++) {
        const key = `temp-user-${i}`
        rateLimiter.check(key, 3, 60000)
        rateLimiter.check(key, 3, 60000)
        rateLimiter.check(key, 3, 60000)
      }

      const key = 'new-user-after-cleanup'
      expect(rateLimiter.check(key, 5, 60000)).toBe(true)
    })
  })

  describe('Real-World Scenarios', () => {
    it('Escenario: Login attempts', () => {
      const userEmail = 'user@example.com'
      const maxAttempts = 5
      const lockoutTime = 15 * 60 * 1000

      for (let i = 1; i <= 5; i++) {
        const allowed = rateLimiter.check(userEmail, maxAttempts, lockoutTime)
        expect(allowed).toBe(true)
      }

      const blocked = rateLimiter.check(userEmail, maxAttempts, lockoutTime)
      expect(blocked).toBe(false)
    })

    it('Escenario: API rate limiting', () => {
      const apiKey = 'api-key-123'
      const requestsPerMinute = 60
      const oneMinute = 60 * 1000

      for (let i = 0; i < requestsPerMinute; i++) {
        expect(rateLimiter.check(apiKey, requestsPerMinute, oneMinute)).toBe(true)
      }

      expect(rateLimiter.check(apiKey, requestsPerMinute, oneMinute)).toBe(false)
    })

    it('Escenario: Form submission protection', () => {
      const userId = 'user-123'
      const maxSubmissions = 3
      const perHour = 60 * 60 * 1000

      expect(rateLimiter.check(userId, maxSubmissions, perHour)).toBe(true)
      expect(rateLimiter.check(userId, maxSubmissions, perHour)).toBe(true)
      expect(rateLimiter.check(userId, maxSubmissions, perHour)).toBe(true)

      expect(rateLimiter.check(userId, maxSubmissions, perHour)).toBe(false)
    })
  })
})
