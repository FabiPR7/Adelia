/**
 * Rate Limiter Middleware para Cloud Functions
 * Previene DoS attacks y controla costes
 * 
 * Usa Firestore como backend (puede migrar a Redis/Upstash si se necesita más performance)
 */

import * as admin from 'firebase-admin'
import { HttpsError } from 'firebase-functions/v2/https'

interface RateLimitConfig {
  maxRequests: number      // Máximo de requests
  windowSeconds: number    // Ventana de tiempo en segundos
  blockDurationSeconds?: number // Duración del bloqueo (default: windowSeconds * 2)
}

interface RateLimitEntry {
  count: number
  resetAt: number // timestamp
  blockedUntil?: number // timestamp
}

/**
 * Rate limiter basado en Firestore
 * 
 * Limita requests por:
 * - IP address
 * - User ID
 * - Combinación de ambos
 */
export class FirestoreRateLimiter {
  private db: admin.firestore.Firestore
  private collectionName = 'rateLimits'

  constructor() {
    this.db = admin.firestore()
  }

  /**
   * Verifica si una key está dentro del rate limit
   * 
   * @returns true si está permitido, false si excede el límite
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now()
    const docRef = this.db.collection(this.collectionName).doc(key)

    try {
      const result = await this.db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef)
        const data = doc.data() as RateLimitEntry | undefined

        // Si está bloqueado temporalmente
        if (data?.blockedUntil && data.blockedUntil > now) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: data.blockedUntil,
          }
        }

        // Si no existe o la ventana expiró, crear nueva entrada
        if (!data || data.resetAt < now) {
          const newEntry: RateLimitEntry = {
            count: 1,
            resetAt: now + config.windowSeconds * 1000,
          }

          transaction.set(docRef, newEntry)

          return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetAt: newEntry.resetAt,
          }
        }

        // Si está dentro del límite
        if (data.count < config.maxRequests) {
          transaction.update(docRef, {
            count: admin.firestore.FieldValue.increment(1),
          })

          return {
            allowed: true,
            remaining: config.maxRequests - data.count - 1,
            resetAt: data.resetAt,
          }
        }

        // Excedió el límite - bloquear temporalmente
        const blockDuration = (config.blockDurationSeconds || config.windowSeconds * 2) * 1000
        const blockedUntil = now + blockDuration

        transaction.update(docRef, {
          blockedUntil,
        })

        // Loguear intento de abuso
        const securityEventRef = this.db.collection('securityEvents').doc()
        transaction.set(securityEventRef, {
          type: 'rate_limit_exceeded',
          severity: 'medium',
          details: {
            key,
            count: data.count,
            maxRequests: config.maxRequests,
            windowSeconds: config.windowSeconds,
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          environment: process.env.NODE_ENV || 'production',
        })

        return {
          allowed: false,
          remaining: 0,
          resetAt: blockedUntil,
        }
      })

      return result
    } catch (error) {
      console.error('Rate limiter error:', error)
      // En caso de error, permitir el request (fail-open)
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowSeconds * 1000,
      }
    }
  }

  /**
   * Resetea el contador para una key específica
   * Útil para desbloquear manualmente un usuario
   */
  async resetLimit(key: string): Promise<void> {
    await this.db.collection(this.collectionName).doc(key).delete()
  }

  /**
   * Limpia entradas antiguas (ejecutar periódicamente)
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('resetAt', '<', cutoff)
      .limit(500)
      .get()

    const batch = this.db.batch()
    snapshot.docs.forEach(doc => batch.delete(doc.ref))
    await batch.commit()

    return snapshot.size
  }
}

/**
 * Configuraciones predefinidas para diferentes endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  // Autenticación - muy restrictivo
  login: {
    maxRequests: 5,
    windowSeconds: 60,
    blockDurationSeconds: 300, // 5 minutos
  },
  register: {
    maxRequests: 3,
    windowSeconds: 60,
    blockDurationSeconds: 600, // 10 minutos
  },
  passwordReset: {
    maxRequests: 3,
    windowSeconds: 300, // 5 minutos
    blockDurationSeconds: 900, // 15 minutos
  },

  // Reservas - moderado
  createReservation: {
    maxRequests: 10,
    windowSeconds: 60,
    blockDurationSeconds: 120,
  },
  cancelReservation: {
    maxRequests: 5,
    windowSeconds: 60,
  },
  checkAvailability: {
    maxRequests: 30,
    windowSeconds: 60,
  },

  // Operaciones administrativas - más permisivo
  adminOperations: {
    maxRequests: 100,
    windowSeconds: 60,
  },

  // Lecturas generales - muy permisivo
  readOperations: {
    maxRequests: 100,
    windowSeconds: 60,
  },

  // reCAPTCHA verification
  recaptcha: {
    maxRequests: 10,
    windowSeconds: 60,
    blockDurationSeconds: 300,
  },
} as const

/**
 * Helper para generar keys de rate limit
 */
export function getRateLimitKey(
  endpoint: string,
  identifier: string // IP, userId, o combinación
): string {
  return `${endpoint}:${identifier}`
}

/**
 * Middleware wrapper para Cloud Functions
 * 
 * @example
 * export const myFunction = onCall(async (request) => {
 *   await checkRateLimit(request, 'myEndpoint', RATE_LIMIT_CONFIGS.readOperations)
 *   // ... resto de la función
 * })
 */
export async function checkRateLimit(
  request: { auth?: { uid: string }; rawRequest: any },
  endpoint: string,
  config: RateLimitConfig
): Promise<void> {
  const rateLimiter = new FirestoreRateLimiter()

  // Identificar al usuario por:
  // 1. User ID (si está autenticado)
  // 2. IP address (si no está autenticado)
  // 3. Combinación de ambos (para mayor seguridad)

  const userId = request.auth?.uid
  const ip = request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for'] || 'unknown'

  // Usar userId si existe, sino IP
  const identifier = userId || ip
  const key = getRateLimitKey(endpoint, identifier)

  const result = await rateLimiter.checkLimit(key, config)

  if (!result.allowed) {
    const resetDate = new Date(result.resetAt)
    throw new HttpsError(
      'resource-exhausted',
      `Demasiadas solicitudes. Intenta de nuevo en ${Math.ceil((result.resetAt - Date.now()) / 1000)} segundos.`,
      {
        resetAt: resetDate.toISOString(),
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      }
    )
  }

  // Opcional: Log solo en desarrollo (evitar information disclosure)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Rate limit - ${endpoint}: ${result.remaining} requests remaining`)
  }
}

/**
 * Cloud Function para limpiar rate limits antiguos
 * Ejecutar diariamente con Cloud Scheduler
 */
export async function cleanupRateLimits(): Promise<{ deleted: number }> {
  const rateLimiter = new FirestoreRateLimiter()
  const deleted = await rateLimiter.cleanup(7)
  return { deleted }
}
