import { describe, it, expect } from 'vitest'
import { getPasswordChecks, isPasswordValid } from '../passwordValidation'

describe('Password Match and Checks', () => {
  describe('getPasswordChecks', () => {
    it('debería retornar 5 checks (4 requisitos + 1 match)', () => {
      const checks = getPasswordChecks('Password123', 'Password123')

      expect(checks).toHaveLength(5)
      expect(checks.every(c => c.hasOwnProperty('label'))).toBe(true)
      expect(checks.every(c => c.hasOwnProperty('met'))).toBe(true)
    })

    it('debería marcar todos los checks como met cuando cumple', () => {
      const checks = getPasswordChecks('Password123', 'Password123')

      expect(checks[0].met).toBe(true) // length
      expect(checks[1].met).toBe(true) // lowercase
      expect(checks[2].met).toBe(true) // uppercase
      expect(checks[3].met).toBe(true) // number
      expect(checks[4].met).toBe(true) // match
    })

    it('debería marcar checks como no met cuando falla', () => {
      const checks = getPasswordChecks('pass', 'different')

      expect(checks[0].met).toBe(false) // length
      expect(checks[2].met).toBe(false) // uppercase
      expect(checks[3].met).toBe(false) // number
      expect(checks[4].met).toBe(false) // match
    })
  })

  describe('Password Match', () => {
    it('debería detectar contraseñas que coinciden', () => {
      const checks = getPasswordChecks('Password123', 'Password123')
      const matchCheck = checks.find(c => c.label.includes('coinciden'))

      expect(matchCheck?.met).toBe(true)
    })

    it('debería detectar contraseñas que NO coinciden', () => {
      const checks = getPasswordChecks('Password123', 'Different123')
      const matchCheck = checks.find(c => c.label.includes('coinciden'))

      expect(matchCheck?.met).toBe(false)
    })

    it('debería ser case-sensitive', () => {
      const checks = getPasswordChecks('Password123', 'password123')
      const matchCheck = checks.find(c => c.label.includes('coinciden'))

      expect(matchCheck?.met).toBe(false)
    })

    it('debería detectar espacios adicionales', () => {
      const checks = getPasswordChecks('Password123', 'Password123 ')
      const matchCheck = checks.find(c => c.label.includes('coinciden'))

      expect(matchCheck?.met).toBe(false)
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
      expect(isPasswordValid([])).toBe(true)
    })
  })

  describe('Real-World Scenarios', () => {
    it('Escenario: Usuario registrándose', () => {
      const password = 'MyNewPass123'
      const confirm = 'MyNewPass123'

      const checks = getPasswordChecks(password, confirm)
      const isValid = isPasswordValid(checks)

      expect(isValid).toBe(true)
    })

    it('Escenario: Usuario se equivoca en confirmación', () => {
      const password = 'MyNewPass123'
      const confirm = 'MyNewPass124' // Error de typo

      const checks = getPasswordChecks(password, confirm)
      const isValid = isPasswordValid(checks)

      expect(isValid).toBe(false)
    })

    it('Escenario: Contraseña débil', () => {
      const password = 'weak'
      const confirm = 'weak'

      const checks = getPasswordChecks(password, confirm)
      const isValid = isPasswordValid(checks)

      expect(isValid).toBe(false)
    })
  })
})
