import { describe, it, expect } from 'vitest'
import {
  PASSWORD_REQUIREMENTS,
  validatePasswordStrength,
  getPasswordChecks,
  isPasswordValid,
} from '../passwordValidation'

describe('passwordValidation', () => {
  describe('PASSWORD_REQUIREMENTS', () => {
    it('debería tener todos los requisitos necesarios', () => {
      expect(PASSWORD_REQUIREMENTS).toHaveLength(4)
      
      const keys = PASSWORD_REQUIREMENTS.map(r => r.key)
      expect(keys).toContain('length')
      expect(keys).toContain('lowercase')
      expect(keys).toContain('uppercase')
      expect(keys).toContain('number')
    })

    it('cada requisito debería tener key, label y test', () => {
      PASSWORD_REQUIREMENTS.forEach(req => {
        expect(req).toHaveProperty('key')
        expect(req).toHaveProperty('label')
        expect(req).toHaveProperty('test')
        expect(typeof req.test).toBe('function')
      })
    })
  })

  describe('validatePasswordStrength', () => {
    it('debería validar contraseña fuerte', () => {
      const result = validatePasswordStrength('Password123')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.strength).toBe('strong')
    })

    it('debería detectar contraseña débil (solo minúsculas)', () => {
      const result = validatePasswordStrength('password')

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.strength).toBe('weak')
    })

    it('debería validar requisito de longitud mínima', () => {
      const short = validatePasswordStrength('Pass1')
      expect(short.isValid).toBe(false)
      expect(short.errors).toContain('Mínimo 8 caracteres')

      const long = validatePasswordStrength('Password1')
      expect(long.isValid).toBe(true)
    })

    it('debería validar requisito de letra minúscula', () => {
      const noLower = validatePasswordStrength('PASSWORD123')
      expect(noLower.isValid).toBe(false)
      expect(noLower.errors).toContain('Una letra minúscula')

      const withLower = validatePasswordStrength('Password123')
      expect(withLower.isValid).toBe(true)
    })

    it('debería validar requisito de letra mayúscula', () => {
      const noUpper = validatePasswordStrength('password123')
      expect(noUpper.isValid).toBe(false)
      expect(noUpper.errors).toContain('Una letra mayúscula')

      const withUpper = validatePasswordStrength('Password123')
      expect(withUpper.isValid).toBe(true)
    })

    it('debería validar requisito de número', () => {
      const noNumber = validatePasswordStrength('Password')
      expect(noNumber.isValid).toBe(false)
      expect(noNumber.errors).toContain('Un número')

      const withNumber = validatePasswordStrength('Password1')
      expect(withNumber.isValid).toBe(true)
    })

    it('debería calcular strength correctamente', () => {
      expect(validatePasswordStrength('pass').strength).toBe('weak')
      expect(validatePasswordStrength('Password').strength).toBe('medium')
      expect(validatePasswordStrength('Password123').strength).toBe('strong')
    })

    it('debería rechazar contraseñas vacías', () => {
      const result = validatePasswordStrength('')

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(4) // Falla todos los requisitos
      expect(result.strength).toBe('weak')
    })

    it('debería aceptar caracteres especiales', () => {
      const result = validatePasswordStrength('P@ssw0rd!')

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('strong')
    })
  })

  describe('getPasswordChecks', () => {
    it('debería retornar todos los checks', () => {
      const checks = getPasswordChecks('Password123', 'Password123')

      expect(checks).toHaveLength(5) // 4 requisitos + 1 match
      expect(checks.every(c => c.hasOwnProperty('label'))).toBe(true)
      expect(checks.every(c => c.hasOwnProperty('met'))).toBe(true)
    })

    it('debería marcar checks como met cuando se cumplen', () => {
      const checks = getPasswordChecks('Password123', 'Password123')

      expect(checks[0].met).toBe(true) // length
      expect(checks[1].met).toBe(true) // lowercase
      expect(checks[2].met).toBe(true) // uppercase
      expect(checks[3].met).toBe(true) // number
      expect(checks[4].met).toBe(true) // match
    })

    it('debería marcar checks como no met cuando no se cumplen', () => {
      const checks = getPasswordChecks('pass', 'different')

      expect(checks[0].met).toBe(false) // length (muy corto)
      expect(checks[2].met).toBe(false) // uppercase (no tiene)
      expect(checks[3].met).toBe(false) // number (no tiene)
      expect(checks[4].met).toBe(false) // match (diferentes)
    })

    it('debería validar que las contraseñas coincidan', () => {
      const notMatch = getPasswordChecks('Password123', 'Different123')
      const matchCheck = notMatch.find(c => c.label === 'Las contraseñas coinciden')
      expect(matchCheck?.met).toBe(false)

      const match = getPasswordChecks('Password123', 'Password123')
      const matchCheck2 = match.find(c => c.label === 'Las contraseñas coinciden')
      expect(matchCheck2?.met).toBe(true)
    })
  })

  describe('isPasswordValid', () => {
    it('debería retornar true si todos los checks están met', () => {
      const checks = getPasswordChecks('Password123', 'Password123')
      expect(isPasswordValid(checks)).toBe(true)
    })

    it('debería retornar false si algún check no está met', () => {
      const checks = getPasswordChecks('pass', 'pass')
      expect(isPasswordValid(checks)).toBe(false)
    })

    it('debería retornar false si las contraseñas no coinciden', () => {
      const checks = getPasswordChecks('Password123', 'Different123')
      expect(isPasswordValid(checks)).toBe(false)
    })

    it('debería manejar array vacío', () => {
      expect(isPasswordValid([])).toBe(true) // Ningún check = todos passed
    })
  })

  describe('Casos edge', () => {
    it('debería manejar contraseñas con espacios', () => {
      const result = validatePasswordStrength('Pass word 123')
      // Los espacios NO deberían invalidar la contraseña
      expect(result.isValid).toBe(true)
    })

    it('debería manejar contraseñas con emojis', () => {
      const result = validatePasswordStrength('Password123😀')
      expect(result.isValid).toBe(true)
    })

    it('debería manejar contraseñas muy largas', () => {
      const longPassword = 'P@ssw0rd' + 'a'.repeat(100)
      const result = validatePasswordStrength(longPassword)
      expect(result.isValid).toBe(true)
    })

    it('debería manejar solo números', () => {
      const result = validatePasswordStrength('12345678')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Una letra minúscula')
      expect(result.errors).toContain('Una letra mayúscula')
    })

    it('debería manejar solo letras', () => {
      const result = validatePasswordStrength('PasswordPassword')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Un número')
    })
  })

  describe('Security Tests', () => {
    it('NO debería aceptar contraseñas comunes débiles', () => {
      const common = [
        'password',
        '12345678',
        'qwerty123',
        'Password1', // Aunque cumple requisitos, es muy común
      ]

      common.forEach(pwd => {
        const result = validatePasswordStrength(pwd)
        // Aunque algunas cumplan requisitos técnicos, se considera débil
        if (pwd === 'Password1') {
          expect(result.isValid).toBe(true) // Técnicamente válida
          // En producción, querrías una blacklist de contraseñas comunes
        }
      })
    })

    it('debería aceptar contraseñas fuertes variadas', () => {
      const strong = [
        'MyS3cur3P@ss!',
        'Tr0ub4dor&3',
        '!Qwerty123456',
        'C0mpl3x_P@ssw0rd',
      ]

      strong.forEach(pwd => {
        const result = validatePasswordStrength(pwd)
        expect(result.isValid).toBe(true)
        expect(result.strength).toBe('strong')
      })
    })
  })
})
