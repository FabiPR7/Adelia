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
import { getLevelDetailsForXp } from '../data/gameCatalog.ts'
import { findUidsByUsernamePrefix, normalizeUsername } from '../data/usernames.ts'
import {
  MAX_BLOCKS_PER_USER,
  isBlockedEitherWay,
  listBlockedByMe,
  listBlockedEitherWay,
  userBlockId,
} from '../data/userBlocks.ts'
import { takeUserBlockChange } from '../security/rateLimit.ts'

const router = Router()


function gamificationOf(data: FirebaseFirestore.DocumentData | undefined) {
  if (data?.state && typeof data.state === 'object') {
    return data.state as Record<string, unknown>
  }
  if (data?.gamification && typeof data.gamification === 'object') {
    return data.gamification as Record<string, unknown>
  }
  return {}
}

async function mapFriendProfile(
  uid: string,
  since?: FirebaseFirestore.Timestamp | null,
  knownUser?: FirebaseFirestore.DocumentData,
  knownStats?: FirebaseFirestore.DocumentData | null,
) {
  const [userSnap, statsSnap] = await Promise.all([
    knownUser
      ? Promise.resolve(null)
      : adminDb.collection(COLLECTIONS.users).doc(uid).get(),
    knownStats !== undefined
      ? Promise.resolve(null)
      : adminDb.collection(COLLECTIONS.userGamification).doc(uid).get(),
  ])
  const user = knownUser ?? userSnap?.data() ?? {}
  const stats = gamificationOf(knownStats ?? statsSnap?.data() ?? user)
  const xp = typeof stats.xp === 'number' ? stats.xp : typeof user.xp === 'number' ? user.xp : 0
  const level = await getLevelDetailsForXp(xp)
  const completed = Array.isArray(stats.completedMissions) ? stats.completedMissions.length : 0
  const weekly = Array.isArray(stats.weeklyCompleted) ? stats.weeklyCompleted.length : 0
  const badges = Array.isArray(stats.completedMissions)
    ? (stats.completedMissions as string[]).filter((id) => typeof id === 'string').slice(0, 120)
    : []

  return {
    id: uid,
    displayName: typeof user.displayName === 'string' ? user.displayName : 'Usuario',
    username: typeof user.username === 'string' ? user.username : '',
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

async function mapFriendProfiles(
  entries: Array<{ uid: string; since?: FirebaseFirestore.Timestamp | null }>,
) {
  const unique = [...new Set(entries.map((entry) => entry.uid).filter(Boolean))]
  if (unique.length === 0) {
    return [] as Awaited<ReturnType<typeof mapFriendProfile>>[]
  }

  const userRefs = unique.map((uid) => adminDb.collection(COLLECTIONS.users).doc(uid))
  const statsRefs = unique.map((uid) => adminDb.collection(COLLECTIONS.userGamification).doc(uid))
  const [userSnaps, statsSnaps] = await Promise.all([
    adminDb.getAll(...userRefs),
    adminDb.getAll(...statsRefs),
  ])
  const usersById = new Map(userSnaps.map((snap) => [snap.id, snap.data()]))
  const statsById = new Map(statsSnaps.map((snap) => [snap.id, snap.data() ?? null]))

  return Promise.all(
    entries
      .filter((entry) => entry.uid)
      .map((entry) => mapFriendProfile(
        entry.uid,
        entry.since ?? null,
        usersById.get(entry.uid),
        statsById.get(entry.uid) ?? null,
      )),
  )
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

    if (await isBlockedEitherWay(from.uid, toUid)) {
      res.status(403).json({ error: 'No puedes enviar una solicitud a esta persona.' })
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
      actionUrl: '/app/misiones?ver=solicitudes',
      actionLabel: 'Ver solicitudes',
      // Con la hora de la solicitud: si fuisteis amigos antes, el aviso viejo no tapa el nuevo.
      dedupeKey: `friend_request_received:${from.uid}:${toUid}:${now.toMillis()}`,
      data: { actorUid: from.uid, actorDisplayName: fromName },
    })
    await createCustomerNotification(from.uid, {
      type: 'friend_request_sent',
      title: 'Solicitud enviada',
      body: `Has enviado una solicitud de amistad a ${targetName}.`,
      icon: '📤',
      actionUrl: '/app/misiones?ver=amigos',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_sent:${from.uid}:${toUid}:${now.toMillis()}`,
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
    if (await isBlockedEitherWay(fromUid, to.uid)) {
      await requestRef.delete()
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
      actionUrl: '/app/misiones?ver=amigos',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_accepted:${fromUid}:${to.uid}:${now.toMillis()}`,
      data: { actorUid: to.uid, actorDisplayName: toName },
    })
    await createCustomerNotification(to.uid, {
      type: 'friend_request_accepted',
      title: '¡Nuevo amigo!',
      body: `Ya eres amigo de ${fromName}.`,
      icon: '🤝',
      actionUrl: '/app/misiones?ver=amigos',
      actionLabel: 'Ver amigos',
      dedupeKey: `friend_request_accepted:${to.uid}:${fromUid}:${now.toMillis()}`,
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

function tokenMatchesHaystack(token: string, name: string, nameParts: string[]): boolean {
  if (!token) {
    return false
  }
  if (name.includes(token)) {
    return true
  }
  return nameParts.some((part) => part.startsWith(token) || (part.length >= 3 && token.startsWith(part)))
}

function customerSearchScore(
  data: FirebaseFirestore.DocumentData,
  queryText: string,
): number {
  const name = foldSearchText(typeof data.displayName === 'string' ? data.displayName : '')
  const nameParts = searchTokens(name)
  const queryParts = searchTokens(queryText)

  if (queryParts.length === 0) {
    return 0
  }
  if (!queryParts.every((token) => tokenMatchesHaystack(token, name, nameParts))) {
    return 0
  }
  if (name === queryText) {
    return 100
  }
  if (name.startsWith(queryText)) {
    return 80
  }
  if (nameParts.some((part) => part.startsWith(queryParts[0] ?? ''))) {
    return 70
  }
  return 50
}

function usernameSearchScore(data: FirebaseFirestore.DocumentData, query: string): number {
  const username = typeof data.username === 'string' ? data.username : ''
  if (!username || query.length < 2) return 0
  if (username === query) return 110
  return username.startsWith(query) ? 90 : 0
}

async function listCustomerUserDocs(queryText: string, rawLower: string) {
  const prefixes = [...new Set([queryText, rawLower].filter((item) => item.length >= 3))]
  const prefixSnaps = await Promise.all(
    prefixes.map((prefix) =>
      adminDb.collection(COLLECTIONS.users)
        .where('role', '==', 'customer')
        .where('displayNameLower', '>=', prefix)
        .where('displayNameLower', '<=', `${prefix}\uf8ff`)
        .limit(20)
        .get()
        .catch(() => null),
    ),
  )

  const byId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  for (const snap of prefixSnaps) {
    snap?.docs.forEach((docSnap) => byId.set(docSnap.id, docSnap))
  }
  // Sin prefijo indexado no listamos clientes al azar: eso filtraba en memoria
  // sobre 60 docs y permitía enumerar usuarios con consultas cortas.
  return [...byId.values()]
}

router.get('/search', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const rawQuery = String(req.query.q ?? '').trim().slice(0, 40)
    const rawLower = rawQuery.toLowerCase()
    const queryText = foldSearchText(rawQuery)
    if (queryText.length < 3) {
      res.json({ results: [] })
      return
    }

    // «@ana» busca solo por @usuario; sin @, por nombre y por @usuario.
    const byUsernameOnly = rawQuery.startsWith('@')
    const usernameQuery = normalizeUsername(rawQuery)
    const [nameDocs, usernameUids] = await Promise.all([
      byUsernameOnly ? Promise.resolve([]) : listCustomerUserDocs(queryText, rawLower),
      findUidsByUsernamePrefix(usernameQuery).catch(() => [] as string[]),
    ])
    const known = new Set(nameDocs.map((docSnap) => docSnap.id))
    const extraRefs = usernameUids.filter((uid) => !known.has(uid))
      .map((uid) => adminDb.collection(COLLECTIONS.users).doc(uid))
    const usernameDocs = extraRefs.length
      ? (await adminDb.getAll(...extraRefs)).filter((docSnap) => docSnap.exists && docSnap.data()?.role === 'customer') as FirebaseFirestore.QueryDocumentSnapshot[]
      : []
    const customerDocs = [...nameDocs, ...usernameDocs]
    const blocked = await listBlockedEitherWay(user.uid)

    const ranked = customerDocs
      // Una cuenta bloqueada no sale en la búsqueda.
      .filter((docSnap) => docSnap.id !== user.uid && docSnap.data().blocked !== true && !blocked.has(docSnap.id))
      .map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data(),
        score: Math.max(
          byUsernameOnly ? 0 : customerSearchScore(docSnap.data(), queryText),
          usernameSearchScore(docSnap.data(), usernameQuery),
        ),
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

    const results = await Promise.all(
      ranked.map((entry) => mapFriendProfile(entry.id, null, entry.data)),
    )
    res.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo buscar.'
    res.status(message.includes('cliente') || message.includes('autorizado') || message.includes('Perfil') ? 401 : 500).json({ error: message })
  }
})

/**
 * «Tus amigos han ido»: restaurantes donde han estado tus amigos (los que
 * tienen en `visitedCompanyIds`). Quien activa «hideVisitsFromFriends» no sale.
 */
router.get('/visits', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const friendsSnap = await adminDb.collection(COLLECTIONS.friendships).where('userIds', 'array-contains', user.uid).limit(80).get()
    const friendUids = [...new Set(friendsSnap.docs
      .map((docSnap) => (docSnap.data().userIds as string[]).find((id) => id !== user.uid) ?? '')
      .filter(Boolean))].slice(0, 60)
    if (friendUids.length === 0) {
      res.json({ restaurants: [] })
      return
    }
    const [userSnaps, statsSnaps] = await Promise.all([
      adminDb.getAll(...friendUids.map((uid) => adminDb.collection(COLLECTIONS.users).doc(uid))),
      adminDb.getAll(...friendUids.map((uid) => adminDb.collection(COLLECTIONS.userGamification).doc(uid))),
    ])
    const byCompany = new Map<string, Array<{ id: string; name: string; photoUrl: string }>>()
    friendUids.forEach((uid, index) => {
      const profile = userSnaps[index]?.data() ?? {}
      if (profile.hideVisitsFromFriends === true) return
      const stats = gamificationOf(statsSnaps[index]?.data() ?? profile)
      const visited = Array.isArray(stats.visitedCompanyIds) ? (stats.visitedCompanyIds as unknown[]) : []
      const friend = {
        id: uid,
        name: typeof profile.displayName === 'string' ? profile.displayName : 'Tu amigo',
        photoUrl: typeof profile.photoUrl === 'string' ? profile.photoUrl : '',
      }
      for (const companyId of visited) {
        if (typeof companyId !== 'string' || !companyId) continue
        const list = byCompany.get(companyId) ?? []
        list.push(friend)
        byCompany.set(companyId, list)
      }
    })
    const companyIds = [...byCompany.keys()]
      .sort((a, b) => (byCompany.get(b)?.length ?? 0) - (byCompany.get(a)?.length ?? 0))
      .slice(0, 30)
    if (companyIds.length === 0) {
      res.json({ restaurants: [] })
      return
    }
    const indexSnaps = await adminDb.getAll(...companyIds.map((id) => adminDb.collection(COLLECTIONS.restaurantIndex).doc(id)))
    const restaurants = indexSnaps
      .filter((snap) => snap.exists && snap.data()?.deactivated !== true && typeof snap.data()?.slug === 'string')
      .map((snap) => {
        const data = snap.data() ?? {}
        const photos = Array.isArray(data.photos) ? data.photos.filter((item: unknown) => typeof item === 'string') : []
        return {
          companyId: snap.id,
          slug: String(data.slug),
          name: typeof data.name === 'string' ? data.name : '',
          municipality: typeof data.municipality === 'string' ? data.municipality : '',
          photoUrl: typeof data.photoUrl === 'string' && data.photoUrl ? data.photoUrl : (photos[0] ?? ''),
          friends: (byCompany.get(snap.id) ?? []).slice(0, 8),
          friendCount: byCompany.get(snap.id)?.length ?? 0,
        }
      })
      .slice(0, 12)
    res.json({ restaurants })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

router.get('/state', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const [friendsSnap, incomingSnap, outgoingSnap, favoritesSnap, blockedIds] = await Promise.all([
      adminDb.collection(COLLECTIONS.friendships).where('userIds', 'array-contains', user.uid).limit(80).get(),
      adminDb.collection(COLLECTIONS.friendRequests).where('toUid', '==', user.uid).where('status', '==', 'pending').limit(40).get(),
      adminDb.collection(COLLECTIONS.friendRequests).where('fromUid', '==', user.uid).where('status', '==', 'pending').limit(40).get(),
      adminDb.collection(COLLECTIONS.friendFavorites).where('ownerUid', '==', user.uid).limit(40).get(),
      listBlockedByMe(user.uid),
    ])

    const friendEntries = friendsSnap.docs.map((docSnap) => {
      const data = docSnap.data()
      const other = (data.userIds as string[]).find((id) => id !== user.uid) ?? ''
      return { uid: other, since: data.createdAt as Timestamp | undefined }
    }).filter((entry) => entry.uid).slice(0, 40)

    const [friends, incoming, outgoing, blockedProfiles] = await Promise.all([
      mapFriendProfiles(friendEntries),
      mapFriendProfiles(
        incomingSnap.docs.slice(0, 20).map((docSnap) => ({ uid: String(docSnap.data().fromUid) })),
      ),
      mapFriendProfiles(
        outgoingSnap.docs.slice(0, 20).map((docSnap) => ({ uid: String(docSnap.data().toUid) })),
      ),
      mapFriendProfiles(blockedIds.slice(0, 50).map((uid) => ({ uid }))),
    ])

    res.json({
      friends,
      incoming,
      outgoing,
      favoriteIds: favoritesSnap.docs.map((docSnap) => String(docSnap.data().friendUid)),
      friendIds: friends.map((item) => item.id),
      incomingRequestIds: incoming.map((item) => item.id),
      outgoingRequestIds: outgoing.map((item) => item.id),
      blocked: blockedProfiles,
      blockedIds,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el estado social.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

/**
 * Bloquear a alguien: se rompe la amistad, se borran las solicitudes y favoritos
 * entre los dos y ya no os podéis buscar, invitar ni retar. Sus reseñas dejan de
 * salirte. La otra persona no recibe ningún aviso.
 */
router.post('/blocks/:targetUid', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const targetUid = String(req.params.targetUid ?? '').trim()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(targetUid) || targetUid === user.uid) {
      res.status(400).json({ error: 'Usuario no válido.' })
      return
    }
    const targetSnap = await adminDb.collection(COLLECTIONS.users).doc(targetUid).get()
    if (!targetSnap.exists || targetSnap.data()?.role !== 'customer') {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }
    if ((await listBlockedByMe(user.uid)).length >= MAX_BLOCKS_PER_USER) {
      res.status(400).json({ error: 'Has llegado al máximo de usuarios bloqueados.' })
      return
    }
    if (!(await takeUserBlockChange(user.uid))) {
      res.status(429).json({ error: 'Demasiados cambios hoy. Inténtalo mañana.' })
      return
    }

    const batch = adminDb.batch()
    batch.set(adminDb.collection(COLLECTIONS.userBlocks).doc(userBlockId(user.uid, targetUid)), {
      blockerUid: user.uid,
      blockedUid: targetUid,
      createdAt: Timestamp.now(),
    })
    batch.delete(adminDb.collection(COLLECTIONS.friendships).doc(friendshipId(user.uid, targetUid)))
    batch.delete(adminDb.collection(COLLECTIONS.friendRequests).doc(friendRequestId(user.uid, targetUid)))
    batch.delete(adminDb.collection(COLLECTIONS.friendRequests).doc(friendRequestId(targetUid, user.uid)))
    batch.delete(adminDb.collection(COLLECTIONS.friendFavorites).doc(friendFavoriteId(user.uid, targetUid)))
    batch.delete(adminDb.collection(COLLECTIONS.friendFavorites).doc(friendFavoriteId(targetUid, user.uid)))
    await batch.commit()
    res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo bloquear.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message.includes('cliente') ? message : 'No se pudo bloquear.' })
  }
})

router.delete('/blocks/:targetUid', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const targetUid = String(req.params.targetUid ?? '').trim()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(targetUid)) {
      res.status(400).json({ error: 'Usuario no válido.' })
      return
    }
    if (!(await takeUserBlockChange(user.uid))) {
      res.status(429).json({ error: 'Demasiados cambios hoy. Inténtalo mañana.' })
      return
    }
    await adminDb.collection(COLLECTIONS.userBlocks).doc(userBlockId(user.uid, targetUid)).delete()
    res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo desbloquear.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message.includes('cliente') ? message : 'No se pudo desbloquear.' })
  }
})

export default router
