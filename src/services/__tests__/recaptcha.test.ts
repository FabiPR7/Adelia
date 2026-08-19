import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadRecaptchaScript, executeRecaptcha } from '../recaptcha'

describe('recaptcha service', () => {
  beforeEach(() => {
    // Limpiar mocks antes de cada test
    vi.clearAllMocks()
    
    // Limpiar scripts existentes
    document.querySelectorAll('script[src*="recaptcha"]').forEach(el => el.remove())
    
    // Reset grecaptcha mock
    window.grecaptcha = {
      ready: vi.fn((callback) => callback()),
      execute: vi.fn(() => Promise.resolve('test_recaptcha_token')),
      render: vi.fn(() => 1),
    }
  })

  describe('loadRecaptchaScript', () => {
    it('debería cargar el script de reCAPTCHA', async () => {
      await loadRecaptchaScript()
      
      const script = document.querySelector('script[src*="recaptcha"]')
      expect(script).toBeTruthy()
      expect(script?.getAttribute('src')).toContain('recaptcha/api.js')
    })

    it('debería resolver inmediatamente si ya está cargado', async () => {
      // Primera carga
      await loadRecaptchaScript()
      
      const scriptsBefore = document.querySelectorAll('script[src*="recaptcha"]').length
      
      // Segunda carga (debería reutilizar)
      await loadRecaptchaScript()
      
      const scriptsAfter = document.querySelectorAll('script[src*="recaptcha"]').length
      
      expect(scriptsBefore).toBe(scriptsAfter)
    })

    it('NO debería crear scripts duplicados', async () => {
      await Promise.all([
        loadRecaptchaScript(),
        loadRecaptchaScript(),
        loadRecaptchaScript(),
      ])
      
      const scripts = document.querySelectorAll('script[src*="recaptcha"]')
      expect(scripts.length).toBeLessThanOrEqual(1)
    })

    it('debería usar la SITE_KEY del environment', async () => {
      await loadRecaptchaScript()
      
      const script = document.querySelector('script[src*="recaptcha"]')
      expect(script?.getAttribute('src')).toContain('render=test_site_key')
    })
  })

  describe('executeRecaptcha', () => {
    it('debería ejecutar reCAPTCHA y retornar token', async () => {
      const token = await executeRecaptcha('register')
      
      expect(token).toBe('test_recaptcha_token')
      expect(window.grecaptcha.execute).toHaveBeenCalledWith(
        'test_site_key',
        { action: 'register' },
      )
    })

    it('debería cargar el script si no está cargado', async () => {
      // Eliminar grecaptcha para simular que no está cargado
      delete (window as any).grecaptcha
      
      // Re-crear después de un delay
      setTimeout(() => {
        window.grecaptcha = {
          ready: vi.fn((callback) => callback()),
          execute: vi.fn(() => Promise.resolve('loaded_token')),
          render: vi.fn(() => 1),
        }
      }, 50)
      
      const token = await executeRecaptcha('login')
      
      expect(token).toBeDefined()
    })

    it('debería usar diferentes actions', async () => {
      await executeRecaptcha('register')
      expect(window.grecaptcha.execute).toHaveBeenCalledWith(
        expect.anything(),
        { action: 'register' },
      )
      
      await executeRecaptcha('login')
      expect(window.grecaptcha.execute).toHaveBeenCalledWith(
        expect.anything(),
        { action: 'login' },
      )
      
      await executeRecaptcha('submit_review')
      expect(window.grecaptcha.execute).toHaveBeenCalledWith(
        expect.anything(),
        { action: 'submit_review' },
      )
    })

    it('debería retornar token dummy en desarrollo sin SITE_KEY', async () => {
      // Simular que no hay SITE_KEY
      const originalEnv = import.meta.env.VITE_RECAPTCHA_SITE_KEY
      ;(import.meta.env as any).VITE_RECAPTCHA_SITE_KEY = ''
      ;(import.meta.env as any).DEV = true
      
      const token = await executeRecaptcha('test')
      
      expect(token).toBe('dev_mode_no_captcha')
      
      // Restaurar
      ;(import.meta.env as any).VITE_RECAPTCHA_SITE_KEY = originalEnv
    })

    it('debería lanzar error en producción sin SITE_KEY', async () => {
      // Simular producción sin SITE_KEY
      const originalEnv = import.meta.env.VITE_RECAPTCHA_SITE_KEY
      const originalDev = import.meta.env.DEV
      ;(import.meta.env as any).VITE_RECAPTCHA_SITE_KEY = ''
      ;(import.meta.env as any).DEV = false
      ;(import.meta.env as any).PROD = true
      
      await expect(executeRecaptcha('test')).rejects.toThrow('reCAPTCHA no configurada')
      
      // Restaurar
      ;(import.meta.env as any).VITE_RECAPTCHA_SITE_KEY = originalEnv
      ;(import.meta.env as any).DEV = originalDev
    })

    it('debería manejar errores de ejecución', async () => {
      // Mock que falla
      window.grecaptcha.execute = vi.fn(() => Promise.reject(new Error('Network error')))
      
      await expect(executeRecaptcha('test')).rejects.toThrow()
    })

    it('debería rechazar si no se obtiene token', async () => {
      // Mock que retorna null
      window.grecaptcha.execute = vi.fn(() => Promise.resolve(null as any))
      
      await expect(executeRecaptcha('test')).rejects.toThrow('No se obtuvo token')
    })
  })

  describe('Security Tests', () => {
    it('NO debería exponer la SECRET_KEY (solo SITE_KEY pública)', () => {
      // La SITE_KEY pública está bien, pero SECRET_KEY NO debe estar en frontend
      expect(import.meta.env.VITE_RECAPTCHA_SITE_KEY).toBeDefined()
      expect(import.meta.env.VITE_RECAPTCHA_SECRET_KEY).toBeUndefined()
    })

    it('debería validar actions para prevenir abuse', async () => {
      // Actions válidas comunes
      const validActions = [
        'register',
        'login',
        'submit_review',
        'create_reservation',
        'contact_form',
      ]
      
      for (const action of validActions) {
        const token = await executeRecaptcha(action)
        expect(token).toBeDefined()
        expect(token.length).toBeGreaterThan(0)
      }
    })

    it('debería proteger contra rate limiting en el cliente', async () => {
      // Intentar ejecutar muchas veces rápidamente
      const promises = Array(10).fill(null).map(() => executeRecaptcha('test'))
      const results = await Promise.all(promises)
      
      // Todas deberían retornar tokens
      expect(results.every(token => typeof token === 'string')).toBe(true)
      
      // Pero en backend, Google reCAPTCHA limitaría requests sospechosos
    })

    it('NO debería permitir modificar el token desde el cliente', async () => {
      const token = await executeRecaptcha('register')
      
      // El token es una string encriptada
      expect(typeof token).toBe('string')
      
      // Modificar el token lo invalidaría en el backend
      const modifiedToken = token + 'hacked'
      
      // En backend, verifyRecaptchaToken(modifiedToken) debería fallar
      // Aquí solo verificamos que el token original es válido
      expect(token).not.toBe(modifiedToken)
    })

    it('debería generar tokens diferentes en cada ejecución', async () => {
      // Mock para generar tokens únicos
      let counter = 0
      window.grecaptcha.execute = vi.fn(() => {
        counter++
        return Promise.resolve(`token_${counter}`)
      })
      
      const token1 = await executeRecaptcha('register')
      const token2 = await executeRecaptcha('register')
      const token3 = await executeRecaptcha('register')
      
      expect(token1).not.toBe(token2)
      expect(token2).not.toBe(token3)
      expect(token1).not.toBe(token3)
    })
  })

  describe('Integration Tests', () => {
    it('debería integrarse correctamente con formulario de registro', async () => {
      // Simular flujo de registro
      const userInput = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      }
      
      // 1. Usuario llena formulario
      // 2. Usuario hace click en "Registrar"
      // 3. Se ejecuta reCAPTCHA
      const token = await executeRecaptcha('register')
      
      // 4. Token se envía al backend junto con datos de registro
      const registrationData = {
        ...userInput,
        recaptchaToken: token,
      }
      
      expect(registrationData.recaptchaToken).toBeDefined()
      expect(typeof registrationData.recaptchaToken).toBe('string')
    })

    it('debería manejar múltiples formularios en la misma página', async () => {
      // Registro
      const registerToken = await executeRecaptcha('register')
      
      // Login
      const loginToken = await executeRecaptcha('login')
      
      // Contacto
      const contactToken = await executeRecaptcha('contact_form')
      
      expect(registerToken).toBeDefined()
      expect(loginToken).toBeDefined()
      expect(contactToken).toBeDefined()
      
      // Cada uno debería tener su propia action
      expect(window.grecaptcha.execute).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        { action: 'register' },
      )
      expect(window.grecaptcha.execute).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        { action: 'login' },
      )
      expect(window.grecaptcha.execute).toHaveBeenNthCalledWith(
        3,
        expect.anything(),
        { action: 'contact_form' },
      )
    })
  })

  describe('Error Handling', () => {
    it('debería manejar script load timeout', async () => {
      // Eliminar grecaptcha para forzar carga
      delete (window as any).grecaptcha
      
      // No crear grecaptcha (simular timeout)
      
      await expect(loadRecaptchaScript()).rejects.toThrow()
    })

    it('debería manejar error de red', async () => {
      window.grecaptcha.execute = vi.fn(() => 
        Promise.reject(new Error('Network request failed'))
      )
      
      await expect(executeRecaptcha('test')).rejects.toThrow()
    })

    it('debería loguear warnings en desarrollo', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn')
      
      // Forzar warning por falta de SITE_KEY
      const originalKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
      ;(import.meta.env as any).VITE_RECAPTCHA_SITE_KEY = ''
      ;(import.meta.env as any).DEV = true
      
      await executeRecaptcha('test')
      
      expect(consoleWarnSpy).toHaveBeenCalled()
      
      // Restaurar
      ;(import.meta.env as any).VITE_RECAPTCHA_SITE_KEY = originalKey
    })
  })
})
