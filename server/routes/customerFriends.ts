import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import {
  COLLECTIONS,
  friendFavoriteId,
  friendRequestId,
  friendshipId,
} from '../data/collections.ts'
import { createCustomerNotification } from '../notifications/service.ts'

const router = Router()

const LEVELS = [
  { level: 1, title: 'Comensal Aficionado', minXp: 0, maxXp: 299 },
  { level: 2, title: 'Explorador de Sabores', minXp: 300, maxXp: 799 },
  { level: 3, title: 'Gourmet de Barrio', minXp: 800, maxXp: 1599 },
  { level: 4, title: 'Crítico de la Casa', minXp: 1600, maxXp: 3199 },
  { level: 5, title: 'Maestro de Mesa', minXp: 3200, maxXp: 5999 },
  { level: 6, title: 'Embajador Adelia', minXp: 6000, maxXp: 9999 },
  { level: 7, title: 'Leyenda', minXp: 10_000, maxXp: null as number | null },
]

function levelForXp(xp: number) {
  const found = [...LEVELS].reverse().find((item) => xp >= item.minXp) ?? LEVELS[0]
  const span = found.maxXp == null ? 1 : found.maxXp - found.minXp + 1
  const progress = found.maxXp == null ? 1 : Math.min(1, Math.max(0, (xp - found.minXp) / span))
  return { ...found, progress }
}

function gamificationOf(data: FirebaseFirestore.DocumentData | undefined) {
  if (data?.state && typeof data.state === 'object') {
    return data.state as Record<string, unknown>
  }
  if (data?.gamification && typeof data.gamification === 'object') {
    return data.gamification as Record<string, unknown>
  }
  return {}
}

async function mapFriendProfile(uid: string, since?: FirebaseFirestore.Timestamp | null) {
  const [userSnap, statsSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.users).doc(uid).get(),
    adminDb.collection(COLLECTIONS.userGamification).doc(uid).get(),
  ])
  const user = userSnap.data() ?? {}
  const stats = gamificationOf(statsSnap.data() ?? user)
  const xp = typeof stats.xp === 'number' ? stats.xp : typeof user.xp === 'number' ? user.xp : 0
  const level = levelForXp(xp)
  const completed = Array.isArray(stats.completedMissions) ? stats.completedMissions.length : 0
  const weekly = Array.isArray(stats.weeklyCompleted) ? stats.weeklyCompleted.length : 0
  const badges = Array.isArray(stats.completedMissions)
    ? (stats.completedMissions as string[]).slice(0, 12)
    : []

  return {
    id: uid,
    displayName: typeof user.displayName === 'string' ? user.displayName : 'Usuario',
    xp,
    level: level.level,
    levelTitle: level.title,
    levelProgress: level.progress,
    missionsCompleted: completed,
    reservationsTotal: Array.isArray(stats.visitedCompanyIds) ? stats.visitedCompanyIds.length : 0,
    streak: weekly,
    photoUrl: typeof user.photoUrl === 'string' ? user.photoUrl : '',
    homeCountry: typeof user.homeCountry === 'string' ? user.homeCountry : '',
    homeCity: typeof user.homeCity === 'string' ? user.homeCity : '',
    foodPreferences: Array.isArray(user.foodPreferences) ? user.foodPreferences : [],
    badgeIds: badges,
    since: since?.toDate().toISOString() ?? null,
  }
}

router.post('/requests/:targetUid', async (req: Request, res: Response) => {
  try {
    const from = await verifyCustomerUid(req)
    const toUid = String(req.params.targetUid ?? '').trim()
    if (!toUid || toUid === from.uid) {
      res.status(400).json({ error: 'Usuario no válido.' })
      return
    }

    const targetSnap = await adminDb.collection(COLLECTIONS.users).doc(toUid).get()
    if (!targetSnap.exists || targetSnap.data()?.role !== 'customer') {
      res.status(400).json({ error: 'Solo puedes enviar solicitudes a clientes.' })
      return
    }

    const pairId = friendshipId(from.uid, toUid)
    const existingFriend = await adminDb.collection(COLLECTIONS.friendships).doc(pairId).get()
    if (existingFriend.exists) {
      res.status(409).json({ error: 'Ya sois amigos.' })
      return
    }

    const outgoingId = friendRequestId(from.uid, toUid)
    const reverseId = friendRequestId(toUid, from.uid)
    const [outgoingSnap, reverseSnap] = await Promise.all([
      adminDb.collection(COLLECTIONS.friendRequests).doc(outgoingId).get(),
      adminDb.collection(COLLECTIONS.friendRequests).doc(reverseId).get(),
    ])
    if (outgoingSnap.exists) {
      res.status(409).json({ error: 'Ya existe una solicitud pendiente.' })
      return
    }
    if (reverseSnap.exists) {
      res.status(409).json({ error: 'Esa persona ya te envió una solicitud.' })
      return
    }

    const now = Timestamp.now()
    const fromName = typeof from.data.displayName === 'string' ? from.data.displayName : 'Usuario'
    await adminDb.collection(COLLECTIONS.friendRequests).doc(outgoingId).set({
      fromUid: from.uid,
      toUid,
      fromDisplayName: fromName,
      fromPhotoUrl: typeof from.data.photoUrl === 'string' ? from.data.photoUrl : '',
      status: 'pending',
      createdAt: now,
    })

    const targetName = (targetSnap.data()?.displayName as string) ?? 'Usuario'
    await createCustomerNotification(toUid, {
      type: 'friend_request_received',
      title: 'Nueva solicitud de amistad',
      body: `${fromName} quiere ser tu amigo en Adelia.`,
      icon: '👋',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver solicitudes',
      dedupeKey: `friend_request_received:${from.uid}:${toUid}`,
      data: { actorUid: from.uid, actorDisplayName: fromName },
    })
    await createCustomerNotification(from.uid, {
      type: 'friend_request_sent',
      title: 'Solicitud enviada',
      body: `Has enviado una solicitud de amistad a ${targetName}.`,
      icon: '📤',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_sent:${from.uid}:${toUid}`,
      data: { actorUid: toUid, actorDisplayName: targetName },
    })

    res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar la solicitud.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

router.post('/requests/:fromUid/accept', async (req: Request, res: Response) => {
  try {
    const to = await verifyCustomerUid(req)
    const fromUid = String(req.params.fromUid ?? '').trim()
    const requestRef = adminDb.collection(COLLECTIONS.friendRequests).doc(friendRequestId(fromUid, to.uid))
    const requestSnap = await requestRef.get()
    if (!requestSnap.exists || requestSnap.data()?.toUid !== to.uid) {
      res.status(404).json({ error: 'Solicitud no encontrada.' })
      return
    }

    const now = Timestamp.now()
    const pairId = friendshipId(fromUid, to.uid)
    const [low, high] = [fromUid, to.uid].sort()
    const batch = adminDb.batch()
    batch.set(adminDb.collection(COLLECTIONS.friendships).doc(pairId), {
      userLow: low,
      userHigh: high,
      userIds: [fromUid, to.uid],
      createdAt: now,
    })
    batch.delete(requestRef)
    batch.delete(adminDb.collection(COLLECTIONS.friendRequests).doc(friendRequestId(to.uid, fromUid)))
    await batch.commit()

    const fromSnap = await adminDb.collection(COLLECTIONS.users).doc(fromUid).get()
    const fromName = (fromSnap.data()?.displayName as string) ?? 'Usuario'
    const toName = typeof to.data.displayName === 'string' ? to.data.displayName : 'Usuario'

    await createCustomerNotification(fromUid, {
      type: 'friend_request_accepted',
      title: 'Solicitud aceptada',
      body: `${toName} ha aceptado tu solicitud de amistad.`,
      icon: '🤝',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_accepted:${fromUid}:${to.uid}`,
      data: { actorUid: to.uid, actorDisplayName: toName },
    })
    await createCustomerNotification(to.uid, {
      type: 'friend_request_accepted',
      title: '¡Nuevo amigo!',
      body: `Ya eres amigo de ${fromName}.`,
      icon: '🤝',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_accepted:${to.uid}:${fromUid}`,
      data: { actorUid: fromUid, actorDisplayName: fromName },
    })

    res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo aceptar la solicitud.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

router.post('/requests/:fromUid/reject', async (req: Request, res: Response) => {
  try {
    const to = await verifyCustomerUid(req)
    const fromUid = String(req.params.fromUid ?? '').trim()
    const requestRef = adminDb.collection(COLLECTIONS.friendRequests).doc(friendRequestId(fromUid, to.uid))
    const requestSnap = await requestRef.get()
    if (!requestSnap.exists || requestSnap.data()?.toUid !== to.uid) {
      res.status(404).json({ error: 'Solicitud no encontrada.' })
      return
    }
    await requestRef.delete()
    res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo rechazar la solicitud.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

router.delete('/:friendUid', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const friendUid = String(req.params.friendUid ?? '').trim()
    const pairId = friendshipId(user.uid, friendUid)
    await adminDb.collection(COLLECTIONS.friendships).doc(pairId).delete()
    await adminDb.collection(COLLECTIONS.friendFavorites).doc(friendFavoriteId(user.uid, friendUid)).delete()
    await adminDb.collection(COLLECTIONS.friendFavorites).doc(friendFavoriteId(friendUid, user.uid)).delete()
    res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el amigo.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

router.post('/favorites/:friendUid', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const friendUid = String(req.params.friendUid ?? '').trim()
    const pairId = friendshipId(user.uid, friendUid)
    const friendSnap = await adminDb.collection(COLLECTIONS.friendships).doc(pairId).get()
    if (!friendSnap.exists) {
      res.status(404).json({ error: 'Solo puedes marcar favoritos entre amigos.' })
      return
    }
    const favRef = adminDb.collection(COLLECTIONS.friendFavorites).doc(friendFavoriteId(user.uid, friendUid))
    const favSnap = await favRef.get()
    if (favSnap.exists) {
      await favRef.delete()
      res.json({ favorite: false })
      return
    }
    await favRef.set({
      ownerUid: user.uid,
      friendUid,
      createdAt: Timestamp.now(),
    })
    res.json({ favorite: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el favorito.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function searchTokens(value: string): string[] {
  return foldSearchText(value).split(/\s+/).filter(Boolean)
}

function tokenMatchesHaystack(token: string, name: string, email: string, nameParts: string[]): boolean {
  if (!token) {
    return false
  }
  if (name.includes(token) || email.includes(token)) {
    return true
  }
  return nameParts.some((part) => part.startsWith(token) || (part.length >= 3 && token.startsWith(part)))
}

function customerSearchScore(
  data: FirebaseFirestore.DocumentData,
  queryText: string,
): number {
  const name = foldSearchText(typeof data.displayName === 'string' ? data.displayName : '')
  const email = foldSearchText(typeof data.email === 'string' ? data.email : '')
  const localPart = email.split('@')[0] ?? ''
  const nameParts = searchTokens(name)
  const queryParts = searchTokens(queryText)

  if (queryParts.length === 0) {
    return 0
  }
  if (!queryParts.every((token) => tokenMatchesHaystack(token, name, email, nameParts))) {
    return 0
  }
  if (name === queryText || email === queryText) {
    return 100
  }
  if (name.startsWith(queryText) || localPart.startsWith(queryText)) {
    return 80
  }
  if (nameParts.some((part) => part.startsWith(queryParts[0] ?? ''))) {
    return 70
  }
  return 50
}

async function listCustomerUserDocs() {
  const snapshot = await adminDb.collection(COLLECTIONS.users)
    .where('role', '==', 'customer')
    .limit(2000)
    .get()
  return snapshot.docs
}

router.get('/search', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const queryText = foldSearchText(String(req.query.q ?? ''))
    if (queryText.length < 2) {
      res.json({ results: [] })
      return
    }

    const customerDocs = await listCustomerUserDocs()

    const ranked = customerDocs
      .filter((docSnap) => docSnap.id !== user.uid)
      .map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data(),
        score: customerSearchScore(docSnap.data(), queryText),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }
        const leftName = typeof left.data.displayName === 'string' ? left.data.displayName : ''
        const rightName = typeof right.data.displayName === 'string' ? right.data.displayName : ''
        return leftName.localeCompare(rightName, 'es')
      })
      .slice(0, 20)

    const missingNameKey = ranked.filter((entry) => typeof entry.data.displayNameLower !== 'string')
    const toBackfill = missingNameKey.filter((entry) => typeof entry.data.displayName === 'string' && entry.data.displayName)
    if (toBackfill.length > 0) {
      const batch = adminDb.batch()
      for (const entry of toBackfill) {
        batch.set(adminDb.collection(COLLECTIONS.users).doc(entry.id), {
          displayNameLower: String(entry.data.displayName).toLowerCase(),
        }, { merge: true })
      }
      void batch.commit().catch(() => undefined)
    }

    const results = await Promise.all(ranked.map((entry) => mapFriendProfile(entry.id)))
    res.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo buscar.'
    res.status(message.includes('cliente') || message.includes('autorizado') || message.includes('Perfil') ? 401 : 500).json({ error: message })
  }
})

router.get('/state', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const [friendsSnap, incomingSnap, outgoingSnap, favoritesSnap] = await Promise.all([
      adminDb.collection(COLLECTIONS.friendships).where('userIds', 'array-contains', user.uid).get(),
      adminDb.collection(COLLECTIONS.friendRequests).where('toUid', '==', user.uid).where('status', '==', 'pending').get(),
      adminDb.collection(COLLECTIONS.friendRequests).where('fromUid', '==', user.uid).where('status', '==', 'pending').get(),
      adminDb.collection(COLLECTIONS.friendFavorites).where('ownerUid', '==', user.uid).get(),
    ])

    const friendEntries = friendsSnap.docs.map((docSnap) => {
      const data = docSnap.data()
      const other = (data.userIds as string[]).find((id) => id !== user.uid) ?? ''
      return { uid: other, since: data.createdAt as Timestamp | undefined }
    }).filter((entry) => entry.uid)

    const [friends, incoming, outgoing] = await Promise.all([
      Promise.all(friendEntries.map((entry) => mapFriendProfile(entry.uid, entry.since ?? null))),
      Promise.all(incomingSnap.docs.map((docSnap) => mapFriendProfile(String(docSnap.data().fromUid)))),
      Promise.all(outgoingSnap.docs.map((docSnap) => mapFriendProfile(String(docSnap.data().toUid)))),
    ])

    res.json({
      friends,
      incoming,
      outgoing,
      favoriteIds: favoritesSnap.docs.map((docSnap) => String(docSnap.data().friendUid)),
      friendIds: friends.map((item) => item.id),
      incomingRequestIds: incoming.map((item) => item.id),
      outgoingRequestIds: outgoing.map((item) => item.id),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el estado social.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

export default router
