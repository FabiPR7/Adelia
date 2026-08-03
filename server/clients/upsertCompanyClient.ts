import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

function normalizeClientEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidClientEmail(email: string): boolean {
  const trimmed = email.trim()
  return trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

function resolveReservationDate(data: DocumentData): Date {
  const createdAt = data.createdAt as Timestamp | undefined
  if (createdAt?.toDate) {
    return createdAt.toDate()
  }

  const startTime = data.startTime as Timestamp | undefined
  if (startTime?.toDate) {
    return startTime.toDate()
  }

  return new Date()
}

/**
 * Upserts a company client from reservation data (idempotent per reservation).
 */
export async function upsertCompanyClientFromReservation(
  db: Firestore,
  reservationId: string,
  data: DocumentData,
): Promise<boolean> {
  if (data.clientSyncedAt) {
    return false
  }

  const companyId = typeof data.companyId === 'string' ? data.companyId : ''
  const email = typeof data.clientEmail === 'string' ? normalizeClientEmail(data.clientEmail) : ''

  if (!companyId || !isValidClientEmail(email)) {
    return false
  }

  const reservationDate = resolveReservationDate(data)
  const name = typeof data.clientName === 'string' ? data.clientName.trim() || 'Cliente' : 'Cliente'
  const phone = typeof data.clientPhone === 'string' ? data.clientPhone.trim() : ''
  const reservationRef = db.collection('reservations').doc(reservationId)
  const clientRef = db.collection('companies').doc(companyId).collection('clients').doc(email)

  await db.runTransaction(async (tx) => {
    const reservationSnap = await tx.get(reservationRef)

    if (!reservationSnap.exists || reservationSnap.data()?.clientSyncedAt) {
      return
    }

    const clientSnap = await tx.get(clientRef)
    const reservationTimestamp = Timestamp.fromDate(reservationDate)

    if (clientSnap.exists) {
      tx.update(clientRef, {
        email,
        name,
        phone,
        lastReservationDate: reservationTimestamp,
        reservationCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      tx.set(clientRef, {
        email,
        name,
        phone,
        firstReservationDate: reservationTimestamp,
        lastReservationDate: reservationTimestamp,
        reservationCount: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    tx.update(reservationRef, {
      clientSyncedAt: FieldValue.serverTimestamp(),
    })
  })

  return true
}
