import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'
import { deleteQueryInBatches } from './deleteQueryInBatches.ts'

/**
 * Baja RGPD de un comensal: borra datos de cuenta / social / gamificación y
 * anonimiza reservas históricas (el restaurante conserva la plaza operativa
 * sin PII del comensal).
 */
export async function deleteCustomerAccount(uid: string): Promise<void> {
  const userRef = adminDb.collection(COLLECTIONS.users).doc(uid)
  const userSnap = await userRef.get()
  if (!userSnap.exists) {
    throw new Error('Cuenta no encontrada.')
  }
  if (userSnap.data()?.role !== 'customer') {
    throw new Error('Solo se pueden eliminar cuentas de comensal por esta vía.')
  }

  await deleteQueryInBatches(userRef.collection('notifications'))
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.friendships).where('userIds', 'array-contains', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.friendRequests).where('fromUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.friendRequests).where('toUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.friendFavorites).where('ownerUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.friendFavorites).where('friendUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.reservationInvites).where('fromUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.reservationInvites).where('toUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.reservationChallenges).where('challengerUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.reservationChallenges).where('challengedUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.promotionClaims).where('customerUid', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.productClaims).where('customerUid', '==', uid),
  )

  // Reseñas: anonimizar el doc bajo companies/{id}/reviews/{uid} y borrar el índice.
  {
    const indexSnap = await adminDb
      .collection(COLLECTIONS.reviewIndex)
      .where('customerUid', '==', uid)
      .limit(100)
      .get()
    for (const indexDoc of indexSnap.docs) {
      const companyId = String(indexDoc.data().companyId ?? '')
      if (companyId) {
        await adminDb
          .collection(COLLECTIONS.companies)
          .doc(companyId)
          .collection('reviews')
          .doc(uid)
          .set(
            {
              customerUid: FieldValue.delete(),
              customerName: 'Usuario eliminado',
              comment: '',
              photoUrl: '',
              photoUrls: [],
              anonymizedAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            },
            { merge: true },
          )
          .catch(() => undefined)
      }
      await indexDoc.ref.delete().catch(() => undefined)
    }
  }

  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.notificationJobs).where('userId', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.userFavorites).where('userId', '==', uid),
  )

  // Anonimizar reservas: el local conserva el hueco; se quita PII del comensal.
  for (;;) {
    const snap = await adminDb
      .collection(COLLECTIONS.reservations)
      .where('customerUid', '==', uid)
      .limit(200)
      .get()
    if (snap.empty) {
      break
    }
    const batch = adminDb.batch()
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, {
        customerUid: FieldValue.delete(),
        clientName: 'Cliente eliminado',
        clientEmail: '',
        clientPhone: '',
        photoUrl: FieldValue.delete(),
        anonymizedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    }
    await batch.commit()
    if (snap.size < 200) {
      break
    }
  }

  const batch = adminDb.batch()
  batch.delete(userRef)
  batch.delete(adminDb.collection(COLLECTIONS.userGamification).doc(uid))
  await batch.commit()

  try {
    await adminAuth.deleteUser(uid)
  } catch {
    // Auth puede haberse borrado ya.
  }
}
