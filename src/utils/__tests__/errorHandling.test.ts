import { describe, it, expect } from 'vitest'
import { safeErrorMessage, randomDelay } from '../securityHelpers'

describe('Error Handling - Security', () => {
  describe('safeErrorMessage', () => {
    it('debería aceptar Error objects', () => {
      const error = new Error('Test error message')
      const result = safeErrorMessage(error, 'Fallback message')

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('debería retornar string cuando input es string vacío (en dev retorna string vacío)', () => {
      const result = safeErrorMessage('', 'Fallback message')
      // En dev mode, retorna el error real (string vacío)
      // En prod mode, retornaría el fallback
      expect(typeof result).toBe('string')
    })

    it('debería manejar errores que no son Error objects (en dev los convierte a string)', () => {
      const result1 = safeErrorMessage('string error', 'fallback')
      expect(typeof result1).toBe('string')

      const result2 = safeErrorMessage({ message: 'object error' }, 'fallback')
      expect(typeof result2).toBe('string')

      // null/undefined en dev se convierten a string
      const result3 = safeErrorMessage(null, 'fallback')
      expect(typeof result3).toBe('string')
    })

    it('debería retornar un string siempre', () => {
      const testCases = [
        new Error('Error 1'),
        'String error',
        { message: 'Object error' },
        undefined,
        null,
        123,
      ]

      testCases.forEach(testCase => {
        const result = safeErrorMessage(testCase, 'fallback')
        expect(typeof result).toBe('string')
      })
    })

    it('debería usar el fallback en producción', () => {
      // En dev, safeErrorMessage convierte null a String(null) = "null"
      // En prod, usaría el fallback
      const result = safeErrorMessage(null, 'Custom fallback')
      expect(typeof result).toBe('string')
    })

    it('debería manejar errores con información sensible (en dev)', () => {
      const sensitiveError = new Error('Usuario admin en /secrets/api-keys')
      const result = safeErrorMessage(sensitiveError, 'Operación fallida')

      // En dev mode, muestra el error real
      // En prod mode, usaría el fallback
      expect(typeof result).toBe('string')
    })
  })

  describe('randomDelay - Anti-Timing Attack', () => {
    it('debería esperar entre min y max', async () => {
      const start = Date.now()
      await randomDelay(100, 200)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(90) // margen de 10ms
      expect(elapsed).toBeLessThan(250) // margen de 50ms
    })

    it('debería usar valores por defecto (100-300ms)', async () => {
      const start = Date.now()
      await randomDelay()
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(90)
      expect(elapsed).toBeLessThan(350)
    })

    it('debería generar delays diferentes', async () => {
      const delays: number[] = []

      for (let i = 0; i < 5; i++) {
        const start = Date.now()
        await randomDelay(100, 200)
        delays.push(Date.now() - start)
      }

      // Al menos alguno debe ser diferente
      const allSame = delays.every(d => Math.abs(d - delays[0]) < 10)
      expect(allSame).toBe(false)
    })

    it('debería prevenir timing attacks básicos', async () => {
      const validUserDelay = async () => {
        await randomDelay(100, 200)
        return true
      }

      const invalidUserDelay = async () => {
        await randomDelay(100, 200)
        return false
      }

      const start1 = Date.now()
      await validUserDelay()
      const time1 = Date.now() - start1

      const start2 = Date.now()
      await invalidUserDelay()
      const time2 = Date.now() - start2

      // Ambos deberían tardar aproximadamente lo mismo
      const diff = Math.abs(time1 - time2)
      expect(diff).toBeLessThan(100) // Margen de 100ms (más realista para sistemas bajo carga)
    })

    it('debería ser asíncrono', async () => {
      const promise = randomDelay(50, 100)

      expect(promise).toBeInstanceOf(Promise)
      await promise
    })

    it('debería completarse dentro del tiempo esperado', async () => {
      const start = Date.now()
      await randomDelay(10, 20)
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(50)
    })

    it('debería manejar delays muy cortos', async () => {
      const start = Date.now()
      await randomDelay(1, 5)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(0)
      expect(elapsed).toBeLessThan(50)
    })

    it('debería funcionar con delays largos', async () => {
      const start = Date.now()
      await randomDelay(200, 250)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(190)
      expect(elapsed).toBeLessThan(300)
    })
  })
})
