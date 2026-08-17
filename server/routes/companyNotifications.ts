import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { verifyCompanyAccount } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import {
  companyGamificationRef,
  companyNotificationsRef,
} from '../notifications/companyNotifications.ts'

const router = Router()

function mapNotificationDoc(id: string, data: FirebaseFirestore.DocumentData) {
  const createdAt = data.createdAt instanceof Timestamp
    ? data.createdAt.toDate().toISOString()
    : new Date().toISOString()
  const readAt = data.readAt instanceof Timestamp
    ? data.readAt.toDate().toISOString()
    : null

  return {
    id,
    type: data.type,
    title: data.title,
    body: data.body,
    icon: data.icon ?? '🔔',
    read: data.read === true,
    readAt,
    createdAt,
    actionTab: typeof data.actionTab === 'string' ? data.actionTab : 'compite-missions',
    actionLabel: data.actionLabel ?? null,
    data: data.data ?? {},
    dedupeKey: data.dedupeKey ?? id,
  }
}

router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const snapshot = await companyNotificationsRef(account.companyId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    const statsSnap = await companyGamificationRef(account.companyId).get()
    const unreadCount = typeof statsSnap.data()?.unreadCount === 'number'
      ? statsSnap.data()?.unreadCount as number
      : snapshot.docs.filter((docSnap) => docSnap.data().read !== true).length

    res.json({
      notifications: snapshot.docs.map((docSnap) => mapNotificationDoc(docSnap.id, docSnap.data())),
      unreadCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las notificaciones.'
    res.status(message.includes('sesión') ? 401 : 500).json({ error: message })
  }
})

router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const notificationRef = companyNotificationsRef(account.companyId).doc(String(req.params.id))
    const snap = await notificationRef.get()
    if (!snap.exists) {
      res.status(404).json({ error: 'Notificación no encontrada.' })
      return
    }
    if (snap.data()?.read !== true) {
      await notificationRef.update({
        read: true,
        readAt: Timestamp.now(),
      })
      await companyGamificationRef(account.companyId).set({
        unreadCount: FieldValue.increment(-1),
      }, { merge: true })
    }
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo marcar como leída.'
    res.status(message.includes('sesión') ? 401 : 500).json({ error: message })
  }
})

router.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const snapshot = await companyNotificationsRef(account.companyId)
      .where('read', '==', false)
      .limit(100)
      .get()
    const now = Timestamp.now()
    const batch = snapshot.docs.length > 0 ? adminDb.batch() : null
    if (batch) {
      for (const docSnap of snapshot.docs) {
        batch.update(docSnap.ref, { read: true, readAt: now })
      }
      batch.set(companyGamificationRef(account.companyId), { unreadCount: 0 }, { merge: true })
      await batch.commit()
    } else {
      await companyGamificationRef(account.companyId).set({ unreadCount: 0 }, { merge: true })
    }
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron marcar como leídas.'
    res.status(message.includes('sesión') ? 401 : 500).json({ error: message })
  }
})

export default router
