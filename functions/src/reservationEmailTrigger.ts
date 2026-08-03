import { defineSecret } from 'firebase-functions/params'
import {
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore'
import { getResendApiKey } from '../server/email/config.ts'
import {
  processReservationConfirmationEmail,
  processReservationReceivedEmail,
  shouldSendConfirmationOnUpdate,
  shouldSendReceivedOnCreate,
} from '../server/email/processReservationEmail.ts'
import { upsertCompanyClientFromReservation } from '../server/clients/upsertCompanyClient.ts'
import { adminDb } from '../server/firebase-admin.ts'

export const resendApiKeySecret = defineSecret('RESEND_API_KEY')

const triggerOptions = {
  document: 'reservations/{reservationId}',
  database: 'adelia',
  region: 'europe-west1',
  secrets: [resendApiKeySecret],
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

    if (!shouldSendConfirmationOnUpdate(before, after)) {
      return
    }

    const reservationId = event.params.reservationId
    const apiKey = resolveResendApiKey()

    try {
      await processReservationConfirmationEmail(reservationId, after!, apiKey)
    } catch (error) {
      console.error(`Failed to send confirmation email for updated reservation ${reservationId}:`, error)
    }
  },
)
