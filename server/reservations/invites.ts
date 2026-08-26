import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import {
  COLLECTIONS,
  friendshipId,
  reservationInviteId,
} from '../data/collections.ts'
import { createCustomerNotification } from '../notifications/service.ts'

export const MAX_RESERVATION_INVITEES = 10

export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
export type InviteReservationStatus = 'completed' | 'confirmed' | 'cancelled'

export interface ReservationInviteRecord {
  id: string
  reservationId: string
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  fromUid: string
  fromDisplayName: string
  fromPhotoUrl: string
  toUid: string
  toDisplayName: string
  toPhotoUrl: string
  status: InviteStatus
  reservationStatus: InviteReservationStatus
  startTime: string
  pax: number
  createdAt: string
  respondedAt: string | null
}

function toMillisFromSeconds(secondsRaw: unknown, nanosRaw: unknown): number | null {
  const seconds = typeof secondsRaw === 'object' && secondsRaw && 'toNumber' in secondsRaw
    ? Number((secondsRaw as { toNumber: () => number }).toNumber())
    : Number(secondsRaw)
  const nanos = Number(nanosRaw ?? 0)
  if (!Number.isFinite(seconds)) {
    return null
  }
  return seconds * 1000 + (Number.isFinite(nanos) ? nanos / 1e6 : 0)
}

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString()
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
  }

  if (value && typeof value === 'object') {
    const record = value as {
      toDate?: () => Date
      seconds?: unknown
      nanoseconds?: unknown
      nanos?: unknown
      _seconds?: unknown
      _nanoseconds?: unknown
    }

    if (typeof record.toDate === 'function') {
      try {
        const converted = record.toDate()
        if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
          return converted.toISOString()
        }
      } catch {
        // Firestore Timestamp.toDate() fails if the method is detached from `this`.
      }
    }

    const millis = toMillisFromSeconds(
      record.seconds ?? record._seconds,
      record.nanoseconds ?? record._nanoseconds ?? record.nanos,
    )
    if (millis !== null) {
      return new Date(millis).toISOString()
    }
  }

  return new Date().toISOString()
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function mapReservationInvite(
  id: string,
  data: FirebaseFirestore.DocumentData,
): ReservationInviteRecord {
  const status = data.status
  const reservationStatus = data.reservationStatus

  return {
    id,
    reservationId: asString(data.reservationId),
    companyId: asString(data.companyId),
    companyName: asString(data.companyName, 'Restaurante'),
    companySlug: asString(data.companySlug),
    companyPhotoUrl: asString(data.companyPhotoUrl),
    fromUid: asString(data.fromUid),
    fromDisplayName: asString(data.fromDisplayName, 'Usuario'),
    fromPhotoUrl: asString(data.fromPhotoUrl),
    toUid: asString(data.toUid),
    toDisplayName: asString(data.toDisplayName, 'Usuario'),
    toPhotoUrl: asString(data.toPhotoUrl),
    status: status === 'accepted' || status === 'rejected' || status === 'cancelled'
      ? status
      : 'pending',
    reservationStatus: reservationStatus === 'confirmed' || reservationStatus === 'cancelled'
      ? reservationStatus
      : 'completed',
    startTime: toIso(data.startTime),
    pax: typeof data.pax === 'number' ? data.pax : 1,
    createdAt: toIso(data.createdAt),
    respondedAt: data.respondedAt ? toIso(data.respondedAt) : null,
  }
}

function parseInviteeUids(value: unknown, fromUid: string): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const unique = [...new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item && item !== fromUid),
  )]

  return unique.slice(0, MAX_RESERVATION_INVITEES)
}

async function areFriends(uidA: string, uidB: string): Promise<boolean> {
  const snap = await adminDb.collection(COLLECTIONS.friendships).doc(friendshipId(uidA, uidB)).get()
  return snap.exists
}

function formatInviteWhen(startTime: Date): string {
  return startTime.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function createReservationInvites(params: {
  reservationId: string
  startTime: Date
  pax: number
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  fromUid: string
  fromDisplayName: string
  fromPhotoUrl: string
  inviteeUids: unknown
}): Promise<number> {
  const inviteeUids = parseInviteeUids(params.inviteeUids, params.fromUid)
  if (inviteeUids.length === 0) {
    return 0
  }

  const now = Timestamp.now()
  let created = 0

  for (const toUid of inviteeUids) {
    try {
      if (!(await areFriends(params.fromUid, toUid))) {
        continue
      }

      const userSnap = await adminDb.collection(COLLECTIONS.users).doc(toUid).get()
      if (!userSnap.exists || userSnap.data()?.role !== 'customer') {
        continue
      }

      const toData = userSnap.data() ?? {}
      const toDisplayName = asString(toData.displayName, 'Usuario')
      const toPhotoUrl = asString(toData.photoUrl)
      const inviteId = reservationInviteId(params.reservationId, toUid)
      const inviteRef = adminDb.collection(COLLECTIONS.reservationInvites).doc(inviteId)
      const existing = await inviteRef.get()
      if (existing.exists) {
        continue
      }

      await inviteRef.set({
        reservationId: params.reservationId,
        companyId: params.companyId,
        companyName: params.companyName,
        companySlug: params.companySlug,
        companyPhotoUrl: params.companyPhotoUrl,
        fromUid: params.fromUid,
        fromDisplayName: params.fromDisplayName,
        fromPhotoUrl: params.fromPhotoUrl,
        toUid,
        toDisplayName,
        toPhotoUrl,
        status: 'pending',
        reservationStatus: 'completed',
        startTime: Timestamp.fromDate(params.startTime),
        pax: params.pax,
        createdAt: now,
        respondedAt: null,
      })

      await createCustomerNotification(toUid, {
        type: 'reservation_invite_received',
        title: 'Te han invitado a una reserva',
        body: `${params.fromDisplayName} te invita a ${params.companyName} · ${formatInviteWhen(params.startTime)}.`,
        icon: '💌',
        actionUrl: '/app/reservas',
        actionLabel: 'Aceptar o rechazar',
        dedupeKey: `reservation_invite_received:${inviteId}`,
        data: {
          inviteId,
          reservationId: params.reservationId,
          actorUid: params.fromUid,
          actorDisplayName: params.fromDisplayName,
          actorPhotoUrl: params.fromPhotoUrl,
          companyId: params.companyId,
          companyName: params.companyName,
          companySlug: params.companySlug,
        },
      })

      created += 1
    } catch (error) {
      console.error(`Reservation invite failed for ${toUid}:`, error)
    }
  }

  return created
}

export async function listInvitesForUser(uid: string): Promise<{
  pending: ReservationInviteRecord[]
  accepted: ReservationInviteRecord[]
  sent: ReservationInviteRecord[]
}> {
  const [incomingSnap, outgoingSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.reservationInvites).where('toUid', '==', uid).limit(40).get(),
    adminDb.collection(COLLECTIONS.reservationInvites).where('fromUid', '==', uid).limit(40).get(),
  ])

  const incoming = incomingSnap.docs.map((docSnap) => mapReservationInvite(docSnap.id, docSnap.data()))
  const sent = outgoingSnap.docs.map((docSnap) => mapReservationInvite(docSnap.id, docSnap.data()))

  incoming.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  sent.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    pending: incoming.filter((item) => item.status === 'pending' && item.reservationStatus !== 'cancelled'),
    accepted: incoming.filter((item) => item.status === 'accepted'),
    sent,
  }
}

export async function listInvitesForReservation(
  reservationId: string,
  requesterUid: string,
): Promise<ReservationInviteRecord[] | null> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.reservationInvites)
    .where('reservationId', '==', reservationId)
    .limit(20)
    .get()

  const invites = snapshot.docs.map((docSnap) => mapReservationInvite(docSnap.id, docSnap.data()))
  if (invites.length === 0) {
    return []
  }

  const allowed = invites.some((item) => item.fromUid === requesterUid || item.toUid === requesterUid)
  if (!allowed) {
    const reservationSnap = await adminDb.collection(COLLECTIONS.reservations).doc(reservationId).get()
    if (!reservationSnap.exists || reservationSnap.data()?.customerUid !== requesterUid) {
      return null
    }
  }

  invites.sort((a, b) => a.toDisplayName.localeCompare(b.toDisplayName, 'es'))
  return invites
}

export async function respondToReservationInvite(
  inviteId: string,
  uid: string,
  decision: 'accepted' | 'rejected',
): Promise<ReservationInviteRecord> {
  const inviteRef = adminDb.collection(COLLECTIONS.reservationInvites).doc(inviteId)
  const inviteSnap = await inviteRef.get()
  if (!inviteSnap.exists) {
    throw new Error('Invitación no encontrada.')
  }

  const invite = mapReservationInvite(inviteSnap.id, inviteSnap.data() ?? {})
  if (invite.toUid !== uid) {
    throw new Error('Esta invitación no es tuya.')
  }
  if (invite.status !== 'pending') {
    throw new Error(invite.status === 'accepted' ? 'Ya aceptaste esta invitación.' : 'Esta invitación ya no está pendiente.')
  }
  if (invite.reservationStatus === 'cancelled') {
    throw new Error('La reserva fue cancelada.')
  }

  const reservationSnap = await adminDb.collection(COLLECTIONS.reservations).doc(invite.reservationId).get()
  const reservationStatus = reservationSnap.data()?.status
  if (reservationStatus === 'cancelled') {
    await inviteRef.update({
      status: 'cancelled',
      reservationStatus: 'cancelled',
      respondedAt: Timestamp.now(),
    })
    throw new Error('La reserva fue cancelada.')
  }

  const now = Timestamp.now()
  await inviteRef.update({
    status: decision,
    respondedAt: now,
    reservationStatus: reservationStatus === 'confirmed' ? 'confirmed' : 'completed',
  })

  const responderSnap = await adminDb.collection(COLLECTIONS.users).doc(uid).get()
  const responderName = asString(responderSnap.data()?.displayName, invite.toDisplayName)

  if (decision === 'accepted') {
    await createCustomerNotification(invite.fromUid, {
      type: 'reservation_invite_accepted',
      title: 'Invitación aceptada',
      body: `${responderName} ha aceptado tu invitación a ${invite.companyName}.`,
      icon: '✅',
      actionUrl: '/app/reservas',
      actionLabel: 'Ver reserva',
      dedupeKey: `reservation_invite_accepted:${inviteId}`,
      data: {
        inviteId,
        reservationId: invite.reservationId,
        actorUid: uid,
        actorDisplayName: responderName,
        companyId: invite.companyId,
        companyName: invite.companyName,
        companySlug: invite.companySlug,
      },
    })
  } else {
    await createCustomerNotification(invite.fromUid, {
      type: 'reservation_invite_rejected',
      title: 'Invitación rechazada',
      body: `${responderName} ha rechazado tu invitación a ${invite.companyName}.`,
      icon: '✖️',
      actionUrl: '/app/reservas',
      actionLabel: 'Ver reserva',
      dedupeKey: `reservation_invite_rejected:${inviteId}`,
      data: {
        inviteId,
        reservationId: invite.reservationId,
        actorUid: uid,
        actorDisplayName: responderName,
        companyId: invite.companyId,
        companyName: invite.companyName,
        companySlug: invite.companySlug,
      },
    })
  }

  return {
    ...invite,
    status: decision,
    respondedAt: now.toDate().toISOString(),
    reservationStatus: reservationStatus === 'confirmed' ? 'confirmed' : 'completed',
  }
}

export async function cancelInvitesForReservation(reservationId: string): Promise<void> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.reservationInvites)
    .where('reservationId', '==', reservationId)
    .limit(20)
    .get()

  if (snapshot.empty) {
    return
  }

  const now = Timestamp.now()
  const batch = adminDb.batch()
  const toNotify: ReservationInviteRecord[] = []
  let writes = 0

  for (const docSnap of snapshot.docs) {
    const invite = mapReservationInvite(docSnap.id, docSnap.data())
    if (invite.reservationStatus === 'cancelled') {
      continue
    }
    batch.update(docSnap.ref, {
      reservationStatus: 'cancelled',
      status: invite.status === 'pending' ? 'cancelled' : invite.status,
      ...(invite.status === 'pending' ? { respondedAt: now } : {}),
    })
    writes += 1
    if (invite.status === 'pending' || invite.status === 'accepted') {
      toNotify.push(invite)
    }
  }

  if (writes > 0) {
    await batch.commit()
  }

  await Promise.all(toNotify.map((invite) =>
    createCustomerNotification(invite.toUid, {
      type: 'reservation_invite_cancelled',
      title: 'La reserva se ha cancelado',
      body: `${invite.fromDisplayName} canceló la reserva en ${invite.companyName}.`,
      icon: '🚫',
      actionUrl: '/app/reservas',
      actionLabel: 'Ver reservas',
      dedupeKey: `reservation_invite_cancelled:${invite.id}`,
      data: {
        inviteId: invite.id,
        reservationId: invite.reservationId,
        actorUid: invite.fromUid,
        actorDisplayName: invite.fromDisplayName,
        companyId: invite.companyId,
        companyName: invite.companyName,
        companySlug: invite.companySlug,
      },
    }).catch((error) => {
      console.error(`Invite cancel notification failed for ${invite.toUid}:`, error)
    }),
  ))
}
