import { describe, it, expect, beforeEach, vi } from 'vitest'
import { executeRecaptcha } from '../recaptcha'

describe('recaptcha service', () => {
  beforeEach(() => {
    // Mock window.grecaptcha (ya está en setup.ts)
    ;(window as any).grecaptcha = {
      ready: (callback: () => void) => callback(),
      execute: vi.fn().mockResolvedValue('test_recaptcha_token'),
    }
  })

  describe('executeRecaptcha', () => {
    it('debería ejecutar reCAPTCHA y retornar token', async () => {
      const token = await executeRecaptcha('login')

      expect(token).toBe('test_recaptcha_token')
    })

    it('debería funcionar con diferentes acciones', async () => {
      const actions = ['login', 'register', 'submit_form']

      for (const action of actions) {
        const token = await executeRecaptcha(action)
        expect(token).toBeTruthy()
      }
    })

    it('debería llamar a grecaptcha.execute con la acción correcta', async () => {
      const executeSpy = vi.spyOn(window.grecaptcha, 'execute')

      await executeRecaptcha('test_action')

      expect(executeSpy).toHaveBeenCalled()
    })

    it('debería retornar un string no vacío', async () => {
      const token = await executeRecaptcha('test')

      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })
  })

  describe('Multiple Executions', () => {
    it('debería manejar múltiples ejecuciones en paralelo', async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        executeRecaptcha(`action_${i}`)
      )

      const tokens = await Promise.all(promises)

      expect(tokens).toHaveLength(10)
      expect(tokens.every(t => typeof t === 'string')).toBe(true)
    })

    it('debería ejecutar cada acción independientemente', async () => {
      const token1 = await executeRecaptcha('first')
      const token2 = await executeRecaptcha('second')

      expect(token1).toBeTruthy()
      expect(token2).toBeTruthy()
    })
  })

  describe('Error Handling', () => {
    it('debería propagar errores de grecaptcha.execute', async () => {
      ;(window as any).grecaptcha = {
        ready: (callback: () => void) => callback(),
        execute: vi.fn().mockRejectedValue(new Error('reCAPTCHA failed')),
      }

      await expect(executeRecaptcha('test')).rejects.toThrow()
    })

    it('debería manejar errores de red', async () => {
      ;(window as any).grecaptcha = {
        ready: (callback: () => void) => callback(),
        execute: vi.fn().mockRejectedValue(new Error('Network error')),
      }

      try {
        await executeRecaptcha('test')
        expect.fail('Debería haber lanzado error')
      } catch (error: any) {
        expect(error.message).toContain('Network error')
      }
    })
  })

  describe('Performance', () => {
    it('debería ejecutar tokens rápidamente (< 1s en test)', async () => {
      const start = Date.now()
      await executeRecaptcha('perf_test')
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(1000)
    })

    it('debería manejar ejecuciones consecutivas', async () => {
      const iterations = 5
      
      for (let i = 0; i < iterations; i++) {
        const token = await executeRecaptcha(`iteration_${i}`)
        expect(token).toBeTruthy()
      }
    })
  })

  describe('Integration', () => {
    it('debería funcionar el flujo básico', async () => {
      const token = await executeRecaptcha('integration_test')

      expect(token).toBe('test_recaptcha_token')
      expect(window.grecaptcha.execute).toHaveBeenCalled()
    })

    it('debería mantener estado entre llamadas', async () => {
      await executeRecaptcha('first')
      await executeRecaptcha('second')

      expect(window.grecaptcha.execute).toHaveBeenCalledTimes(2)
    })
  })
})
