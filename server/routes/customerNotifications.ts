import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { getUserRoleWithRest, verifyIdTokenWithRest } from '../rest-firebase.ts'
import { notifyGamificationChanges } from '../notifications/gamificationEvents.ts'
import { createCustomerNotification } from '../notifications/service.ts'

const router = Router()

async function verifyCustomerUid(req: Request): Promise<string | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return null
  }

  const token = header.slice(7)

  if (canUseAdminSdk) {
    const decoded = await adminAuth.verifyIdToken(token)
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
    if (!userSnap.exists || userSnap.data()?.role !== 'customer') {
      return null
    }
    return decoded.uid
  }

  const decoded = await verifyIdTokenWithRest(token)
  const role = await getUserRoleWithRest(token, decoded.uid)
  if (role !== 'customer') {
    return null
  }

  return decoded.uid
}

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
    actionUrl: data.actionUrl ?? null,
    actionLabel: data.actionLabel ?? null,
    data: data.data ?? {},
    dedupeKey: data.dedupeKey ?? id,
  }
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const uid = await verifyCustomerUid(req)
    if (!uid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    // Felicitación de cumpleaños: el día que toca (hora de España), una vez al año.
    const birthdaySnap = await adminDb.collection('users').doc(uid).get()
    const birthday = birthdaySnap.data()?.birthday
    if (typeof birthday === 'string' && /^\d{2}-\d{2}$/.test(birthday)) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', month: '2-digit', day: '2-digit', year: 'numeric' })
        .format(new Date())
      if (today.slice(5) === birthday) {
        const name = String(birthdaySnap.data()?.displayName ?? '').trim().split(' ')[0]
        await createCustomerNotification(uid, {
          type: 'birthday',
          title: `¡Feliz cumpleaños${name ? `, ${name}` : ''}! 🎂`,
          body: 'Todo el equipo de Adelia te desea un gran día. ¿Lo celebras con una buena mesa?',
          icon: '🎂',
          actionUrl: '/app/explorar',
          actionLabel: 'Buscar sitio',
          dedupeKey: `birthday-${today.slice(0, 4)}`,
        }).catch(() => undefined)
      }
    }

    const limit = Math.max(1, Math.min(Math.trunc(Number(req.query.limit)) || 40, 100))
    const snapshot = await adminDb.collection('users').doc(uid)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const notifications = snapshot.docs.map((docSnap) => mapNotificationDoc(docSnap.id, docSnap.data()))

    const userSnap = await adminDb.collection('users').doc(uid).get()
    const unreadCount = typeof userSnap.data()?.notificationUnreadCount === 'number'
      ? userSnap.data()?.notificationUnreadCount as number
      : notifications.filter((item) => !item.read).length

    res.json({ notifications, unreadCount })
  } catch (error) {
    console.error('List notifications error:', error)
    res.status(500).json({ error: 'No se pudieron cargar las notificaciones.' })
  }
})

router.patch('/:notificationId/read', async (req: Request, res: Response) => {
  try {
    const uid = await verifyCustomerUid(req)
    if (!uid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const notificationId = String(req.params.notificationId ?? '').trim()
    if (!/^[A-Za-z0-9_-]{1,240}$/.test(notificationId)) {
      res.status(400).json({ error: 'Notificación no válida.' })
      return
    }

    const userRef = adminDb.collection('users').doc(uid)
    const ref = userRef.collection('notifications').doc(notificationId)
    // En una transacción: dos clics a la vez no restan dos veces del contador.
    const found = await adminDb.runTransaction(async (transaction) => {
      const [snap, userSnap] = await Promise.all([transaction.get(ref), transaction.get(userRef)])
      if (!snap.exists) {
        return false
      }
      if (snap.data()?.read !== true) {
        const currentUnread = typeof userSnap.data()?.notificationUnreadCount === 'number'
          ? userSnap.data()?.notificationUnreadCount as number
          : 0
        transaction.update(ref, { read: true, readAt: Timestamp.now() })
        transaction.set(userRef, { notificationUnreadCount: Math.max(0, currentUnread - 1) }, { merge: true })
      }
      return true
    })
    if (!found) {
      res.status(404).json({ error: 'Notificación no encontrada.' })
      return
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ error: 'No se pudo marcar la notificación.' })
  }
})

router.post('/gamification-sync', async (req: Request, res: Response) => {
  try {
    const uid = await verifyCustomerUid(req)
    if (!uid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const beforeGamification = req.body?.beforeGamification
    const userSnap = await adminDb.collection('users').doc(uid).get()
    if (!userSnap.exists) {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }

    const statsSnap = await adminDb.collection('userGamification').doc(uid).get()
    const afterState = statsSnap.data()?.state && typeof statsSnap.data()?.state === 'object'
      ? statsSnap.data()?.state as FirebaseFirestore.DocumentData
      : userSnap.data()?.gamification

    await notifyGamificationChanges(
      uid,
      beforeGamification && typeof beforeGamification === 'object'
        ? { gamification: beforeGamification as FirebaseFirestore.DocumentData }
        : { gamification: afterState ?? {} },
      { gamification: afterState ?? {} },
    )

    res.json({ ok: true })
  } catch (error) {
    console.error('Gamification notification sync error:', error)
    res.status(500).json({ error: 'No se pudieron sincronizar las notificaciones.' })
  }
})

router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const uid = await verifyCustomerUid(req)
    if (!uid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const snapshot = await adminDb.collection('users').doc(uid)
      .collection('notifications')
      .where('read', '==', false)
      .limit(200)
      .get()

    const batch = adminDb.batch()
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        read: true,
        readAt: Timestamp.now(),
      })
    })
    await batch.commit()

    await adminDb.collection('users').doc(uid).set({
      notificationUnreadCount: 0,
    }, { merge: true })

    res.json({ ok: true, marked: snapshot.size })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({ error: 'No se pudieron marcar las notificaciones.' })
  }
})

export default router
