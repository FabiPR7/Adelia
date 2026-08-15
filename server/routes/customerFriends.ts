import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { getUserRoleWithRest, verifyIdTokenWithRest } from '../rest-firebase.ts'
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

function friendRequestRef(toUid: string, fromUid: string) {
  return adminDb.collection('users').doc(toUid).collection('friendRequests').doc(fromUid)
}

function friendRef(uid: string, friendUid: string) {
  return adminDb.collection('users').doc(uid).collection('friends').doc(friendUid)
}

router.post('/requests/:targetUid', async (req: Request, res: Response) => {
  try {
    const fromUid = await verifyCustomerUid(req)
    if (!fromUid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const targetUid = String(req.params.targetUid ?? '').trim()
    if (!targetUid || targetUid === fromUid) {
      res.status(400).json({ error: 'Usuario no válido.' })
      return
    }

    const [fromSnap, targetSnap] = await Promise.all([
      adminDb.collection('users').doc(fromUid).get(),
      adminDb.collection('users').doc(targetUid).get(),
    ])

    if (!fromSnap.exists || !targetSnap.exists) {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }

    if (targetSnap.data()?.role !== 'customer') {
      res.status(400).json({ error: 'Solo puedes enviar solicitudes a clientes.' })
      return
    }

    const alreadyFriends = await friendRef(fromUid, targetUid).get()
    if (alreadyFriends.exists) {
      res.status(409).json({ error: 'Ya sois amigos.' })
      return
    }

    const existingOutgoing = await friendRequestRef(targetUid, fromUid).get()
    if (existingOutgoing.exists) {
      res.status(409).json({ error: 'Ya existe una solicitud pendiente.' })
      return
    }

    const reverseRequest = await friendRequestRef(fromUid, targetUid).get()
    if (reverseRequest.exists) {
      res.status(409).json({ error: 'Esa persona ya te envió una solicitud.' })
      return
    }

    const fromData = fromSnap.data()!
    const now = Timestamp.now()

    await friendRequestRef(targetUid, fromUid).set({
      fromUid,
      toUid: targetUid,
      fromDisplayName: fromData.displayName ?? 'Usuario',
      fromPhotoUrl: fromData.photoUrl ?? '',
      status: 'pending',
      createdAt: now,
    })

    await adminDb.collection('users').doc(fromUid)
      .collection('outgoingFriendRequests').doc(targetUid).set({
        toUid: targetUid,
        createdAt: now,
      })

    const targetName = (targetSnap.data()?.displayName as string) ?? 'Usuario'

    await createCustomerNotification(targetUid, {
      type: 'friend_request_received',
      title: 'Nueva solicitud de amistad',
      body: `${fromData.displayName ?? 'Alguien'} quiere ser tu amigo en Adelia.`,
      icon: '👋',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver solicitudes',
      dedupeKey: `friend_request_received:${fromUid}:${targetUid}`,
      data: {
        actorUid: fromUid,
        actorDisplayName: fromData.displayName ?? 'Usuario',
        actorPhotoUrl: fromData.photoUrl ?? '',
      },
    })

    await createCustomerNotification(fromUid, {
      type: 'friend_request_sent',
      title: 'Solicitud enviada',
      body: `Has enviado una solicitud de amistad a ${targetName}.`,
      icon: '📤',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_sent:${fromUid}:${targetUid}`,
      data: {
        actorUid: targetUid,
        actorDisplayName: targetName,
        actorPhotoUrl: (targetSnap.data()?.photoUrl as string) ?? '',
      },
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Send friend request error:', error)
    res.status(500).json({ error: 'No se pudo enviar la solicitud.' })
  }
})

router.post('/requests/:fromUid/accept', async (req: Request, res: Response) => {
  try {
    const toUid = await verifyCustomerUid(req)
    if (!toUid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const fromUid = String(req.params.fromUid ?? '').trim()
    if (!fromUid) {
      res.status(400).json({ error: 'Solicitud no válida.' })
      return
    }

    const requestRef = friendRequestRef(toUid, fromUid)
    const requestSnap = await requestRef.get()
    if (!requestSnap.exists) {
      res.status(404).json({ error: 'Solicitud no encontrada.' })
      return
    }

    const [fromSnap, toSnap] = await Promise.all([
      adminDb.collection('users').doc(fromUid).get(),
      adminDb.collection('users').doc(toUid).get(),
    ])

    if (!fromSnap.exists || !toSnap.exists) {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }

    const now = Timestamp.now()
    const batch = adminDb.batch()

    batch.set(friendRef(fromUid, toUid), {
      friendUid: toUid,
      displayName: toSnap.data()?.displayName ?? 'Usuario',
      photoUrl: toSnap.data()?.photoUrl ?? '',
      since: now,
    })
    batch.set(friendRef(toUid, fromUid), {
      friendUid: fromUid,
      displayName: fromSnap.data()?.displayName ?? 'Usuario',
      photoUrl: fromSnap.data()?.photoUrl ?? '',
      since: now,
    })
    batch.delete(requestRef)
    batch.delete(adminDb.collection('users').doc(fromUid).collection('outgoingFriendRequests').doc(toUid))

    await batch.commit()

    await createCustomerNotification(fromUid, {
      type: 'friend_request_accepted',
      title: 'Solicitud aceptada',
      body: `${toSnap.data()?.displayName ?? 'Alguien'} ha aceptado tu solicitud de amistad.`,
      icon: '🤝',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_accepted:${fromUid}:${toUid}`,
      data: {
        actorUid: toUid,
        actorDisplayName: toSnap.data()?.displayName ?? 'Usuario',
        actorPhotoUrl: toSnap.data()?.photoUrl ?? '',
      },
    })

    await createCustomerNotification(toUid, {
      type: 'friend_request_accepted',
      title: '¡Nuevo amigo!',
      body: `Ya eres amigo de ${fromSnap.data()?.displayName ?? 'Usuario'}.`,
      icon: '🤝',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_accepted:${toUid}:${fromUid}`,
      data: {
        actorUid: fromUid,
        actorDisplayName: fromSnap.data()?.displayName ?? 'Usuario',
        actorPhotoUrl: fromSnap.data()?.photoUrl ?? '',
      },
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Accept friend request error:', error)
    res.status(500).json({ error: 'No se pudo aceptar la solicitud.' })
  }
})

router.post('/requests/:fromUid/reject', async (req: Request, res: Response) => {
  try {
    const toUid = await verifyCustomerUid(req)
    if (!toUid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const fromUid = String(req.params.fromUid ?? '').trim()
    const requestRef = friendRequestRef(toUid, fromUid)
    const requestSnap = await requestRef.get()
    if (!requestSnap.exists) {
      res.status(404).json({ error: 'Solicitud no encontrada.' })
      return
    }

    await requestRef.delete()
    await adminDb.collection('users').doc(fromUid)
      .collection('outgoingFriendRequests').doc(toUid).delete()

    res.json({ ok: true })
  } catch (error) {
    console.error('Reject friend request error:', error)
    res.status(500).json({ error: 'No se pudo rechazar la solicitud.' })
  }
})

router.get('/state', async (req: Request, res: Response) => {
  try {
    const uid = await verifyCustomerUid(req)
    if (!uid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const [friendsSnap, incomingSnap, outgoingSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).collection('friends').get(),
      adminDb.collection('users').doc(uid).collection('friendRequests').get(),
      adminDb.collection('users').doc(uid).collection('outgoingFriendRequests').get(),
    ])

    res.json({
      friendIds: friendsSnap.docs.map((doc) => doc.id),
      incomingRequestIds: incomingSnap.docs.map((doc) => doc.id),
      outgoingRequestIds: outgoingSnap.docs.map((doc) => doc.id),
    })
  } catch (error) {
    console.error('Get friends state error:', error)
    res.status(500).json({ error: 'No se pudo cargar el estado social.' })
  }
})

export default router
