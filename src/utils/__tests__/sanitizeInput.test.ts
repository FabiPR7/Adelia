import { describe, it, expect } from 'vitest'
import {
  sanitizeInput,
  sanitizeUserProfileUpdate,
  sanitizeCompanyProfileUpdate,
} from '../securityHelpers'

describe('sanitizeInput - Mass Assignment Prevention', () => {
  describe('sanitizeInput genérico', () => {
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

    it('debería manejar valores null y undefined', () => {
      const input = { name: 'Juan', email: null, phone: undefined }
      const result = sanitizeInput(input, ['name', 'email', 'phone'])

      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('email')
      expect(result).toHaveProperty('phone')
    })

    it('debería manejar arrays como valores', () => {
      const input = { name: 'Test', tags: ['tag1', 'tag2'] }
      const result = sanitizeInput(input, ['name', 'tags'])

      expect(result).toEqual({ name: 'Test', tags: ['tag1', 'tag2'] })
    })

    it('debería manejar objetos anidados', () => {
      const input = {
        name: 'Test',
        settings: { theme: 'dark', lang: 'es' },
      }
      const result = sanitizeInput(input, ['name', 'settings'])

      expect(result).toEqual({
        name: 'Test',
        settings: { theme: 'dark', lang: 'es' },
      })
    })
  })

  describe('sanitizeUserProfileUpdate', () => {
    it('debería filtrar campos de perfil de usuario', () => {
      const input = {
        displayName: 'Juan Pérez',
        phone: '612345678',
        role: 'admin', // ¡Intento de escalación!
        xp: 999999,
        balance: 10000,
      }

      const result = sanitizeUserProfileUpdate(input)

      expect(result).toHaveProperty('displayName')
      expect(result).toHaveProperty('phone')
      expect(result).not.toHaveProperty('role')
      expect(result).not.toHaveProperty('xp')
      expect(result).not.toHaveProperty('balance')
    })

    it('debería permitir actualizar photoUrl', () => {
      const input = {
        displayName: 'Test',
        photoUrl: 'https://example.com/photo.jpg',
      }

      const result = sanitizeUserProfileUpdate(input)

      expect(result).toHaveProperty('photoUrl')
    })

    it('debería permitir actualizar notificationPreferences', () => {
      const input = {
        notificationPreferences: { email: true, push: false },
      }

      const result = sanitizeUserProfileUpdate(input)

      expect(result).toHaveProperty('notificationPreferences')
    })
  })

  describe('sanitizeCompanyProfileUpdate', () => {
    it('debería filtrar campos de perfil de empresa', () => {
      const input = {
        name: 'Mi Restaurante',
        email: 'info@restaurante.com',
        promotionPin: '1234', // ¡Campo secreto!
        verified: true, // ¡Solo admin puede cambiar esto!
        xp: 50000,
      }

      const result = sanitizeCompanyProfileUpdate(input)

      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('email')
      expect(result).not.toHaveProperty('promotionPin')
      expect(result).not.toHaveProperty('verified')
      expect(result).not.toHaveProperty('xp')
    })

    it('debería permitir actualizar dirección completa', () => {
      const input = {
        name: 'Test',
        address: 'Calle Test 123',
        city: 'Madrid',
        country: 'España',
      }

      const result = sanitizeCompanyProfileUpdate(input)

      expect(result).toHaveProperty('address')
      expect(result).toHaveProperty('city')
      expect(result).toHaveProperty('country')
    })

    it('debería permitir actualizar horarios', () => {
      const input = {
        name: 'Test',
        openingHours: {
          monday: '9:00-22:00',
          tuesday: '9:00-22:00',
        },
      }

      const result = sanitizeCompanyProfileUpdate(input)

      expect(result).toHaveProperty('openingHours')
    })
  })

  describe('Security - Mass Assignment Attacks', () => {
    it('NO debería permitir escalar privilegios (role)', () => {
      const maliciousInput = {
        displayName: 'Hacker',
        role: 'admin',
        isAdmin: true,
        permissions: ['all'],
      }

      const result = sanitizeUserProfileUpdate(maliciousInput)

      expect(result.displayName).toBe('Hacker')
      expect(result).not.toHaveProperty('role')
      expect(result).not.toHaveProperty('isAdmin')
      expect(result).not.toHaveProperty('permissions')
    })

    it('NO debería permitir modificar gamificación (xp, tokens)', () => {
      const maliciousInput = {
        displayName: 'Cheater',
        xp: 999999,
        level: 99,
        tokens: 10000,
        coins: 50000,
      }

      const result = sanitizeUserProfileUpdate(maliciousInput)

      expect(result).toHaveProperty('displayName')
      expect(result).not.toHaveProperty('xp')
      expect(result).not.toHaveProperty('level')
      expect(result).not.toHaveProperty('tokens')
      expect(result).not.toHaveProperty('coins')
    })

    it('NO debería permitir modificar verificación de empresa', () => {
      const maliciousInput = {
        name: 'Fake Restaurant',
        verified: true,
        verifiedAt: new Date(),
        verificationLevel: 'premium',
      }

      const result = sanitizeCompanyProfileUpdate(maliciousInput)

      expect(result).toHaveProperty('name')
      expect(result).not.toHaveProperty('verified')
      expect(result).not.toHaveProperty('verifiedAt')
      expect(result).not.toHaveProperty('verificationLevel')
    })
  })
})
