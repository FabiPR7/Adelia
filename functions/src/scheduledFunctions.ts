/**
 * Scheduled Functions - Funciones que se ejecutan periódicamente
 * Para limpieza, mantenimiento, y tareas programadas
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { cleanupRateLimits } from './middleware/rateLimiter'

/**
 * Limpia rate limits antiguos cada día a las 3 AM
 * Libera espacio en Firestore y mejora performance
 */
export const cleanupRateLimitsScheduled = onSchedule(
  {
    schedule: '0 3 * * *', // 3 AM cada día (cron format)
    timeZone: 'Europe/Madrid',
    region: 'europe-southwest1',
  },
  async (event) => {
    console.log('Starting rate limit cleanup...')

    try {
      const result = await cleanupRateLimits()
      console.log(`Cleanup completed: ${result.deleted} entries deleted`)

      return {
        success: true,
        deleted: result.deleted,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Cleanup error:', error)
      throw error
    }
  }
)

/**
 * Agrega más scheduled functions aquí:
 * - Envío de notificaciones diarias
 * - Generación de reportes semanales
 * - Limpieza de datos antiguos
 * - Actualización de rankings/leaderboards
 * etc.
 */
