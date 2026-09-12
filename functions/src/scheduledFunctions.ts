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
 * Cuenta visitantes distintos (uid o anonId) del día anterior por restaurante y
 * lo guarda en `companies/{id}/metrics/{yyyy-mm}.uniquesByDay.{yyyy-mm-dd}`.
 * Los contadores del informe se incrementan en vivo; "personas distintas" no se
 * puede hacer con `increment`, así que se calcula una vez al día aquí.
 */
async function rollupAppEventUniques(): Promise<number> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const dayKey = yesterday.toISOString().slice(0, 10)
  const monthKey = dayKey.slice(0, 7)

  const perCompany = new Map<string, Set<string>>()
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null

  for (let page = 0; page < 50; page += 1) {
    let query = adminDb
      .collection('appEvents')
      .where('day', '==', dayKey)
      .orderBy('__name__')
      .limit(2000)
    if (cursor) {
      query = query.startAfter(cursor)
    }
    const snap = await query.get()
    if (snap.empty) {
      break
    }
    for (const docSnap of snap.docs) {
      const data = docSnap.data()
      const companyId = typeof data.companyId === 'string' ? data.companyId : ''
      const visitor = (typeof data.uid === 'string' && data.uid)
        || (typeof data.anonId === 'string' && data.anonId)
        || ''
      if (!companyId || !visitor) {
        continue
      }
      let set = perCompany.get(companyId)
      if (!set) {
        set = new Set()
        perCompany.set(companyId, set)
      }
      set.add(visitor)
    }
    if (snap.size < 2000) {
      break
    }
    cursor = snap.docs[snap.docs.length - 1]
  }

  const writes: Promise<unknown>[] = []
  for (const [companyId, visitors] of perCompany) {
    writes.push(
      adminDb
        .collection('companies')
        .doc(companyId)
        .collection('metrics')
        .doc(monthKey)
        .set(
          { month: monthKey, uniquesByDay: { [dayKey]: visitors.size } },
          { merge: true },
        ),
    )
  }
  await Promise.all(writes)
  return perCompany.size
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

    const [rateLimits, resetTokens, stripeEvents, lemonEvents, appEvents, uniqueCompanies] =
      await Promise.all([
        cleanupRateLimits(),
        deleteExpiredQuery('passwordResetTokens', 'expiresAt', Timestamp.now()),
        deleteExpiredQuery('stripeEvents', 'expireAt', Timestamp.now()),
        deleteExpiredQuery('lemonSqueezyEvents', 'expireAt', Timestamp.now()),
        deleteExpiredQuery('appEvents', 'expireAt', Timestamp.now()),
        rollupAppEventUniques().catch((error) => {
          console.error('App event uniques rollup failed:', error)
          return 0
        }),
      ])

    console.log(
      `Cleanup completed: rateLimits=${rateLimits.deleted} resetTokens=${resetTokens} ` +
        `stripeEvents=${stripeEvents} lemonEvents=${lemonEvents} appEvents=${appEvents} ` +
        `uniquesRolledUp=${uniqueCompanies}`,
    )

    return {
      success: true,
      deleted: rateLimits.deleted + resetTokens + stripeEvents + lemonEvents + appEvents,
      timestamp: new Date().toISOString(),
    }
  },
)
