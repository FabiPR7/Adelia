import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS, reservationInviteId } from '../data/collections.ts'
import { createCustomerNotification } from '../notifications/service.ts'
import {
  createThreeCardsGame,
  forfeitThreeCards,
  parseThreeCardsGame,
  pickThreeCardsDeck,
  pickThreeCardsFinalCard,
  removeThreeCardsCard,
  sanitizeThreeCardsForUser,
  tickThreeCards,
  type ThreeCardsGame,
} from './threeCardsGame.ts'
import {
  createOddsEvensGame,
  forfeitOddsEvens,
  parseOddsEvensGame,
  pickOddsEvensNumber,
  pickOddsEvensSide,
  sanitizeOddsEvensForUser,
  serializeOddsEvensGame,
  tickOddsEvens,
  type OddsEvensGame,
  type OddsEvensSide,
} from './oddsEvensGame.ts'
import {
  createStopwatchGame,
  forfeitStopwatch,
  parseStopwatchGame,
  serializeStopwatchGame,
  startStopwatch,
  stopStopwatch,
  tickStopwatch,
  sanitizeStopwatchForUser,
  type StopwatchGame,
} from './stopwatchGame.ts'
import {
  createMazeGame,
  forfeitMaze,
  moveMaze,
  parseMazeGame,
  sanitizeMazeForUser,
  serializeMazeGame,
  tickMaze,
  type MazeDirection,
  type MazeGame,
} from './mazeGame.ts'
import {
  createHotColdGame,
  forfeitHotCold,
  parseHotColdGame,
  pickHotColdNumber,
  sanitizeHotColdForUser,
  serializeHotColdGame,
  tickHotCold,
  type HotColdGame,
} from './hotColdGame.ts'

export const CHALLENGE_MINIGAME_IDS = ['three_cards', 'odds_evens', 'stopwatch', 'maze', 'hot_cold'] as const
export type ChallengeMinigameId = (typeof CHALLENGE_MINIGAME_IDS)[number]
export type ChallengeStatus = 'ringing' | 'active' | 'resolved' | 'declined' | 'cancelled'

export interface ReservationChallengeRecord {
  id: string
  reservationId: string
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  startTime: string
  pax: number
  challengerUid: string
  challengerDisplayName: string
  challengerPhotoUrl: string
  challengedUid: string
  challengedDisplayName: string
  challengedPhotoUrl: string
  minigameId: ChallengeMinigameId
  status: ChallengeStatus
  winnerUid: string | null
  resultAckedUids: string[]
  createdAt: string
  updatedAt: string
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString()
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
  }
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      const converted = (value as { toDate: () => Date }).toDate()
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted.toISOString()
      }
    } catch {
      // ignore detached Timestamp
    }
  }
  return new Date().toISOString()
}

function asMinigameId(value: unknown): ChallengeMinigameId {
  return CHALLENGE_MINIGAME_IDS.includes(value as ChallengeMinigameId)
    ? value as ChallengeMinigameId
    : 'three_cards'
}

function asStatus(value: unknown): ChallengeStatus {
  if (
    value === 'ringing'
    || value === 'active'
    || value === 'resolved'
    || value === 'declined'
    || value === 'cancelled'
  ) {
    return value
  }
  return 'ringing'
}

function pickRandomMinigame(): ChallengeMinigameId {
  const bytes = new Uint32Array(1)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    bytes[0] = Math.floor(Math.random() * 0xffffffff)
  }
  const index = (bytes[0] ?? 0) % CHALLENGE_MINIGAME_IDS.length
  return CHALLENGE_MINIGAME_IDS[index] ?? 'three_cards'
}

export type PublicReservationChallenge = ReservationChallengeRecord & {
  threeCards: ReturnType<typeof sanitizeThreeCardsForUser> | null
  oddsEvens: ReturnType<typeof sanitizeOddsEvensForUser> | null
  stopwatch: ReturnType<typeof sanitizeStopwatchForUser> | null
  maze: ReturnType<typeof sanitizeMazeForUser> | null
  hotCold: ReturnType<typeof sanitizeHotColdForUser> | null
}

function threeCardsSecretRef(challengeId: string) {
  return adminDb
    .collection(COLLECTIONS.reservationChallenges)
    .doc(challengeId)
    .collection('secret')
    .doc('threeCards')
}

function oddsEvensSecretRef(challengeId: string) {
  return adminDb
    .collection(COLLECTIONS.reservationChallenges)
    .doc(challengeId)
    .collection('secret')
    .doc('oddsEvens')
}

function stopwatchSecretRef(challengeId: string) {
  return adminDb
    .collection(COLLECTIONS.reservationChallenges)
    .doc(challengeId)
    .collection('secret')
    .doc('stopwatch')
}

function mazeSecretRef(challengeId: string) {
  return adminDb
    .collection(COLLECTIONS.reservationChallenges)
    .doc(challengeId)
    .collection('secret')
    .doc('maze')
}

function hotColdSecretRef(challengeId: string) {
  return adminDb
    .collection(COLLECTIONS.reservationChallenges)
    .doc(challengeId)
    .collection('secret')
    .doc('hotCold')
}

function asPublicChallenge(
  challenge: ReservationChallengeRecord,
  uid: string,
  live: {
    threeCards?: ThreeCardsGame | null
    oddsEvens?: OddsEvensGame | null
    stopwatch?: StopwatchGame | null
    maze?: MazeGame | null
    hotCold?: HotColdGame | null
  } | null = null,
): PublicReservationChallenge {
  try {
    return {
      ...challenge,
      threeCards: live?.threeCards && challenge.minigameId === 'three_cards'
        ? sanitizeThreeCardsForUser(live.threeCards, uid)
        : null,
      oddsEvens: live?.oddsEvens && challenge.minigameId === 'odds_evens'
        ? sanitizeOddsEvensForUser(live.oddsEvens, uid)
        : null,
      stopwatch: live?.stopwatch && challenge.minigameId === 'stopwatch'
        ? sanitizeStopwatchForUser(live.stopwatch, uid)
        : null,
      maze: live?.maze && challenge.minigameId === 'maze'
        ? sanitizeMazeForUser(live.maze, uid)
        : null,
      hotCold: live?.hotCold && challenge.minigameId === 'hot_cold'
        ? sanitizeHotColdForUser(live.hotCold, uid)
        : null,
    }
  } catch (error) {
    console.error('No se pudo preparar el estado del duelo:', error)
    return {
      ...challenge,
      threeCards: null,
      oddsEvens: null,
      stopwatch: null,
      maze: null,
      hotCold: null,
    }
  }
}

function profileFields(data: FirebaseFirestore.DocumentData | undefined) {
  return {
    displayName: asString(data?.displayName, 'Usuario'),
    photoUrl: asString(data?.photoUrl),
    email: asString(data?.email).trim().toLowerCase(),
    phone: asString(data?.phone),
  }
}

function formatWhen(startTime: Date): string {
  return startTime.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function mapReservationChallenge(
  id: string,
  data: FirebaseFirestore.DocumentData,
): ReservationChallengeRecord {
  return {
    id,
    reservationId: asString(data.reservationId),
    companyId: asString(data.companyId),
    companyName: asString(data.companyName, 'Restaurante'),
    companySlug: asString(data.companySlug),
    companyPhotoUrl: asString(data.companyPhotoUrl),
    startTime: toIso(data.startTime),
    pax: typeof data.pax === 'number' ? data.pax : 1,
    challengerUid: asString(data.challengerUid),
    challengerDisplayName: asString(data.challengerDisplayName, 'Usuario'),
    challengerPhotoUrl: asString(data.challengerPhotoUrl),
    challengedUid: asString(data.challengedUid),
    challengedDisplayName: asString(data.challengedDisplayName, 'Usuario'),
    challengedPhotoUrl: asString(data.challengedPhotoUrl),
    minigameId: asMinigameId(data.minigameId),
    status: asStatus(data.status),
    winnerUid: asString(data.winnerUid) || null,
    resultAckedUids: Array.isArray(data.resultAckedUids)
      ? data.resultAckedUids.filter((item): item is string => typeof item === 'string')
      : [],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  }
}

async function loadChallenge(challengeId: string): Promise<{
  ref: FirebaseFirestore.DocumentReference
  challenge: ReservationChallengeRecord
}> {
  const ref = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new Error('Reto no encontrado.')
  }
  return { ref, challenge: mapReservationChallenge(snap.id, snap.data() ?? {}) }
}

function assertParticipant(challenge: ReservationChallengeRecord, uid: string) {
  if (challenge.challengerUid !== uid && challenge.challengedUid !== uid) {
    throw new Error('Este reto no es tuyo.')
  }
}

export async function createReservationChallenge(
  challengerUid: string,
  reservationId: string,
): Promise<ReservationChallengeRecord> {
  const trimmedReservationId = reservationId.trim()
  if (!trimmedReservationId) {
    throw new Error('Reserva no válida.')
  }

  const [reservationSnap, inviteByIdSnap, liveSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.reservations).doc(trimmedReservationId).get(),
    adminDb.collection(COLLECTIONS.reservationInvites)
      .doc(reservationInviteId(trimmedReservationId, challengerUid))
      .get(),
    adminDb.collection(COLLECTIONS.reservationChallenges)
      .where('reservationId', '==', trimmedReservationId)
      .get(),
  ])

  if (!reservationSnap.exists) {
    throw new Error('Reserva no encontrada.')
  }

  const reservation = reservationSnap.data() ?? {}
  if (reservation.status === 'cancelled') {
    throw new Error('Esta reserva está cancelada.')
  }

  const startTime = reservation.startTime?.toDate?.() instanceof Date
    ? reservation.startTime.toDate() as Date
    : new Date(toIso(reservation.startTime))
  if (Number.isNaN(startTime.getTime()) || startTime.getTime() <= Date.now()) {
    throw new Error('Solo puedes retar en reservas que aún no han empezado.')
  }

  let inviteSnap = inviteByIdSnap
  if (!inviteSnap.exists) {
    const inviteQuery = await adminDb.collection(COLLECTIONS.reservationInvites)
      .where('toUid', '==', challengerUid)
      .get()
    const matched = inviteQuery.docs.find((docSnap) => {
      const data = docSnap.data()
      return asString(data.reservationId) === trimmedReservationId && data.status === 'accepted'
    })
    if (matched) {
      inviteSnap = matched
    }
  }

  if (!inviteSnap.exists) {
    throw new Error('Solo un invitado de esta reserva puede retar.')
  }

  const invite = inviteSnap.data() ?? {}
  if (invite.status !== 'accepted') {
    throw new Error('Tienes que haber aceptado la invitación para retar.')
  }
  if (invite.toUid !== challengerUid) {
    throw new Error('Solo un invitado de esta reserva puede retar.')
  }

  const ownerUid = asString(reservation.customerUid) || asString(invite.fromUid)
  if (!ownerUid || ownerUid === challengerUid) {
    throw new Error('No puedes retar por tu propia reserva.')
  }

  const alreadyLive = liveSnap.docs.some((docSnap) => {
    const status = docSnap.data().status
    return status === 'ringing' || status === 'active'
  })
  if (alreadyLive) {
    throw new Error('Ya hay un reto en curso para esta reserva.')
  }

  const [challengerSnap, challengedSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.users).doc(challengerUid).get(),
    adminDb.collection(COLLECTIONS.users).doc(ownerUid).get(),
  ])

  if (!challengerSnap.exists || challengerSnap.data()?.role !== 'customer') {
    throw new Error('Debes iniciar sesión como cliente.')
  }
  if (!challengedSnap.exists || challengedSnap.data()?.role !== 'customer') {
    throw new Error('No se encontró al titular de la reserva.')
  }

  const challenger = profileFields(challengerSnap.data())
  const challenged = profileFields(challengedSnap.data())
  const now = Timestamp.now()
  const minigameId = 'three_cards'
  const ref = adminDb.collection(COLLECTIONS.reservationChallenges).doc()

  const payload = {
    reservationId: trimmedReservationId,
    companyId: asString(reservation.companyId) || asString(invite.companyId),
    companyName: asString(invite.companyName, asString(reservation.companyName, 'Restaurante')),
    companySlug: asString(invite.companySlug),
    companyPhotoUrl: asString(invite.companyPhotoUrl),
    startTime: Timestamp.fromDate(startTime),
    pax: typeof reservation.pax === 'number' ? reservation.pax : 1,
    challengerUid,
    challengerDisplayName: challenger.displayName,
    challengerPhotoUrl: challenger.photoUrl,
    challengedUid: ownerUid,
    challengedDisplayName: challenged.displayName,
    challengedPhotoUrl: challenged.photoUrl,
    minigameId,
    status: 'ringing' as const,
    winnerUid: null,
    resultAckedUids: [],
    createdAt: now,
    updatedAt: now,
  }

  await ref.set(payload)

  try {
    await createCustomerNotification(ownerUid, {
      type: 'reservation_challenge_received',
      title: 'Te están retando',
      body: `${challenger.displayName} te reta por la reserva en ${payload.companyName} · ${formatWhen(startTime)}.`,
      icon: '⚔️',
      actionUrl: '/app/reservas',
      actionLabel: 'Ver reto',
      dedupeKey: `reservation_challenge_received:${ref.id}`,
      data: {
        challengeId: ref.id,
        reservationId: trimmedReservationId,
        actorUid: challengerUid,
        actorDisplayName: challenger.displayName,
        actorPhotoUrl: challenger.photoUrl,
        companyId: payload.companyId,
        companyName: payload.companyName,
        companySlug: payload.companySlug,
      },
    })
  } catch (error) {
    console.error('No se pudo avisar del reto:', error)
  }

  return asPublicChallenge(mapReservationChallenge(ref.id, payload), challengerUid, null)
}

export async function listLiveChallengesForUser(uid: string): Promise<PublicReservationChallenge[]> {
  const [incomingSnap, outgoingSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.reservationChallenges).where('challengedUid', '==', uid).get(),
    adminDb.collection(COLLECTIONS.reservationChallenges).where('challengerUid', '==', uid).get(),
  ])

  const byId = new Map<string, ReservationChallengeRecord>()
  for (const docSnap of [...incomingSnap.docs, ...outgoingSnap.docs]) {
    const challenge = mapReservationChallenge(docSnap.id, docSnap.data())
    if (
      challenge.status === 'ringing'
      || challenge.status === 'active'
      || (challenge.status === 'resolved' && !challenge.resultAckedUids.includes(uid))
    ) {
      byId.set(challenge.id, challenge)
    }
  }

  const hydrated = await Promise.all(
    [...byId.values()].map(async (challenge) => {
      try {
        return await hydrateChallengeForUser(challenge, uid)
      } catch (error) {
        console.error('No se pudo hidratar el reto', challenge.id, error)
        return asPublicChallenge(challenge, uid, null)
      }
    }),
  )
  return hydrated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function acceptReservationChallenge(
  challengeId: string,
  uid: string,
): Promise<PublicReservationChallenge> {
  const { ref, challenge } = await loadChallenge(challengeId)
  if (challenge.challengedUid !== uid) {
    throw new Error('Solo el retado puede aceptar.')
  }
  if (challenge.status !== 'ringing') {
    throw new Error('Este reto ya no está pendiente.')
  }

  const now = Timestamp.now()
  const minigameId = pickRandomMinigame()
  const threeCardsGame = minigameId === 'three_cards'
    ? createThreeCardsGame(challenge.challengerUid, challenge.challengedUid)
    : null
  const oddsEvensGame = minigameId === 'odds_evens'
    ? createOddsEvensGame(challenge.challengerUid, challenge.challengedUid)
    : null
  const stopwatchGame = minigameId === 'stopwatch'
    ? createStopwatchGame(challenge.challengerUid, challenge.challengedUid)
    : null
  const mazeGame = minigameId === 'maze'
    ? createMazeGame(challenge.challengerUid, challenge.challengedUid)
    : null
  const hotColdGame = minigameId === 'hot_cold'
    ? createHotColdGame(challenge.challengerUid, challenge.challengedUid)
    : null
  const batch = adminDb.batch()
  batch.update(ref, {
    status: 'active',
    minigameId,
    updatedAt: now,
  })
  if (threeCardsGame) {
    batch.set(threeCardsSecretRef(challengeId), { game: threeCardsGame })
  }
  if (oddsEvensGame) {
    batch.set(oddsEvensSecretRef(challengeId), { game: serializeOddsEvensGame(oddsEvensGame) })
  }
  if (stopwatchGame) {
    batch.set(stopwatchSecretRef(challengeId), { game: serializeStopwatchGame(stopwatchGame) })
  }
  if (mazeGame) {
    batch.set(mazeSecretRef(challengeId), { game: serializeMazeGame(mazeGame) })
  }
  if (hotColdGame) {
    batch.set(hotColdSecretRef(challengeId), { game: serializeHotColdGame(hotColdGame) })
  }
  await batch.commit()

  return asPublicChallenge({
    ...challenge,
    minigameId,
    status: 'active',
    updatedAt: now.toDate().toISOString(),
  }, uid, {
    threeCards: threeCardsGame,
    oddsEvens: oddsEvensGame,
    stopwatch: stopwatchGame,
    maze: mazeGame,
    hotCold: hotColdGame,
  })
}

export async function declineReservationChallenge(
  challengeId: string,
  uid: string,
): Promise<PublicReservationChallenge> {
  const { challenge } = await loadChallenge(challengeId)
  assertParticipant(challenge, uid)
  if (challenge.status === 'active') {
    return forfeitChallengeGame(challengeId, uid)
  }
  if (challenge.status !== 'ringing') {
    return hydrateChallengeForUser(challenge, uid)
  }

  const now = Timestamp.now()
  const nextStatus: ChallengeStatus = uid === challenge.challengedUid ? 'declined' : 'cancelled'
  await adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId).update({
    status: nextStatus,
    updatedAt: now,
  })

  return asPublicChallenge({
    ...challenge,
    status: nextStatus,
    updatedAt: now.toDate().toISOString(),
  }, uid, null)
}

export async function ackChallengeResult(
  challengeId: string,
  uid: string,
): Promise<ReservationChallengeRecord> {
  const { ref, challenge } = await loadChallenge(challengeId)
  assertParticipant(challenge, uid)
  if (challenge.status !== 'resolved') {
    throw new Error('Este reto aún no tiene resultado.')
  }

  const resultAckedUids = [...new Set([...challenge.resultAckedUids, uid])]
  await ref.update({
    resultAckedUids,
    updatedAt: Timestamp.now(),
  })

  return {
    ...challenge,
    resultAckedUids,
  }
}

async function transferReservationToWinner(
  challenge: ReservationChallengeRecord,
  winnerUid: string,
): Promise<void> {
  const reservationRef = adminDb.collection(COLLECTIONS.reservations).doc(challenge.reservationId)
  const reservationSnap = await reservationRef.get()
  if (!reservationSnap.exists) {
    throw new Error('Reserva no encontrada.')
  }

  const reservation = reservationSnap.data() ?? {}
  const previousOwnerUid = asString(reservation.customerUid) || challenge.challengedUid
  if (!previousOwnerUid || previousOwnerUid === winnerUid) {
    return
  }

  const winnerSnap = await adminDb.collection(COLLECTIONS.users).doc(winnerUid).get()
  if (!winnerSnap.exists || winnerSnap.data()?.role !== 'customer') {
    throw new Error('No se encontró al ganador.')
  }

  const winner = profileFields(winnerSnap.data())
  if (!winner.email) {
    throw new Error('El ganador no tiene un correo válido.')
  }

  await reservationRef.update({
    customerUid: winnerUid,
    clientName: winner.displayName,
    clientEmail: winner.email,
    clientPhone: winner.phone || asString(reservation.clientPhone),
  })

  const invitesSnap = await adminDb.collection(COLLECTIONS.reservationInvites)
    .where('reservationId', '==', challenge.reservationId)
    .get()

  const batch = adminDb.batch()
  let hasLoserInvite = false

  for (const docSnap of invitesSnap.docs) {
    const data = docSnap.data()
    const toUid = asString(data.toUid)
    if (toUid === winnerUid) {
      batch.update(docSnap.ref, {
        status: 'cancelled',
        respondedAt: Timestamp.now(),
      })
      continue
    }

    if (toUid === previousOwnerUid) {
      hasLoserInvite = true
      batch.update(docSnap.ref, {
        status: 'accepted',
        fromUid: winnerUid,
        fromDisplayName: winner.displayName,
        fromPhotoUrl: winner.photoUrl,
        respondedAt: Timestamp.now(),
      })
      continue
    }

    batch.update(docSnap.ref, {
      fromUid: winnerUid,
      fromDisplayName: winner.displayName,
      fromPhotoUrl: winner.photoUrl,
    })
  }

  if (!hasLoserInvite) {
    const loserSnap = await adminDb.collection(COLLECTIONS.users).doc(previousOwnerUid).get()
    const loser = profileFields(loserSnap.data())
    const inviteId = reservationInviteId(challenge.reservationId, previousOwnerUid)
    batch.set(adminDb.collection(COLLECTIONS.reservationInvites).doc(inviteId), {
      reservationId: challenge.reservationId,
      companyId: challenge.companyId,
      companyName: challenge.companyName,
      companySlug: challenge.companySlug,
      companyPhotoUrl: challenge.companyPhotoUrl,
      fromUid: winnerUid,
      fromDisplayName: winner.displayName,
      fromPhotoUrl: winner.photoUrl,
      toUid: previousOwnerUid,
      toDisplayName: loser.displayName,
      toPhotoUrl: loser.photoUrl,
      status: 'accepted',
      reservationStatus: reservation.status === 'confirmed' ? 'confirmed' : 'completed',
      startTime: reservation.startTime ?? Timestamp.now(),
      pax: challenge.pax,
      createdAt: Timestamp.now(),
      respondedAt: Timestamp.now(),
    })
  }

  await batch.commit()
}

/** Lo usarán los minijuegos: el servidor decide el ganador y mueve la titularidad. */
export async function settleReservationChallenge(
  challengeId: string,
  winnerUid: string,
): Promise<ReservationChallengeRecord> {
  const { ref, challenge } = await loadChallenge(challengeId)
  if (challenge.status !== 'active') {
    throw new Error('Este reto no está en juego.')
  }
  if (winnerUid !== challenge.challengerUid && winnerUid !== challenge.challengedUid) {
    throw new Error('El ganador tiene que ser uno de los dos jugadores.')
  }

  await transferReservationToWinner(challenge, winnerUid)

  const now = Timestamp.now()
  await ref.update({
    status: 'resolved',
    winnerUid,
    updatedAt: now,
  })

  const winnerName = winnerUid === challenge.challengerUid
    ? challenge.challengerDisplayName
    : challenge.challengedDisplayName
  const transferred = winnerUid === challenge.challengerUid

  for (const uid of [challenge.challengerUid, challenge.challengedUid]) {
    await createCustomerNotification(uid, {
      type: 'reservation_challenge_resolved',
      title: transferred ? 'Cambio de titular' : 'Reto resuelto',
      body: transferred
        ? `${winnerName} se queda la reserva de ${challenge.companyName}.`
        : `${winnerName} ha defendido la reserva de ${challenge.companyName}.`,
      icon: '🏆',
      actionUrl: '/app/reservas',
      actionLabel: 'Ver reserva',
      dedupeKey: `reservation_challenge_resolved:${challengeId}:${uid}`,
      data: {
        challengeId,
        reservationId: challenge.reservationId,
        actorUid: winnerUid,
        actorDisplayName: winnerName,
        companyId: challenge.companyId,
        companyName: challenge.companyName,
        companySlug: challenge.companySlug,
      },
    })
  }

  return {
    ...challenge,
    status: 'resolved',
    winnerUid,
    updatedAt: now.toDate().toISOString(),
  }
}

function isMascotPhoto(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) {
    return false
  }
  const lower = url.toLowerCase()
  return lower.includes('adelina.webp')
    || /\/adelina([?#].*)?$/.test(lower)
    || lower.includes('assets/adelina')
}

async function withLivePlayerPhotos(
  challenge: ReservationChallengeRecord,
): Promise<ReservationChallengeRecord> {
  if (!challenge.challengerUid || !challenge.challengedUid) {
    return challenge
  }

  try {
    const [challengerSnap, challengedSnap] = await Promise.all([
      adminDb.collection(COLLECTIONS.users).doc(challenge.challengerUid).get(),
      adminDb.collection(COLLECTIONS.users).doc(challenge.challengedUid).get(),
    ])
    const challenger = profileFields(challengerSnap.data())
    const challenged = profileFields(challengedSnap.data())
    const challengerPhoto = challenger.photoUrl && !isMascotPhoto(challenger.photoUrl)
      ? challenger.photoUrl
      : ''
    const challengedPhoto = challenged.photoUrl && !isMascotPhoto(challenged.photoUrl)
      ? challenged.photoUrl
      : ''

    return {
      ...challenge,
      challengerDisplayName: challenger.displayName || challenge.challengerDisplayName,
      challengerPhotoUrl: challengerPhoto || (isMascotPhoto(challenge.challengerPhotoUrl) ? '' : challenge.challengerPhotoUrl),
      challengedDisplayName: challenged.displayName || challenge.challengedDisplayName,
      challengedPhotoUrl: challengedPhoto || (isMascotPhoto(challenge.challengedPhotoUrl) ? '' : challenge.challengedPhotoUrl),
    }
  } catch (error) {
    console.error('No se pudieron cargar las fotos del duelo:', error)
    return challenge
  }
}

async function loadThreeCardsSecret(challengeId: string): Promise<ThreeCardsGame | null> {
  const snap = await threeCardsSecretRef(challengeId).get()
  return parseThreeCardsGame(snap.data()?.game)
}

async function loadStopwatchSecret(challengeId: string): Promise<StopwatchGame | null> {
  const snap = await stopwatchSecretRef(challengeId).get()
  return parseStopwatchGame(snap.data()?.game)
}

async function loadOddsEvensSecret(challengeId: string): Promise<OddsEvensGame | null> {
  const snap = await oddsEvensSecretRef(challengeId).get()
  return parseOddsEvensGame(snap.data()?.game) ?? parseOddsEvensGame(snap.data())
}

async function loadMazeSecret(challengeId: string): Promise<MazeGame | null> {
  const snap = await mazeSecretRef(challengeId).get()
  return parseMazeGame(snap.data()?.game) ?? parseMazeGame(snap.data())
}

async function loadHotColdSecret(challengeId: string): Promise<HotColdGame | null> {
  const snap = await hotColdSecretRef(challengeId).get()
  return parseHotColdGame(snap.data()?.game) ?? parseHotColdGame(snap.data())
}

async function hydrateChallengeForUser(
  challenge: ReservationChallengeRecord,
  uid: string,
): Promise<PublicReservationChallenge> {
  if (challenge.status !== 'active') {
    const withPhotos = await withLivePlayerPhotos(challenge)
    if (challenge.minigameId === 'stopwatch') {
      const game = await loadStopwatchSecret(challenge.id)
      return asPublicChallenge(withPhotos, uid, { stopwatch: game })
    }
    if (challenge.minigameId === 'odds_evens') {
      const game = await loadOddsEvensSecret(challenge.id)
      return asPublicChallenge(withPhotos, uid, { oddsEvens: game })
    }
    if (challenge.minigameId === 'maze') {
      const game = await loadMazeSecret(challenge.id)
      return asPublicChallenge(withPhotos, uid, { maze: game })
    }
    if (challenge.minigameId === 'hot_cold') {
      const game = await loadHotColdSecret(challenge.id)
      return asPublicChallenge(withPhotos, uid, { hotCold: game })
    }
    if (challenge.minigameId === 'three_cards') {
      const game = await loadThreeCardsSecret(challenge.id)
      return asPublicChallenge(withPhotos, uid, { threeCards: game })
    }
    return asPublicChallenge(withPhotos, uid)
  }

  if (challenge.minigameId === 'three_cards') {
    const synced = await syncThreeCardsState(challenge.id)
    const withPhotos = await withLivePlayerPhotos(synced.challenge)
    return asPublicChallenge({
      ...synced.challenge,
      challengerDisplayName: withPhotos.challengerDisplayName,
      challengerPhotoUrl: withPhotos.challengerPhotoUrl,
      challengedDisplayName: withPhotos.challengedDisplayName,
      challengedPhotoUrl: withPhotos.challengedPhotoUrl,
    }, uid, { threeCards: synced.game })
  }

  if (challenge.minigameId === 'odds_evens') {
    const synced = await syncOddsEvensState(challenge.id)
    const withPhotos = await withLivePlayerPhotos(synced.challenge)
    return asPublicChallenge({
      ...synced.challenge,
      challengerDisplayName: withPhotos.challengerDisplayName,
      challengerPhotoUrl: withPhotos.challengerPhotoUrl,
      challengedDisplayName: withPhotos.challengedDisplayName,
      challengedPhotoUrl: withPhotos.challengedPhotoUrl,
    }, uid, { oddsEvens: synced.game })
  }

  if (challenge.minigameId === 'stopwatch') {
    const synced = await syncStopwatchState(challenge.id)
    const withPhotos = await withLivePlayerPhotos(synced.challenge)
    return asPublicChallenge({
      ...synced.challenge,
      challengerDisplayName: withPhotos.challengerDisplayName,
      challengerPhotoUrl: withPhotos.challengerPhotoUrl,
      challengedDisplayName: withPhotos.challengedDisplayName,
      challengedPhotoUrl: withPhotos.challengedPhotoUrl,
    }, uid, { stopwatch: synced.game })
  }

  if (challenge.minigameId === 'maze') {
    const synced = await syncMazeState(challenge.id)
    const withPhotos = await withLivePlayerPhotos(synced.challenge)
    return asPublicChallenge({
      ...synced.challenge,
      challengerDisplayName: withPhotos.challengerDisplayName,
      challengerPhotoUrl: withPhotos.challengerPhotoUrl,
      challengedDisplayName: withPhotos.challengedDisplayName,
      challengedPhotoUrl: withPhotos.challengedPhotoUrl,
    }, uid, { maze: synced.game })
  }

  if (challenge.minigameId === 'hot_cold') {
    const synced = await syncHotColdState(challenge.id)
    const withPhotos = await withLivePlayerPhotos(synced.challenge)
    return asPublicChallenge({
      ...synced.challenge,
      challengerDisplayName: withPhotos.challengerDisplayName,
      challengerPhotoUrl: withPhotos.challengerPhotoUrl,
      challengedDisplayName: withPhotos.challengedDisplayName,
      challengedPhotoUrl: withPhotos.challengedPhotoUrl,
    }, uid, { hotCold: synced.game })
  }

  return asPublicChallenge(await withLivePlayerPhotos(challenge), uid)
}

async function settleIfWinner(challengeId: string, winnerUid: string | null, status: ChallengeStatus) {
  if (!winnerUid || status !== 'active') {
    return null
  }
  try {
    return await settleReservationChallenge(challengeId, winnerUid)
  } catch (error) {
    if (error instanceof Error && error.message.includes('no está en juego')) {
      const loaded = await loadChallenge(challengeId)
      return loaded.challenge
    }
    throw error
  }
}

async function syncThreeCardsState(
  challengeId: string,
): Promise<{ challenge: ReservationChallengeRecord; game: ThreeCardsGame | null }> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = threeCardsSecretRef(challengeId)
  let winnerUid: string | null = null

  const synced = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    const secretSnap = await tx.get(secretRef)
    let game = parseThreeCardsGame(secretSnap.data()?.game)

    if (challenge.status === 'active' && challenge.minigameId === 'three_cards') {
      if (!game) {
        game = createThreeCardsGame(challenge.challengerUid, challenge.challengedUid)
        tx.set(secretRef, { game })
      } else {
        const ticked = tickThreeCards(game)
        if (ticked.changed) {
          game = ticked.game
          tx.set(secretRef, { game })
        }
      }
      if (game.phase === 'done' && game.winnerUid) {
        winnerUid = game.winnerUid
      }
    }

    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, synced.challenge.status)
  return {
    challenge: settled ?? synced.challenge,
    game: synced.game,
  }
}

async function playThreeCardsAction(
  challengeId: string,
  uid: string,
  apply: (game: ThreeCardsGame, now: number) => ThreeCardsGame,
): Promise<PublicReservationChallenge> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = threeCardsSecretRef(challengeId)
  const now = Date.now()
  let winnerUid: string | null = null

  const played = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    assertParticipant(challenge, uid)
    if (challenge.status !== 'active') {
      throw new Error('Este reto no está en juego.')
    }
    if (challenge.minigameId !== 'three_cards') {
      throw new Error('Este duelo no es de 3 cartas.')
    }

    const secretSnap = await tx.get(secretRef)
    let game = parseThreeCardsGame(secretSnap.data()?.game)
    if (!game) {
      throw new Error('El juego no está listo.')
    }

    game = tickThreeCards(game, now).game
    if (game.phase !== 'done') {
      game = apply(game, now)
    }

    tx.set(secretRef, { game })
    tx.update(challengeRef, { updatedAt: Timestamp.now() })
    if (game.phase === 'done' && game.winnerUid) {
      winnerUid = game.winnerUid
    }
    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, played.challenge.status)
  return asPublicChallenge(settled ?? played.challenge, uid, { threeCards: played.game })
}

export async function pickChallengeDeck(
  challengeId: string,
  uid: string,
  deckId: string,
): Promise<PublicReservationChallenge> {
  const trimmed = deckId.trim()
  if (!trimmed) {
    throw new Error('Elige un mazo.')
  }
  return playThreeCardsAction(challengeId, uid, (game, now) => pickThreeCardsDeck(game, uid, trimmed, now))
}

export async function removeChallengeCard(
  challengeId: string,
  uid: string,
  cardId: string,
): Promise<PublicReservationChallenge> {
  const trimmed = cardId.trim()
  if (!trimmed) {
    throw new Error('Elige una carta.')
  }
  return playThreeCardsAction(challengeId, uid, (game, now) => removeThreeCardsCard(game, uid, trimmed, now))
}

export async function pickChallengeFinalCard(
  challengeId: string,
  uid: string,
  cardId: string,
): Promise<PublicReservationChallenge> {
  const trimmed = cardId.trim()
  if (!trimmed) {
    throw new Error('Elige una carta.')
  }
  return playThreeCardsAction(challengeId, uid, (game, now) => pickThreeCardsFinalCard(game, uid, trimmed, now))
}

export async function forfeitChallengeGame(
  challengeId: string,
  uid: string,
): Promise<PublicReservationChallenge> {
  const { challenge } = await loadChallenge(challengeId)
  if (challenge.minigameId === 'odds_evens') {
    return playOddsEvensAction(challengeId, uid, (game) => forfeitOddsEvens(game, uid))
  }
  if (challenge.minigameId === 'stopwatch') {
    return playStopwatchAction(challengeId, uid, (game) => forfeitStopwatch(game, uid))
  }
  if (challenge.minigameId === 'maze') {
    return playMazeAction(challengeId, uid, (game) => forfeitMaze(game, uid))
  }
  if (challenge.minigameId === 'hot_cold') {
    return playHotColdAction(challengeId, uid, (game) => forfeitHotCold(game, uid))
  }
  return playThreeCardsAction(challengeId, uid, (game) => forfeitThreeCards(game, uid))
}

async function syncOddsEvensState(
  challengeId: string,
): Promise<{ challenge: ReservationChallengeRecord; game: OddsEvensGame | null }> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = oddsEvensSecretRef(challengeId)
  let winnerUid: string | null = null

  const synced = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    const secretSnap = await tx.get(secretRef)
    let game = parseOddsEvensGame(secretSnap.data()?.game) ?? parseOddsEvensGame(secretSnap.data())

    if (challenge.status === 'active' && challenge.minigameId === 'odds_evens') {
      if (!game) {
        game = createOddsEvensGame(challenge.challengerUid, challenge.challengedUid)
        tx.set(secretRef, { game: serializeOddsEvensGame(game) })
      } else {
        const ticked = tickOddsEvens(game)
        if (ticked.changed) {
          game = ticked.game
          tx.set(secretRef, { game: serializeOddsEvensGame(game) })
        }
      }
      if (game?.phase === 'done' && game.winnerUid) {
        winnerUid = game.winnerUid
      }
    }

    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, synced.challenge.status)
  return {
    challenge: settled ?? synced.challenge,
    game: synced.game,
  }
}

async function playOddsEvensAction(
  challengeId: string,
  uid: string,
  apply: (game: OddsEvensGame, now: number) => OddsEvensGame,
): Promise<PublicReservationChallenge> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = oddsEvensSecretRef(challengeId)
  const now = Date.now()
  let winnerUid: string | null = null

  const played = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    assertParticipant(challenge, uid)
    if (challenge.status !== 'active') {
      throw new Error('Este reto no está en juego.')
    }
    if (challenge.minigameId !== 'odds_evens') {
      throw new Error('Este duelo no es de pares y nones.')
    }

    const secretSnap = await tx.get(secretRef)
    let game = parseOddsEvensGame(secretSnap.data()?.game) ?? parseOddsEvensGame(secretSnap.data())
    if (!game) {
      game = createOddsEvensGame(challenge.challengerUid, challenge.challengedUid)
    }

    if (game.phase !== 'done') {
      game = apply(game, now)
    }
    game = tickOddsEvens(game, now).game

    tx.set(secretRef, { game: serializeOddsEvensGame(game) })
    tx.update(challengeRef, { updatedAt: Timestamp.now() })
    if (game.phase === 'done' && game.winnerUid) {
      winnerUid = game.winnerUid
    }
    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, played.challenge.status)
  return asPublicChallenge(settled ?? played.challenge, uid, { oddsEvens: played.game })
}

export async function pickChallengeOddsEvensSide(
  challengeId: string,
  uid: string,
  side: string,
): Promise<PublicReservationChallenge> {
  const trimmed = side.trim()
  if (trimmed !== 'even' && trimmed !== 'odd') {
    throw new Error('Elige pares o nones.')
  }
  return playOddsEvensAction(
    challengeId,
    uid,
    (game, now) => pickOddsEvensSide(game, uid, trimmed as OddsEvensSide, now),
  )
}

export async function pickChallengeOddsEvensNumber(
  challengeId: string,
  uid: string,
  value: number,
): Promise<PublicReservationChallenge> {
  const picked = Math.trunc(Number(value))
  if (!Number.isInteger(picked) || picked < 1 || picked > 9) {
    throw new Error('Elige un número del 1 al 9.')
  }
  return playOddsEvensAction(challengeId, uid, (game, now) => pickOddsEvensNumber(game, uid, picked, now))
}

async function syncStopwatchState(
  challengeId: string,
): Promise<{ challenge: ReservationChallengeRecord; game: StopwatchGame | null }> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = stopwatchSecretRef(challengeId)
  let winnerUid: string | null = null

  const synced = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    const secretSnap = await tx.get(secretRef)
    let game = parseStopwatchGame(secretSnap.data()?.game)

    if (challenge.status === 'active' && challenge.minigameId === 'stopwatch') {
      if (!game) {
        game = createStopwatchGame(challenge.challengerUid, challenge.challengedUid)
        tx.set(secretRef, { game: serializeStopwatchGame(game) })
      } else {
        const ticked = tickStopwatch(game)
        if (ticked.changed) {
          game = ticked.game
          tx.set(secretRef, { game: serializeStopwatchGame(game) })
        }
      }
      if (game.phase === 'done' && game.winnerUid) {
        winnerUid = game.winnerUid
      }
    }

    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, synced.challenge.status)
  return {
    challenge: settled ?? synced.challenge,
    game: synced.game,
  }
}

async function playStopwatchAction(
  challengeId: string,
  uid: string,
  apply: (game: StopwatchGame, now: number) => StopwatchGame,
): Promise<PublicReservationChallenge> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = stopwatchSecretRef(challengeId)
  const now = Date.now()
  let winnerUid: string | null = null

  const played = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    assertParticipant(challenge, uid)
    if (challenge.status !== 'active') {
      throw new Error('Este reto no está en juego.')
    }
    if (challenge.minigameId !== 'stopwatch') {
      throw new Error('Este duelo no es de cronómetro.')
    }

    const secretSnap = await tx.get(secretRef)
    let game = parseStopwatchGame(secretSnap.data()?.game)
    if (!game) {
      throw new Error('El juego no está listo.')
    }

    if (game.phase !== 'done') {
      game = apply(game, now)
    }
    game = tickStopwatch(game, now).game

    tx.set(secretRef, { game: serializeStopwatchGame(game) })
    tx.update(challengeRef, { updatedAt: Timestamp.now() })
    if (game.phase === 'done' && game.winnerUid) {
      winnerUid = game.winnerUid
    }
    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, played.challenge.status)
  return asPublicChallenge(settled ?? played.challenge, uid, { stopwatch: played.game })
}

export async function startChallengeStopwatch(
  challengeId: string,
  uid: string,
): Promise<PublicReservationChallenge> {
  return playStopwatchAction(challengeId, uid, (game, now) => startStopwatch(game, uid, now))
}

export async function stopChallengeStopwatch(
  challengeId: string,
  uid: string,
  hundredths: number,
): Promise<PublicReservationChallenge> {
  if (!Number.isFinite(hundredths)) {
    throw new Error('No se pudo parar el cronómetro.')
  }
  return playStopwatchAction(
    challengeId,
    uid,
    (game, now) => stopStopwatch(game, uid, Math.round(hundredths), now),
  )
}

async function syncMazeState(
  challengeId: string,
): Promise<{ challenge: ReservationChallengeRecord; game: MazeGame | null }> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = mazeSecretRef(challengeId)
  let winnerUid: string | null = null

  const synced = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    const secretSnap = await tx.get(secretRef)
    let game = parseMazeGame(secretSnap.data()?.game) ?? parseMazeGame(secretSnap.data())

    if (challenge.status === 'active' && challenge.minigameId === 'maze') {
      if (!game) {
        game = createMazeGame(challenge.challengerUid, challenge.challengedUid)
        tx.set(secretRef, { game: serializeMazeGame(game) })
      } else {
        const ticked = tickMaze(game)
        if (ticked.changed) {
          game = ticked.game
          tx.set(secretRef, { game: serializeMazeGame(game) })
        }
      }
      if (game.phase === 'done' && game.winnerUid) {
        winnerUid = game.winnerUid
      }
    }

    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, synced.challenge.status)
  return {
    challenge: settled ?? synced.challenge,
    game: synced.game,
  }
}

async function playMazeAction(
  challengeId: string,
  uid: string,
  apply: (game: MazeGame) => MazeGame,
): Promise<PublicReservationChallenge> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = mazeSecretRef(challengeId)
  let winnerUid: string | null = null

  const played = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    assertParticipant(challenge, uid)
    if (challenge.status !== 'active') {
      throw new Error('Este reto no está en juego.')
    }
    if (challenge.minigameId !== 'maze') {
      throw new Error('Este duelo no es de laberinto.')
    }

    const secretSnap = await tx.get(secretRef)
    let game = parseMazeGame(secretSnap.data()?.game) ?? parseMazeGame(secretSnap.data())
    if (!game) {
      game = createMazeGame(challenge.challengerUid, challenge.challengedUid)
    }

    if (game.phase !== 'done') {
      game = apply(game)
    }

    tx.set(secretRef, { game: serializeMazeGame(game) })
    tx.update(challengeRef, { updatedAt: Timestamp.now() })
    if (game.phase === 'done' && game.winnerUid) {
      winnerUid = game.winnerUid
    }
    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, played.challenge.status)
  return asPublicChallenge(settled ?? played.challenge, uid, { maze: played.game })
}

export async function moveChallengeMaze(
  challengeId: string,
  uid: string,
  direction: string,
): Promise<PublicReservationChallenge> {
  const trimmed = direction.trim()
  if (trimmed !== 'up' && trimmed !== 'down' && trimmed !== 'left' && trimmed !== 'right') {
    throw new Error('Esa dirección no vale.')
  }
  return playMazeAction(challengeId, uid, (game) => moveMaze(game, uid, trimmed as MazeDirection))
}

async function syncHotColdState(
  challengeId: string,
): Promise<{ challenge: ReservationChallengeRecord; game: HotColdGame | null }> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = hotColdSecretRef(challengeId)
  let winnerUid: string | null = null

  const synced = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    const secretSnap = await tx.get(secretRef)
    let game = parseHotColdGame(secretSnap.data()?.game) ?? parseHotColdGame(secretSnap.data())

    if (challenge.status === 'active' && challenge.minigameId === 'hot_cold') {
      if (!game) {
        game = createHotColdGame(challenge.challengerUid, challenge.challengedUid)
        tx.set(secretRef, { game: serializeHotColdGame(game) })
      } else {
        const ticked = tickHotCold(game)
        if (ticked.changed) {
          game = ticked.game
          tx.set(secretRef, { game: serializeHotColdGame(game) })
        }
      }
      if (game?.phase === 'done' && game.winnerUid) {
        winnerUid = game.winnerUid
      }
    }

    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, synced.challenge.status)
  return {
    challenge: settled ?? synced.challenge,
    game: synced.game,
  }
}

async function playHotColdAction(
  challengeId: string,
  uid: string,
  apply: (game: HotColdGame, now: number) => HotColdGame,
): Promise<PublicReservationChallenge> {
  const challengeRef = adminDb.collection(COLLECTIONS.reservationChallenges).doc(challengeId)
  const secretRef = hotColdSecretRef(challengeId)
  const now = Date.now()
  let winnerUid: string | null = null

  const played = await adminDb.runTransaction(async (tx) => {
    const challengeSnap = await tx.get(challengeRef)
    if (!challengeSnap.exists) {
      throw new Error('Reto no encontrado.')
    }
    const challenge = mapReservationChallenge(challengeSnap.id, challengeSnap.data() ?? {})
    assertParticipant(challenge, uid)
    if (challenge.status !== 'active') {
      throw new Error('Este reto no está en juego.')
    }
    if (challenge.minigameId !== 'hot_cold') {
      throw new Error('Este duelo no es de frío y caliente.')
    }

    const secretSnap = await tx.get(secretRef)
    let game = parseHotColdGame(secretSnap.data()?.game) ?? parseHotColdGame(secretSnap.data())
    if (!game) {
      game = createHotColdGame(challenge.challengerUid, challenge.challengedUid)
    }

    if (game.phase !== 'done') {
      game = apply(game, now)
    }
    game = tickHotCold(game).game

    tx.set(secretRef, { game: serializeHotColdGame(game) })
    tx.update(challengeRef, { updatedAt: Timestamp.now() })
    if (game.phase === 'done' && game.winnerUid) {
      winnerUid = game.winnerUid
    }
    return { challenge, game }
  })

  const settled = await settleIfWinner(challengeId, winnerUid, played.challenge.status)
  return asPublicChallenge(settled ?? played.challenge, uid, { hotCold: played.game })
}

export async function pickChallengeHotColdNumber(
  challengeId: string,
  uid: string,
  value: number,
): Promise<PublicReservationChallenge> {
  const picked = Math.trunc(Number(value))
  if (!Number.isInteger(picked) || picked < 1 || picked > 99) {
    throw new Error('Elige uno de los tres números.')
  }
  return playHotColdAction(challengeId, uid, (game, now) => pickHotColdNumber(game, uid, picked, now))
}
