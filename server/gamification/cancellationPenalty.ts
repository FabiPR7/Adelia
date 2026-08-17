import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { readGamificationFromDocs, userGamificationRef, writeGamification } from '../data/userGamification.ts'
import { findCustomerUidByEmail, resolveCustomerUidForReservation } from '../notifications/service.ts'
import { consumeInventoryItem, inventoryQty } from './inventory.ts'
import { CANCEL_SHIELD_ITEM_ID } from './inventoryItems.ts'

export const PROMO_LOCK_STRIKES = 5

export const CANCELLATION_PENALTY_RATES = [
  { strike: 1, percent: 12, minXp: 40 },
  { strike: 2, percent: 30, minXp: 90 },
  { strike: 3, percent: 50, minXp: 160 },
  { strike: 4, percent: 70, minXp: 280 },
  { strike: 5, percent: 85, minXp: 420 },
] as const

export const PROMO_LOCK_BOOKING_MESSAGE =
  'Tienes bloqueadas las reservas con promoción por cancelar demasiadas veces. Aún puedes reservar mesa sin promo.'

export const PROMO_LOCK_CLAIM_MESSAGE =
  'Tienes bloqueado el canje de promociones por cancelar demasiadas reservas.'

const MAX_CANCELLED_RESERVATION_IDS = 80

export interface CancellationPenaltyResult {
  applied: boolean
  xpLost: number
  xpBefore: number
  xpAfter: number
  strikeCount: number
  percent: number
  nextPercent: number | null
  promoLocked: boolean
  justLocked: boolean
  warning: string
  shielded?: boolean
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim()))]
    : []
}

export function penaltyForStrike(strike: number): { strike: number; percent: number; minXp: number } {
  const last = CANCELLATION_PENALTY_RATES[CANCELLATION_PENALTY_RATES.length - 1]
  return CANCELLATION_PENALTY_RATES.find((entry) => entry.strike === strike) ?? last
}

export function computeCancellationXpLoss(currentXp: number, strike: number): number {
  const safeXp = Math.max(0, Math.floor(currentXp))
  if (safeXp <= 0) {
    return 0
  }

  const { percent, minXp } = penaltyForStrike(strike)
  const percentLoss = Math.ceil(safeXp * (percent / 100))
  return Math.min(safeXp, Math.max(minXp, percentLoss))
}

export function isPromoLockedFromState(state: Record<string, unknown>): boolean {
  if (state.promoLocked === true) {
    return true
  }

  return numberValue(state.cancellationStrikeCount) >= PROMO_LOCK_STRIKES
}

export function assertCustomerCanUsePromos(state: Record<string, unknown>): void {
  if (isPromoLockedFromState(state)) {
    throw new Error(PROMO_LOCK_CLAIM_MESSAGE)
  }
}

export function buildCancelPenaltyWarning(strikeCount: number, promoLocked: boolean): string {
  if (promoLocked && strikeCount >= PROMO_LOCK_STRIKES) {
    if (strikeCount === PROMO_LOCK_STRIKES) {
      return 'Has llegado al límite: ya no puedes reservar ni canjear promociones.'
    }

    return 'Sigues sin poder usar promociones. Cada cancelación te seguirá quitando puntos.'
  }

  const nextPercent = penaltyForStrike(strikeCount + 1).percent
  if (strikeCount + 1 >= PROMO_LOCK_STRIKES) {
    return `Cuidado: si cancelas otra reserva te quitaremos un ${nextPercent}% de tus puntos y se te bloquearán las promociones.`
  }

  return `Cuidado: si cancelas otra reserva te quitaremos un ${nextPercent}% de tus puntos.`
}

function buildPenaltyResult(input: {
  xpLost: number
  xpBefore: number
  xpAfter: number
  strikeCount: number
  promoLocked: boolean
  justLocked: boolean
}): CancellationPenaltyResult {
  const percent = penaltyForStrike(input.strikeCount).percent
  const nextPercent = penaltyForStrike(input.strikeCount + 1).percent

  return {
    applied: true,
    xpLost: input.xpLost,
    xpBefore: input.xpBefore,
    xpAfter: input.xpAfter,
    strikeCount: input.strikeCount,
    percent,
    nextPercent,
    promoLocked: input.promoLocked,
    justLocked: input.justLocked,
    warning: buildCancelPenaltyWarning(input.strikeCount, input.promoLocked),
  }
}

export function parseStoredPenalty(data: Record<string, unknown>): CancellationPenaltyResult | null {
  const raw = data.xpPenalty
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const penalty = raw as Record<string, unknown>
  if (penalty.shielded === true) {
    const strikeCount = Math.max(0, Math.trunc(numberValue(penalty.strikeCount)))
    const xp = Math.max(0, Math.trunc(numberValue(penalty.xpAfter, numberValue(penalty.xpBefore))))
    return {
      applied: false,
      shielded: true,
      xpLost: 0,
      xpBefore: xp,
      xpAfter: xp,
      strikeCount,
      percent: 0,
      nextPercent: penaltyForStrike(Math.max(1, strikeCount + 1)).percent,
      promoLocked: penalty.promoLocked === true || strikeCount >= PROMO_LOCK_STRIKES,
      justLocked: false,
      warning: 'Has usado un Escudo de Mesa. Esta cancelación no te quita puntos ni cuenta como aviso.',
    }
  }
  const strikeCount = Math.max(1, Math.trunc(numberValue(penalty.strikeCount)))
  const xpLost = Math.max(0, Math.trunc(numberValue(penalty.xpLost)))
  const xpBefore = Math.max(0, Math.trunc(numberValue(penalty.xpBefore, xpLost)))
  const xpAfter = Math.max(0, Math.trunc(numberValue(penalty.xpAfter, xpBefore - xpLost)))
  const promoLocked = penalty.promoLocked === true || strikeCount >= PROMO_LOCK_STRIKES

  return buildPenaltyResult({
    xpLost,
    xpBefore,
    xpAfter,
    strikeCount,
    promoLocked,
    justLocked: penalty.justLocked === true,
  })
}

function computePendingPenalty(state: Record<string, unknown>): CancellationPenaltyResult {
  const xpBefore = Math.max(0, Math.trunc(numberValue(state.xp)))
  const previousStrikes = Math.max(0, Math.trunc(numberValue(state.cancellationStrikeCount)))
  const strikeCount = previousStrikes + 1
  const xpLost = computeCancellationXpLoss(xpBefore, strikeCount)
  const xpAfter = xpBefore - xpLost
  const promoLocked = strikeCount >= PROMO_LOCK_STRIKES
  const justLocked = promoLocked && previousStrikes < PROMO_LOCK_STRIKES

  return buildPenaltyResult({
    xpLost,
    xpBefore,
    xpAfter,
    strikeCount,
    promoLocked,
    justLocked,
  })
}

export async function isPromoLockedForBooking(
  customerUid: string | null | undefined,
  email: string,
): Promise<boolean> {
  let uid = typeof customerUid === 'string' ? customerUid.trim() : ''

  if (!uid && email.trim()) {
    uid = await findCustomerUidByEmail(email) ?? ''
  }

  if (!uid) {
    return false
  }

  const [userSnap, statsSnap] = await Promise.all([
    adminDb.collection('users').doc(uid).get(),
    userGamificationRef(uid).get(),
  ])

  return isPromoLockedFromState(readGamificationFromDocs(statsSnap.data(), userSnap.data()))
}

export async function previewCancellationPenalty(
  reservation: Record<string, unknown>,
  reservationId?: string,
): Promise<CancellationPenaltyResult | null> {
  const stored = parseStoredPenalty(reservation)
  if (stored) {
    return stored
  }

  const userId = await resolveCustomerUidForReservation(reservation)
  if (!userId) {
    return null
  }

  const [userSnap, statsSnap] = await Promise.all([
    adminDb.collection('users').doc(userId).get(),
    userGamificationRef(userId).get(),
  ])
  const state = readGamificationFromDocs(statsSnap.data(), userSnap.data())

  if (reservationId && stringArray(state.cancelledReservationIds).includes(reservationId)) {
    return computePendingPenalty({
      ...state,
      cancellationStrikeCount: Math.max(0, numberValue(state.cancellationStrikeCount) - 1),
    })
  }

  return computePendingPenalty(state)
}

export async function previewCancelShieldCount(
  reservation: Record<string, unknown>,
): Promise<number> {
  const userId = await resolveCustomerUidForReservation(reservation)
  if (!userId) {
    return 0
  }

  const [userSnap, statsSnap] = await Promise.all([
    adminDb.collection('users').doc(userId).get(),
    userGamificationRef(userId).get(),
  ])

  return inventoryQty(readGamificationFromDocs(statsSnap.data(), userSnap.data()), CANCEL_SHIELD_ITEM_ID)
}

export async function applyReservationCancellationPenalty(
  reservationId: string,
  reservation: Record<string, unknown>,
  options?: { consumeShield?: boolean },
): Promise<CancellationPenaltyResult | null> {
  const userId = await resolveCustomerUidForReservation(reservation)
  if (!userId || !reservationId.trim()) {
    return null
  }

  const reservationRef = adminDb.collection('reservations').doc(reservationId)
  const userRef = adminDb.collection('users').doc(userId)
  const statsRef = userGamificationRef(userId)

  return adminDb.runTransaction(async (transaction) => {
    const [reservationSnap, userSnap, statsSnap] = await Promise.all([
      transaction.get(reservationRef),
      transaction.get(userRef),
      transaction.get(statsRef),
    ])

    const reservationData = (reservationSnap.data() ?? reservation) as Record<string, unknown>
    const stored = parseStoredPenalty(reservationData)
    if (stored) {
      return stored
    }

    const state = readGamificationFromDocs(statsSnap.data(), userSnap.data())
    const cancelledIds = stringArray(state.cancelledReservationIds)
    if (cancelledIds.includes(reservationId)) {
      const previousStrikes = Math.max(1, Math.trunc(numberValue(state.cancellationStrikeCount)))
      return buildPenaltyResult({
        xpLost: 0,
        xpBefore: Math.max(0, Math.trunc(numberValue(state.xp))),
        xpAfter: Math.max(0, Math.trunc(numberValue(state.xp))),
        strikeCount: previousStrikes,
        promoLocked: isPromoLockedFromState(state),
        justLocked: false,
      })
    }

    const wantShield = options?.consumeShield === true
      || reservationData.cancelShieldRequested === true
      || reservationData.cancelledBy === 'restaurant'
    const canShield = wantShield && inventoryQty(state, CANCEL_SHIELD_ITEM_ID) > 0
    const xpBefore = Math.max(0, Math.trunc(numberValue(state.xp)))
    const previousStrikes = Math.max(0, Math.trunc(numberValue(state.cancellationStrikeCount)))

    if (canShield) {
      const consumed = consumeInventoryItem(state, CANCEL_SHIELD_ITEM_ID, 1)
      const shielded: CancellationPenaltyResult = {
        applied: false,
        shielded: true,
        xpLost: 0,
        xpBefore,
        xpAfter: xpBefore,
        strikeCount: previousStrikes,
        percent: 0,
        nextPercent: penaltyForStrike(previousStrikes + 1).percent,
        promoLocked: isPromoLockedFromState(state),
        justLocked: false,
        warning: 'Has usado un Escudo de Mesa. Esta cancelación no te quita puntos ni cuenta como aviso.',
      }
      writeGamification(transaction, userId, consumed)
      if (reservationSnap.exists) {
        transaction.update(reservationRef, {
          xpPenalty: shielded,
          xpPenaltyAppliedAt: Timestamp.now(),
        })
      }
      return shielded
    }

    const result = computePendingPenalty(state)
    const nextIds = [...cancelledIds, reservationId].slice(-MAX_CANCELLED_RESERVATION_IDS)

    writeGamification(transaction, userId, {
      ...state,
      xp: result.xpAfter,
      cancellationStrikeCount: result.strikeCount,
      cancelledReservationIds: nextIds,
      xpPenaltyTotal: numberValue(state.xpPenaltyTotal) + result.xpLost,
      promoLocked: result.promoLocked,
    })

    if (reservationSnap.exists) {
      transaction.update(reservationRef, {
        xpPenalty: result,
        xpPenaltyAppliedAt: Timestamp.now(),
      })
    }

    return result
  })
}
