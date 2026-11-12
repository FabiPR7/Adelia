import {
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore'
import { getResendApiKey } from '../server/email/config.ts'
import {
  processReservationCancelledEmail,
  processReservationConfirmationEmail,
  processReservationReceivedEmail,
  shouldSendConfirmationOnUpdate,
  shouldSendReceivedOnCreate,
} from '../server/email/processReservationEmail.ts'
import { upsertCompanyClientFromReservation } from '../server/clients/upsertCompanyClient.ts'
import { adminDb } from '../server/firebase-admin.ts'
import { notifyReservationReceived } from '../server/notifications/reservationEvents.ts'
import { resendApiKey } from './secrets.ts'

const triggerOptions = {
  document: 'reservations/{reservationId}',
  database: 'adelia',
  region: 'europe-southwest1',
  secrets: [resendApiKey],
} as const

function resolveResendApiKey(): string | undefined {
  return getResendApiKey()
}

export const onReservationCreatedSendEmail = onDocumentCreated(
  triggerOptions,
  async (event) => {
    const snapshot = event.data

    if (!snapshot) {
      return
    }

    try {
      await upsertCompanyClientFromReservation(adminDb, snapshot.id, snapshot.data()!)
    } catch (error) {
      console.error(`Failed to sync client for reservation ${snapshot.id}:`, error)
    }

    try {
      await notifyReservationReceived(snapshot.id, snapshot.data()!)
    } catch (error) {
      console.error(`Failed to notify received reservation ${snapshot.id}:`, error)
    }

    if (!shouldSendReceivedOnCreate(snapshot.data())) {
      return
    }

    const apiKey = resolveResendApiKey()

    try {
      await processReservationReceivedEmail(snapshot.id, snapshot.data(), apiKey)
    } catch (error) {
      console.error(`Failed to send received email for reservation ${snapshot.id}:`, error)
    }
  },
)

export const onReservationUpdatedSendEmail = onDocumentUpdated(
  triggerOptions,
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    const reservationId = event.params.reservationId

    // Los avisos dentro de la app (y la penalización) los hace
    // onReservationUpdatedNotifications: hacerlo también aquí lo duplicaba.

    if (before && after && before.status !== 'cancelled' && after.status === 'cancelled') {
      try {
        await processReservationCancelledEmail(reservationId, after, resolveResendApiKey())
      } catch (error) {
        console.error(`Failed to send cancellation email for reservation ${reservationId}:`, error)
      }
    }

    if (!shouldSendConfirmationOnUpdate(before, after)) {
      return
    }

    const apiKey = resolveResendApiKey()

    try {
      await processReservationConfirmationEmail(reservationId, after!, apiKey)
    } catch (error) {
      console.error(`Failed to send confirmation email for updated reservation ${reservationId}:`, error)
    }
  },
)
