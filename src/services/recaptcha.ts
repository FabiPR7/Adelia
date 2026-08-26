/**
 * Servicio de reCAPTCHA v3 para prevenir bots
 * 
 * CONFIGURACIÓN REQUERIDA:
 * 1. Registrarse en https://www.google.com/recaptcha/admin
 * 2. Crear un sitio con reCAPTCHA v3
 * 3. Agregar las keys al archivo .env.local:
 *    VITE_RECAPTCHA_SITE_KEY=tu_site_key_aqui
 * 
 * Para Cloud Functions, agregar la SECRET_KEY en:
 * Firebase Console → Functions → Secrets
 */

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''

/**
 * Carga el script de reCAPTCHA v3 dinámicamente
 */
export function loadRecaptchaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!RECAPTCHA_SITE_KEY) {
      if (import.meta.env.DEV) {
        resolve()
        return
      }
      reject(new Error('reCAPTCHA no configurada'))
      return
    }

    if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
      resolve()
      return
    }

    // Si ya existe el script, esperar a que cargue
    const existingScript = document.querySelector(
      `script[src*="recaptcha"]`,
    ) as HTMLScriptElement
    
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve())
      existingScript.addEventListener('error', () => 
        reject(new Error('Error cargando reCAPTCHA'))
      )
      return
    }

    // Crear y agregar el script
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`
    script.async = true
    script.defer = true
    
    script.onload = () => {
      // Esperar a que grecaptcha esté listo
      const checkReady = setInterval(() => {
        if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
          clearInterval(checkReady)
          resolve()
        }
      }, 100)
      
      // Timeout después de 10 segundos
      setTimeout(() => {
        clearInterval(checkReady)
        reject(new Error('Timeout cargando reCAPTCHA'))
      }, 10000)
    }
    
    script.onerror = () => reject(new Error('Error cargando reCAPTCHA'))
    
    document.head.appendChild(script)
  })
}

/**
 * Ejecuta reCAPTCHA v3 y obtiene un token
 * 
 * @param action - Acción específica (ej: 'register', 'login', 'submit_review')
 * @returns Token de reCAPTCHA para enviar al backend
 */
export async function executeRecaptcha(action: string): Promise<string> {
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('⚠️ RECAPTCHA_SITE_KEY no configurada. Ver src/services/recaptcha.ts')
    // En desarrollo, retornar token dummy
    if (import.meta.env.DEV) {
      return 'dev_mode_no_captcha'
    }
    throw new Error('reCAPTCHA no configurada')
  }

  try {
    // Asegurar que el script está cargado
    await loadRecaptchaScript()

    // Ejecutar reCAPTCHA
    const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action })
    
    if (!token) {
      throw new Error('No se obtuvo token de reCAPTCHA')
    }

    return token
  } catch (error) {
    console.error('Error ejecutando reCAPTCHA:', error)
    throw error
  }
}

/**
 * Valida un token de reCAPTCHA en el backend
 * Esta función está pensada para ser usada en Cloud Functions
 * 
 * @param token - Token obtenido del frontend
 * @param expectedAction - Acción esperada
 * @param minScore - Score mínimo aceptable (0.0 - 1.0). Por defecto 0.5
 * @returns true si el token es válido
 */
export async function verifyRecaptchaToken(
  _token: string,
  _expectedAction: string,
  _minScore: number = 0.5,
): Promise<boolean> {
  // Esta función debe implementarse en Cloud Functions
  // Aquí solo está la firma para referencia
  console.warn('verifyRecaptchaToken debe implementarse en Cloud Functions')
  return false
}

/**
 * Hook para usar reCAPTCHA en componentes React
 * 
 * @example
 * const { executeRecaptcha, isReady } = useRecaptcha()
 * 
 * const handleSubmit = async () => {
 *   if (!isReady) return
 *   const token = await executeRecaptcha('register')
 *   // Enviar token al backend
 * }
 */
export function useRecaptcha() {
  const [isReady, setIsReady] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    loadRecaptchaScript()
      .then(() => setIsReady(true))
      .catch(err => setError(err))
  }, [])

  const execute = React.useCallback(async (action: string) => {
    if (!isReady) {
      throw new Error('reCAPTCHA no está listo')
    }
    return executeRecaptcha(action)
  }, [isReady])

  return {
    executeRecaptcha: execute,
    isReady,
    error,
  }
}

// Tipos globales para TypeScript
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
      render: (container: string | HTMLElement, parameters: unknown) => number
    }
  }
}

// Import React para el hook
import * as React from 'react'
