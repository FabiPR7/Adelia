/**
 * Cloud Functions triggers para mantener contadores agregados actualizados
 * Esto evita tener que leer colecciones completas para obtener totales
 */

import * as functions from 'firebase-functions'
import { adminDb } from '../firebase-admin.ts'
import { FieldValue } from 'firebase-admin/firestore'

const STATS_DOC_PATH = 'stats/counters'

/**
 * Incrementa o decrementa un contador de forma atómica
 */
async function updateCounter(
  counterName: string,
  delta: number,
  transaction?: FirebaseFirestore.Transaction
): Promise<void> {
  const statsRef = adminDb.doc(STATS_DOC_PATH)

  if (transaction) {
    transaction.set(
      statsRef,
      {
        [counterName]: FieldValue.increment(delta),
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  } else {
    await statsRef.set(
      {
        [counterName]: FieldValue.increment(delta),
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  }
}

/**
 * Trigger: Cuando se crea un usuario
 */
export const onUserCreate = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap) => {
    const userData = snap.data()
    const role = userData?.role || 'customer'

    // Incrementar contador total de usuarios
    await updateCounter('totalUsers', 1)

    // Incrementar contador específico según rol
    if (role === 'customer') {
      await updateCounter('totalCustomers', 1)
    } else if (role === 'company') {
      await updateCounter('totalCompanyUsers', 1)
    }

    console.log(`✅ User counter incremented: ${snap.id} (role: ${role})`)
  })

/**
 * Trigger: Cuando se elimina un usuario
 */
export const onUserDelete = functions.firestore
  .document('users/{userId}')
  .onDelete(async (snap) => {
    const userData = snap.data()
    const role = userData?.role || 'customer'

    // Decrementar contador total de usuarios
    await updateCounter('totalUsers', -1)

    // Decrementar contador específico según rol
    if (role === 'customer') {
      await updateCounter('totalCustomers', -1)
    } else if (role === 'company') {
      await updateCounter('totalCompanyUsers', -1)
    }

    console.log(`✅ User counter decremented: ${snap.id}`)
  })

/**
 * Trigger: Cuando se crea una empresa
 */
export const onCompanyCreate = functions.firestore
  .document('companies/{companyId}')
  .onCreate(async (snap) => {
    await updateCounter('totalCompanies', 1)
    console.log(`✅ Company counter incremented: ${snap.id}`)
  })

/**
 * Trigger: Cuando se elimina una empresa
 */
export const onCompanyDelete = functions.firestore
  .document('companies/{companyId}')
  .onDelete(async (snap) => {
    await updateCounter('totalCompanies', -1)
    console.log(`✅ Company counter decremented: ${snap.id}`)
  })

/**
 * Trigger: Cuando se crea una reserva
 */
export const onReservationCreate = functions.firestore
  .document('reservations/{reservationId}')
  .onCreate(async (snap) => {
    await updateCounter('totalReservations', 1)
    console.log(`✅ Reservation counter incremented: ${snap.id}`)
  })

/**
 * Trigger: Cuando se elimina una reserva
 */
export const onReservationDelete = functions.firestore
  .document('reservations/{reservationId}')
  .onDelete(async (snap) => {
    await updateCounter('totalReservations', -1)
    console.log(`✅ Reservation counter decremented: ${snap.id}`)
  })

/**
 * Trigger: Cuando se crea una review
 */
export const onReviewCreate = functions.firestore
  .document('companies/{companyId}/reviews/{reviewId}')
  .onCreate(async (snap) => {
    await updateCounter('totalReviews', 1)
    console.log(`✅ Review counter incremented: ${snap.id}`)
  })

/**
 * Trigger: Cuando se elimina una review
 */
export const onReviewDelete = functions.firestore
  .document('companies/{companyId}/reviews/{reviewId}')
  .onDelete(async (snap) => {
    await updateCounter('totalReviews', -1)
    console.log(`✅ Review counter decremented: ${snap.id}`)
  })

/**
 * Función para inicializar/recalcular todos los contadores
 * Solo debe ejecutarse una vez al inicio o para corregir inconsistencias
 */
export const recalculateAllCounters = functions.https.onCall(async (data, context) => {
  // Solo admins pueden ejecutar esto
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden recalcular contadores.'
    )
  }

  console.log('🔄 Recalculando todos los contadores...')

  try {
    // Contar usuarios
    const usersSnapshot = await adminDb.collection('users').count().get()
    const totalUsers = usersSnapshot.data().count

    // Contar customers
    const customersSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'customer')
      .count()
      .get()
    const totalCustomers = customersSnapshot.data().count

    // Contar empresas
    const companiesSnapshot = await adminDb.collection('companies').count().get()
    const totalCompanies = companiesSnapshot.data().count

    // Contar reservas
    const reservationsSnapshot = await adminDb.collection('reservations').count().get()
    const totalReservations = reservationsSnapshot.data().count

    // Contar reviews (esto es más complejo porque están en subcolecciones)
    let totalReviews = 0
    const companiesDocs = await adminDb.collection('companies').select().get()
    for (const companyDoc of companiesDocs.docs) {
      const reviewsCount = await adminDb
        .collection('companies')
        .doc(companyDoc.id)
        .collection('reviews')
        .count()
        .get()
      totalReviews += reviewsCount.data().count
    }

    // Actualizar documento de stats
    await adminDb.doc(STATS_DOC_PATH).set({
      totalUsers,
      totalCustomers,
      totalCompanyUsers: totalUsers - totalCustomers,
      totalCompanies,
      totalReservations,
      totalReviews,
      lastUpdated: FieldValue.serverTimestamp(),
      lastRecalculated: FieldValue.serverTimestamp(),
    })

    console.log('✅ Contadores recalculados:', {
      totalUsers,
      totalCustomers,
      totalCompanies,
      totalReservations,
      totalReviews,
    })

    return {
      success: true,
      counters: {
        totalUsers,
        totalCustomers,
        totalCompanies,
        totalReservations,
        totalReviews,
      },
    }
  } catch (error) {
    console.error('❌ Error recalculando contadores:', error)
    throw new functions.https.HttpsError(
      'internal',
      'Error al recalcular contadores: ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
})
