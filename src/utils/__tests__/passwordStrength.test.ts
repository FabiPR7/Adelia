import { describe, it, expect } from 'vitest'
import { validatePasswordStrength, PASSWORD_REQUIREMENTS } from '../passwordValidation'

describe('Password Strength Validation', () => {
  describe('PASSWORD_REQUIREMENTS constants', () => {
    it('debería tener 4 requisitos definidos', () => {
      expect(PASSWORD_REQUIREMENTS).toHaveLength(4)
    })

    it('debería tener requisito de longitud', () => {
      const lengthReq = PASSWORD_REQUIREMENTS.find(r => r.key === 'length')
      expect(lengthReq).toBeDefined()
      expect(lengthReq?.label).toContain('8')
    })

    it('debería tener requisito de minúscula', () => {
      const lowerReq = PASSWORD_REQUIREMENTS.find(r => r.key === 'lowercase')
      expect(lowerReq).toBeDefined()
    })

    it('debería tener requisito de mayúscula', () => {
      const upperReq = PASSWORD_REQUIREMENTS.find(r => r.key === 'uppercase')
      expect(upperReq).toBeDefined()
    })

    it('debería tener requisito de número', () => {
      const numberReq = PASSWORD_REQUIREMENTS.find(r => r.key === 'number')
      expect(numberReq).toBeDefined()
    })
  })

  describe('Contraseñas FUERTES', () => {
    it('debería validar contraseña fuerte (>= 12 chars + especiales)', () => {
      const result = validatePasswordStrength('Password123!')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.strength).toBe('strong')
    })

    it('debería validar contraseñas con caracteres especiales y largas', () => {
      const passwords = [
        'P@ssw0rd1234',
        'MyP@ssword123',
        'Str0ng_Password!',
        'C0mpl3x#Password',
      ]

      passwords.forEach(pwd => {
        const result = validatePasswordStrength(pwd)
        expect(result.isValid).toBe(true)
        expect(result.strength).toBe('strong')
      })
    })

    it('debería validar contraseñas muy largas con especiales', () => {
      const longPassword = 'Password123!' + 'a'.repeat(50)
      const result = validatePasswordStrength(longPassword)

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('strong')
    })
  })

  describe('Contraseñas MEDIAS (válidas pero sin especiales o < 12 chars)', () => {
    it('debería clasificar Password123 como media (no tiene especiales)', () => {
      const result = validatePasswordStrength('Password123')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.strength).toBe('medium')
    })

    it('debería clasificar contraseñas cortas válidas como media', () => {
      const result = validatePasswordStrength('Pass1234')

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('medium')
    })
  })

  describe('Contraseñas DÉBILES', () => {
    it('debería detectar contraseña demasiado corta', () => {
      const result = validatePasswordStrength('Pass1')

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.strength).toBe('weak')
    })

    it('debería detectar contraseña sin mayúsculas', () => {
      const result = validatePasswordStrength('password123')

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('mayúscula'))).toBe(true)
      expect(result.strength).toBe('weak')
    })

    it('debería detectar contraseña sin minúsculas', () => {
      const result = validatePasswordStrength('PASSWORD123')

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('minúscula'))).toBe(true)
      expect(result.strength).toBe('weak')
    })

    it('debería detectar contraseña sin números', () => {
      const result = validatePasswordStrength('PasswordOnly')

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('número'))).toBe(true)
      expect(result.strength).toBe('weak')
    })

    it('debería detectar contraseña solo con números', () => {
      const result = validatePasswordStrength('12345678')

      expect(result.isValid).toBe(false)
      expect(result.strength).toBe('weak')
    })

    it('debería detectar contraseña solo con letras', () => {
      const result = validatePasswordStrength('PasswordPassword')

      expect(result.isValid).toBe(false)
      expect(result.strength).toBe('weak')
    })
  })

  describe('Edge Cases', () => {
    it('debería manejar contraseña vacía', () => {
      const result = validatePasswordStrength('')

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.strength).toBe('weak')
    })

    it('debería manejar contraseñas con espacios', () => {
      const result = validatePasswordStrength('Pass word 123')

      expect(result.isValid).toBe(true)
    })

    it('debería manejar contraseñas con emojis (válidas si cumplen requisitos)', () => {
      const result = validatePasswordStrength('Password123😀!')

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('strong') // >= 12 chars + especial
    })

    it('debería manejar caracteres unicode', () => {
      const result = validatePasswordStrength('Contraseña123!')

      expect(result.isValid).toBe(true)
    })
  })

  describe('Security - Contraseñas Comunes', () => {
    it('debería validar técnicamente contraseñas comunes (pero advertir en UI)', () => {
      const commonPasswords = [
        'Password123!', // >= 12 + especial = strong
        'Qwerty1234!!', // >= 12 + especial = strong
        'Admin12345!!', // >= 12 + especial = strong
      ]

      commonPasswords.forEach(pwd => {
        const result = validatePasswordStrength(pwd)
        expect(result.isValid).toBe(true)
      })
    })
  })

  describe('Strength Calculation', () => {
    it('weak: tiene errores', () => {
      expect(validatePasswordStrength('pass').strength).toBe('weak')
      expect(validatePasswordStrength('12345').strength).toBe('weak')
    })

    it('medium: cumple requisitos pero < 12 chars o sin especiales', () => {
      expect(validatePasswordStrength('Password1').strength).toBe('medium')
      expect(validatePasswordStrength('Pass1234').strength).toBe('medium')
    })

    it('strong: >= 12 caracteres + caracteres especiales', () => {
      expect(validatePasswordStrength('Password123!').strength).toBe('strong')
      expect(validatePasswordStrength('MyP@ssword12').strength).toBe('strong')
    })
  })
})
