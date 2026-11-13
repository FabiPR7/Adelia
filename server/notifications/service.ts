import { BUSINESS_TIME_ZONE } from '../utils/madridDateTime.ts'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '../firebase-admin.ts'

export type NotificationType =
  | 'reservation_received'
  | 'reservation_confirmed'
  | 'reservation_cancelled_by_client'
  | 'reservation_cancelled_by_restaurant'
  | 'reservation_reminder_1h'
  | 'reservation_review_prompt'
  | 'promotion_ready_to_verify'
  | 'promotion_ready_to_claim'
  | 'promotion_claimed'
  | 'friend_request_received'
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'reservation_invite_received'
  | 'reservation_invite_accepted'
  | 'reservation_invite_rejected'
  | 'reservation_invite_cancelled'
  | 'reservation_challenge_received'
  | 'reservation_challenge_resolved'
  | 'mission_completed'
  | 'badge_unlocked'
  | 'level_up'

export interface NotificationPayload {
  type: NotificationType
  title: string
  body: string
  icon?: string
  actionUrl?: string | null
  actionLabel?: string | null
  data?: Record<string, unknown>
  dedupeKey: string
}

export interface ScheduledNotificationJob {
  type: 'reservation_reminder_1h' | 'reservation_review_prompt'
  userId: string
  reservationId: string
  scheduledAt: Date
  companyId: string
  companyName: string
  companySlug: string
  reservationStartTime: Date
}

const NOTIFICATIONS_SUBCOLLECTION = 'notifications'
const JOBS_COLLECTION = 'notificationJobs'

function sanitizeDocId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 240)
}

export async function findCustomerUidByEmail(email: string): Promise<string | null> {
  const trimmed = email.trim()
  if (!trimmed) {
    return null
  }

  const candidates = [trimmed.toLowerCase(), trimmed]
  const seen = new Set<string>()

  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue
    }
    seen.add(candidate)

    const snapshot = await adminDb.collection('users')
      .where('email', '==', candidate)
      .limit(5)
      .get()

    for (const doc of snapshot.docs) {
      if (doc.data().role !== 'customer') {
        continue
      }
      // Solo vale una cuenta que ha demostrado ser dueña de ese correo: si no,
      // cualquiera podría registrarse con el correo de otra persona y recibir
      // los avisos de sus reservas como invitado.
      try {
        const authUser = await adminAuth.getUser(doc.id)
        if (authUser.emailVerified && authUser.email?.trim().toLowerCase() === trimmed.toLowerCase()) {
          return doc.id
        }
      } catch {
        // Cuenta borrada en Auth: no cuenta.
      }
    }
  }

  return null
}

export async function resolveCustomerUidForReservation(
  reservation: Record<string, unknown>,
): Promise<string | null> {
  const customerUid = typeof reservation.customerUid === 'string'
    ? reservation.customerUid.trim()
    : ''

  if (customerUid) {
    const userSnap = await adminDb.collection('users').doc(customerUid).get()
    if (userSnap.exists && userSnap.data()?.role === 'customer') {
      return customerUid
    }
  }

  const clientEmail = typeof reservation.clientEmail === 'string'
    ? reservation.clientEmail
    : ''

  return findCustomerUidByEmail(clientEmail)
}

export async function createCustomerNotification(
  userId: string,
  payload: NotificationPayload,
): Promise<boolean> {
  if (!userId.trim()) {
    return false
  }

  const notificationId = sanitizeDocId(payload.dedupeKey)
  const notificationRef = adminDb
    .collection('users')
    .doc(userId)
    .collection(NOTIFICATIONS_SUBCOLLECTION)
    .doc(notificationId)

  // create() falla si ya existe: dos disparadores a la vez no duplican el aviso
  // ni suman dos veces al contador de no leídos.
  const now = Timestamp.now()
  try {
    await notificationRef.create({
      type: payload.type,
      title: payload.title,
      body: payload.body,
      icon: payload.icon ?? '🔔',
      read: false,
      readAt: null,
      createdAt: now,
      actionUrl: payload.actionUrl ?? null,
      actionLabel: payload.actionLabel ?? null,
      // Sin campos undefined: la base los rechaza y el aviso no se guardaba
      // (p. ej. «premio conseguido» de un mapa, que no tiene reserva).
      data: Object.fromEntries(Object.entries(payload.data ?? {}).filter(([, value]) => value !== undefined)),
      dedupeKey: payload.dedupeKey,
    })
  } catch (error) {
    if ((error as { code?: number | string }).code === 6 || (error as { code?: string }).code === 'already-exists') {
      return false
    }
    throw error
  }

  await adminDb.collection('users').doc(userId).set({
    notificationUnreadCount: FieldValue.increment(1),
  }, { merge: true })

  return true
}

export async function scheduleNotificationJob(
  job: ScheduledNotificationJob,
): Promise<void> {
  const jobId = sanitizeDocId(`${job.type}:${job.reservationId}`)
  const jobRef = adminDb.collection(JOBS_COLLECTION).doc(jobId)

  const existing = await jobRef.get()
  if (existing.exists && existing.data()?.status === 'sent') {
    return
  }

  await jobRef.set({
    type: job.type,
    userId: job.userId,
    reservationId: job.reservationId,
    scheduledAt: Timestamp.fromDate(job.scheduledAt),
    status: 'pending',
    companyId: job.companyId,
    companyName: job.companyName,
    companySlug: job.companySlug,
    reservationStartTime: Timestamp.fromDate(job.reservationStartTime),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
}

export async function cancelNotificationJobsForReservation(
  reservationId: string,
): Promise<void> {
  const snapshot = await adminDb.collection(JOBS_COLLECTION)
    .where('reservationId', '==', reservationId)
    .where('status', '==', 'pending')
    .limit(40)
    .get()

  if (snapshot.empty) {
    return
  }

  const batch = adminDb.batch()
  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      status: 'cancelled',
      updatedAt: Timestamp.now(),
    })
  })
  await batch.commit()
}

export async function processDueNotificationJobs(
  db: Firestore = adminDb,
  now = new Date(),
): Promise<number> {
  let processed = 0
  // Varias tandas por ejecución: con 50 cada 5 minutos se acumulaban avisos.
  for (let page = 0; page < 10; page += 1) {
    const snapshot = await db.collection(JOBS_COLLECTION)
      .where('status', '==', 'pending')
      .where('scheduledAt', '<=', Timestamp.fromDate(now))
      .limit(50)
      .get()
    if (snapshot.empty) {
      break
    }
    for (const docSnap of snapshot.docs) {
      try {
        if (await processNotificationJob(db, docSnap, now)) {
          processed += 1
        }
      } catch (error) {
        // Un aviso que falla no frena al resto; se marca para no reintentarlo sin fin.
        console.error('Notification job failed:', docSnap.id, error)
        await docSnap.ref.update({ status: 'failed', updatedAt: Timestamp.now() }).catch(() => undefined)
      }
    }
    if (snapshot.size < 50) {
      break
    }
  }
  return processed
}

async function processNotificationJob(
  db: Firestore,
  docSnap: FirebaseFirestore.QueryDocumentSnapshot,
  now: Date,
): Promise<boolean> {
  const job = docSnap.data()
  const reservationSnap = await db.collection('reservations').doc(job.reservationId as string).get()
  const reservation = reservationSnap.data()

  if (!reservation || reservation.status === 'cancelled') {
    await docSnap.ref.update({ status: 'cancelled', updatedAt: Timestamp.now() })
    return false
  }

  const userId = job.userId as string
  const companyName = (job.companyName as string) || 'el restaurante'
  const companySlug = (job.companySlug as string) || ''
  const reservationId = job.reservationId as string

  if (job.type === 'reservation_reminder_1h') {
    if (reservation.status !== 'confirmed' && reservation.status !== 'completed') {
      await docSnap.ref.update({ status: 'cancelled', updatedAt: Timestamp.now() })
      return false
    }

    // Hora actual de la reserva (el restaurante puede haberla cambiado).
    const startTime = reservation.startTime instanceof Timestamp
      ? reservation.startTime.toDate()
      : job.reservationStartTime instanceof Timestamp
        ? job.reservationStartTime.toDate()
        : new Date()
    if (startTime.getTime() <= now.getTime()) {
      await docSnap.ref.update({ status: 'cancelled', updatedAt: Timestamp.now() })
      return false
    }
    if (startTime.getTime() - now.getTime() > 75 * 60 * 1000) {
      // La movieron a más tarde: se reprograma para una hora antes de la nueva hora.
      await docSnap.ref.update({
        scheduledAt: Timestamp.fromMillis(startTime.getTime() - 60 * 60 * 1000),
        reservationStartTime: Timestamp.fromDate(startTime),
        updatedAt: Timestamp.now(),
      })
      return false
    }

    await createCustomerNotification(userId, {
      type: 'reservation_reminder_1h',
      title: 'Tu reserva es pronto',
      body: `Recuerda que tienes reserva en ${companyName} hoy a las ${formatTime(startTime)}.`,
      icon: '⏰',
      actionUrl: '/app/reservas',
      actionLabel: 'Ver reserva',
      dedupeKey: `reservation_reminder_1h:${reservationId}`,
      data: {
        companyId: job.companyId,
        companyName,
        companySlug,
        reservationId,
      },
    })
  }

  if (job.type === 'reservation_review_prompt') {
    if (reservation.status !== 'confirmed') {
      await docSnap.ref.update({ status: 'cancelled', updatedAt: Timestamp.now() })
      return false
    }

    const companyId = job.companyId as string
    const reviewExists = companyId
      ? await db.collection('companies').doc(companyId).collection('reviews').doc(userId).get()
      : null

    if (reviewExists?.exists) {
      await docSnap.ref.update({ status: 'cancelled', updatedAt: Timestamp.now() })
      return false
    }

    await createCustomerNotification(userId, {
      type: 'reservation_review_prompt',
      title: `¿Qué te pareció ${companyName}?`,
      body: 'Cuéntanos tu experiencia y ayuda a otros comensales con una reseña.',
      icon: '⭐',
      actionUrl: companySlug ? `/app/reservas` : '/app/reservas',
      actionLabel: 'Dejar reseña',
      dedupeKey: `reservation_review_prompt:${reservationId}`,
      data: {
        companyId,
        companyName,
        companySlug,
        reservationId,
      },
    })
  }

  await docSnap.ref.update({
    status: 'sent',
    sentAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return true
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function resolveCompanySummary(companyId: string): Promise<{
  companyName: string
  companySlug: string
}> {
  const snap = await adminDb.collection('companies').doc(companyId).get()
  if (!snap.exists) {
    return { companyName: 'Restaurante', companySlug: '' }
  }

  const data = snap.data()!
  return {
    companyName: (data.name as string) ?? 'Restaurante',
    companySlug: (data.slug as string) ?? '',
  }
}

export async function resolvePromotionTitle(
  companyId: string,
  promotionId: string,
): Promise<string> {
  const snap = await adminDb.collection('companies').doc(companyId)
    .collection('promotions').doc(promotionId).get()

  if (!snap.exists) {
    return 'tu premio'
  }

  const title = snap.data()?.title
  return typeof title === 'string' && title.trim() ? title.trim() : 'tu premio'
}
