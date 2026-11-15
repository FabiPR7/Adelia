import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'
import { deleteQueryInBatches } from './deleteQueryInBatches.ts'
import { releaseUsername } from './usernames.ts'
import { cancelFutureReservationsOnAccountDeletion } from '../reservations/cancelOnAccountDeletion.ts'

const ANONYMIZE_PAGE = 200

/** Anonimiza las reservas de la consulta y anota de qué restaurantes eran. */
async function anonymizeReservations(
  query: FirebaseFirestore.Query,
  companyIds: Set<string>,
): Promise<void> {
  for (;;) {
    const snap = await query.limit(ANONYMIZE_PAGE).get()
    if (snap.empty) {
      return
    }
    const batch = adminDb.batch()
    for (const docSnap of snap.docs) {
      const companyId = docSnap.data().companyId
      if (typeof companyId === 'string' && companyId) {
        companyIds.add(companyId)
      }
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
    if (snap.size < ANONYMIZE_PAGE) {
      return
    }
  }
}

/**
 * Baja RGPD de un comensal: borra datos de cuenta / social / gamificación y
 * anonimiza reservas y consumos históricos (el restaurante conserva la plaza y
 * los importes sin PII del comensal).
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

  // Solo se actúa por correo si está verificado: si no, cualquiera podría borrar
  // los datos de otra persona registrándose con su dirección.
  const authUser = await adminAuth.getUser(uid).catch(() => null)
  const verifiedEmail = authUser?.emailVerified && authUser.email
    ? authUser.email.trim().toLowerCase()
    : ''
  const companyIds = new Set<string>()

  // Lo primero: sus reservas futuras se cancelan (el local recibe el aviso).
  await cancelFutureReservationsOnAccountDeletion(uid, verifiedEmail)

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
  for (;;) {
    const indexSnap = await adminDb
      .collection(COLLECTIONS.reviewIndex)
      .where('customerUid', '==', uid)
      .limit(100)
      .get()
    if (indexSnap.empty) {
      break
    }
    for (const indexDoc of indexSnap.docs) {
      const companyId = String(indexDoc.data().companyId ?? '')
      if (companyId) {
        companyIds.add(companyId)
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
              // Las fotos y vídeos de la reseña también son suyos.
              mediaItems: [],
              hasPhoto: false,
              anonymizedAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            },
            { merge: true },
          )
          .catch(() => undefined)
      }
      await indexDoc.ref.delete()
    }
  }

  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.notificationJobs).where('userId', '==', uid),
  )
  await deleteQueryInBatches(
    adminDb.collection(COLLECTIONS.userFavorites).where('userId', '==', uid),
  )

  // Reportes de locales y sugerencias: el texto se conserva (soporte puede tener que
  // revisar una queja), pero ya no se sabe de quién era.
  for (const collectionName of ['restaurantReports', 'suggestions']) {
    const query = adminDb.collection(collectionName).where('customerUid', '==', uid)
    for (;;) {
      const snap = await query.limit(ANONYMIZE_PAGE).get()
      if (snap.empty) break
      const batch = adminDb.batch()
      for (const docSnap of snap.docs) {
        batch.update(docSnap.ref, {
          customerUid: FieldValue.delete(),
          customerName: 'Cliente eliminado',
          customerEmail: '',
          anonymizedAt: Timestamp.now(),
        })
      }
      await batch.commit()
      if (snap.size < ANONYMIZE_PAGE) break
    }
  }

  // Anonimizar reservas: el local conserva el hueco; se quita PII del comensal.
  await anonymizeReservations(
    adminDb.collection(COLLECTIONS.reservations).where('customerUid', '==', uid),
    companyIds,
  )
  // También las hechas solo con el correo, sin cuenta enlazada.
  if (verifiedEmail) {
    await anonymizeReservations(
      adminDb.collection(COLLECTIONS.reservations).where('clientEmail', '==', verifiedEmail),
      companyIds,
    )
  }

  // Consumos verificados: el local conserva importes y productos para sus informes.
  for (;;) {
    const snap = await adminDb
      .collectionGroup('verifiedConsumptions')
      .where('customerUid', '==', uid)
      .limit(ANONYMIZE_PAGE)
      .get()
    if (snap.empty) {
      break
    }
    const batch = adminDb.batch()
    for (const docSnap of snap.docs) {
      const companyId = docSnap.ref.parent.parent?.id
      if (companyId) {
        companyIds.add(companyId)
      }
      batch.update(docSnap.ref, {
        customerUid: FieldValue.delete(),
        clientName: 'Cliente eliminado',
        clientEmail: '',
        anonymizedAt: Timestamp.now(),
      })
    }
    await batch.commit()
    if (snap.size < ANONYMIZE_PAGE) {
      break
    }
  }

  // Ficha del comensal en cada restaurante: su id es el correo.
  if (verifiedEmail) {
    const ids = [...companyIds]
    for (let start = 0; start < ids.length; start += ANONYMIZE_PAGE) {
      const batch = adminDb.batch()
      for (const companyId of ids.slice(start, start + ANONYMIZE_PAGE)) {
        batch.delete(
          adminDb.collection(COLLECTIONS.companies).doc(companyId).collection('clients').doc(verifiedEmail),
        )
      }
      await batch.commit()
    }
  }

  // recursiveDelete cubre cualquier subcolección del perfil, no solo las conocidas.
  await releaseUsername(uid, userSnap.data()?.username)
  await adminDb.recursiveDelete(userRef)
  await adminDb.collection(COLLECTIONS.userGamification).doc(uid).delete()

  try {
    await adminAuth.deleteUser(uid)
  } catch {
    // Auth puede haberse borrado ya.
  }
}
