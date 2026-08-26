/**
 * Scheduled Functions - Funciones que se ejecutan periódicamente
 * Para limpieza, mantenimiento, y tareas programadas
 */

import { Timestamp } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { adminDb } from '../server/firebase-admin.ts'
import { cleanupRateLimits } from './middleware/rateLimiter'

async function deleteExpiredQuery(
  collectionName: string,
  field: string,
  before: Timestamp,
  max = 400,
): Promise<number> {
  const snapshot = await adminDb
    .collection(collectionName)
    .where(field, '<', before)
    .limit(max)
    .get()

  if (snapshot.empty) {
    return 0
  }

  const batch = adminDb.batch()
  snapshot.docs.forEach((item) => batch.delete(item.ref))
  await batch.commit()
  return snapshot.size
}

/**
 * Limpia rate limits y tokens de reset caducados cada día a las 3 AM.
 * Libera espacio en Firestore y evita que crezcan colecciones de apoyo.
 */
export const cleanupRateLimitsScheduled = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Europe/Madrid',
    region: 'europe-west1',
  },
  async () => {
    console.log('Starting Firestore junk cleanup...')

    const [rateLimits, resetTokens] = await Promise.all([
      cleanupRateLimits(),
      deleteExpiredQuery('passwordResetTokens', 'expiresAt', Timestamp.now()),
    ])

    console.log(`Cleanup completed: rateLimits=${rateLimits.deleted} resetTokens=${resetTokens}`)

    return {
      success: true,
      deleted: rateLimits.deleted + resetTokens,
      timestamp: new Date().toISOString(),
    }
  },
)
