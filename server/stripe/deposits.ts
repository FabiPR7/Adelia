import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { createStripeClient } from './config.ts'

export type ReservationDepositStatus =
  | 'authorized'
  | 'captured'
  | 'released'
  | 'failed'

export function computeDepositAmountCents(
  pax: number,
  depositMinPax: number | null | undefined,
  depositPerGuestCents: number | null | undefined,
): number {
  if (
    typeof depositMinPax !== 'number'
    || depositMinPax <= 0
    || typeof depositPerGuestCents !== 'number'
    || depositPerGuestCents <= 0
    || pax < depositMinPax
  ) {
    return 0
  }

  return depositPerGuestCents * pax
}

function getReservationStartTime(reservation: Record<string, unknown>): Date | null {
  const startTime = reservation.startTime as { toDate?: () => Date } | undefined

  if (startTime && typeof startTime.toDate === 'function') {
    return startTime.toDate()
  }

  return null
}

export function shouldCaptureDepositOnCancellation(
  reservationStart: Date,
  depositCancellationHours: number | null | undefined,
  cancelledAt: Date = new Date(),
): boolean {
  if (typeof depositCancellationHours !== 'number' || depositCancellationHours <= 0) {
    return true
  }

  const msUntilReservation = reservationStart.getTime() - cancelledAt.getTime()

  if (msUntilReservation <= 0) {
    return true
  }

  const hoursUntilReservation = msUntilReservation / (1000 * 60 * 60)
  return hoursUntilReservation < depositCancellationHours
}

export type DepositCancelOutcome = 'none' | 'captured' | 'released'

export function previewDepositCancellation(input: {
  reservation: Record<string, unknown>
  depositCancellationHours: number | null | undefined
  cancelledAt?: Date
}): {
  hasAuthorizedDeposit: boolean
  depositAmountCents: number | null
  willCaptureDeposit: boolean
} {
  const depositStatus = typeof input.reservation.depositStatus === 'string'
    ? input.reservation.depositStatus
    : null
  const paymentIntentId = typeof input.reservation.depositPaymentIntentId === 'string'
    ? input.reservation.depositPaymentIntentId
    : null
  const depositAmountCents = typeof input.reservation.depositAmountCents === 'number'
    && input.reservation.depositAmountCents > 0
    ? input.reservation.depositAmountCents
    : null

  const hasAuthorizedDeposit = Boolean(
    paymentIntentId
    && depositStatus === 'authorized'
    && depositAmountCents,
  )

  if (!hasAuthorizedDeposit) {
    return {
      hasAuthorizedDeposit: false,
      depositAmountCents,
      willCaptureDeposit: false,
    }
  }

  const reservationStart = getReservationStartTime(input.reservation)
  const willCaptureDeposit = !reservationStart
    || shouldCaptureDepositOnCancellation(
      reservationStart,
      input.depositCancellationHours,
      input.cancelledAt,
    )

  return {
    hasAuthorizedDeposit: true,
    depositAmountCents,
    willCaptureDeposit,
  }
}

export async function processReservationDepositOnCancel(input: {
  reservationId: string
  reservation: Record<string, unknown>
  stripeAccountId: string | undefined
  depositCancellationHours: number | null | undefined
  cancelledAt?: Date
}): Promise<DepositCancelOutcome> {
  const preview = previewDepositCancellation({
    reservation: input.reservation,
    depositCancellationHours: input.depositCancellationHours,
    cancelledAt: input.cancelledAt,
  })

  if (!preview.hasAuthorizedDeposit) {
    return 'none'
  }

  if (!input.stripeAccountId) {
    throw new Error('No se pudo gestionar la fianza: el restaurante no tiene pagos activos.')
  }

  if (preview.willCaptureDeposit) {
    await captureReservationDeposit({
      paymentIntentId: input.reservation.depositPaymentIntentId as string,
      connectedAccountId: input.stripeAccountId,
      reservationId: input.reservationId,
    })
    return 'captured'
  }

  await releaseReservationDeposit({
    paymentIntentId: input.reservation.depositPaymentIntentId as string,
    connectedAccountId: input.stripeAccountId,
    reservationId: input.reservationId,
  })
  return 'released'
}

export async function handleReservationDepositOnCancellation(input: {
  reservationId: string
  reservation: Record<string, unknown>
  stripeAccountId: string
  depositCancellationHours: number | null | undefined
  cancelledAt?: Date
}): Promise<void> {
  const paymentIntentId = typeof input.reservation.depositPaymentIntentId === 'string'
    ? input.reservation.depositPaymentIntentId
    : null
  const depositStatus = typeof input.reservation.depositStatus === 'string'
    ? input.reservation.depositStatus
    : null

  if (!paymentIntentId || depositStatus !== 'authorized') {
    return
  }

  await processReservationDepositOnCancel({
    reservationId: input.reservationId,
    reservation: input.reservation,
    stripeAccountId: input.stripeAccountId,
    depositCancellationHours: input.depositCancellationHours,
    cancelledAt: input.cancelledAt,
  })
}

export async function createDepositPaymentIntent(input: {
  connectedAccountId: string
  amountCents: number
  companyId: string
  slug: string
  pax: number
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (input.amountCents <= 0) {
    throw new Error('Importe de fianza no válido.')
  }

  const stripe = createStripeClient()
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: 'eur',
      capture_method: 'manual',
      metadata: {
        type: 'reservation_deposit',
        companyId: input.companyId,
        slug: input.slug,
        pax: String(input.pax),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    },
    {
      stripeAccount: input.connectedAccountId,
    },
  )

  if (!paymentIntent.client_secret) {
    throw new Error('No se pudo iniciar el pago de la fianza.')
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }
}

export async function verifyDepositPaymentIntent(input: {
  paymentIntentId: string
  connectedAccountId: string
  expectedAmountCents: number
  companyId: string
}): Promise<void> {
  const stripe = createStripeClient()
  const paymentIntent = await stripe.paymentIntents.retrieve(
    input.paymentIntentId,
    {},
    { stripeAccount: input.connectedAccountId },
  )

  if (paymentIntent.metadata.companyId !== input.companyId) {
    throw new Error('La fianza no corresponde a este restaurante.')
  }

  if (paymentIntent.amount !== input.expectedAmountCents) {
    throw new Error('El importe de la fianza no coincide con la reserva.')
  }

  const allowedStatuses = new Set(['requires_capture', 'processing', 'succeeded'])

  if (!allowedStatuses.has(paymentIntent.status)) {
    throw new Error('La fianza no está autorizada. Completa el pago antes de confirmar la reserva.')
  }
}

export async function captureReservationDeposit(input: {
  paymentIntentId: string
  connectedAccountId: string
  reservationId: string
}): Promise<void> {
  const stripe = createStripeClient()
  const paymentIntent = await stripe.paymentIntents.retrieve(
    input.paymentIntentId,
    {},
    { stripeAccount: input.connectedAccountId },
  )

  if (paymentIntent.status === 'succeeded') {
    await adminDb.collection('reservations').doc(input.reservationId).update({
      depositStatus: 'captured',
      updatedAt: FieldValue.serverTimestamp(),
    })
    return
  }

  if (paymentIntent.status !== 'requires_capture') {
    throw new Error('La fianza no se puede cobrar en este estado.')
  }

  await stripe.paymentIntents.capture(
    input.paymentIntentId,
    {},
    { stripeAccount: input.connectedAccountId },
  )

  await adminDb.collection('reservations').doc(input.reservationId).update({
    depositStatus: 'captured',
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function releaseReservationDeposit(input: {
  paymentIntentId: string
  connectedAccountId: string
  reservationId: string
}): Promise<void> {
  const stripe = createStripeClient()
  const paymentIntent = await stripe.paymentIntents.retrieve(
    input.paymentIntentId,
    {},
    { stripeAccount: input.connectedAccountId },
  )

  if (paymentIntent.status === 'canceled') {
    await adminDb.collection('reservations').doc(input.reservationId).update({
      depositStatus: 'released',
      updatedAt: FieldValue.serverTimestamp(),
    })
    return
  }

  if (paymentIntent.status !== 'requires_capture') {
    if (paymentIntent.status === 'succeeded') {
      return
    }

    throw new Error('La fianza no se puede liberar en este estado.')
  }

  await stripe.paymentIntents.cancel(
    input.paymentIntentId,
    {},
    { stripeAccount: input.connectedAccountId },
  )

  await adminDb.collection('reservations').doc(input.reservationId).update({
    depositStatus: 'released',
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function syncReservationDepositForStatus(input: {
  reservationId: string
  companyId: string
  status: 'confirmed' | 'cancelled'
}): Promise<void> {
  const reservationSnap = await adminDb.collection('reservations').doc(input.reservationId).get()

  if (!reservationSnap.exists) {
    throw new Error('Reserva no encontrada.')
  }

  const reservation = reservationSnap.data()!

  if (reservation.companyId !== input.companyId) {
    throw new Error('La reserva no pertenece a este restaurante.')
  }

  const paymentIntentId = typeof reservation.depositPaymentIntentId === 'string'
    ? reservation.depositPaymentIntentId
    : null
  const depositStatus = typeof reservation.depositStatus === 'string'
    ? reservation.depositStatus
    : null

  if (!paymentIntentId || depositStatus !== 'authorized') {
    return
  }

  const companySnap = await adminDb.collection('companies').doc(input.companyId).get()
  const companyData = companySnap.data()
  const stripeAccountId = companyData?.stripeAccountId as string | undefined
  const depositCancellationHours = typeof companyData?.depositCancellationHours === 'number'
    ? companyData.depositCancellationHours
    : null

  if (!stripeAccountId) {
    throw new Error('El restaurante no tiene Stripe conectado.')
  }

  if (input.status === 'confirmed') {
    await releaseReservationDeposit({
      paymentIntentId,
      connectedAccountId: stripeAccountId,
      reservationId: input.reservationId,
    })
    return
  }

  await handleReservationDepositOnCancellation({
    reservationId: input.reservationId,
    reservation,
    stripeAccountId,
    depositCancellationHours,
  })
}
