import { onRequest } from 'firebase-functions/v2/https'
import { createApp } from '../server/createApp.ts'
import {
  onReservationCreatedSendEmail,
  onReservationUpdatedSendEmail,
  resendApiKeySecret,
} from './reservationEmailTrigger.ts'

export { onReservationCreatedSendEmail, onReservationUpdatedSendEmail }

const app = createApp()

export const api = onRequest(
  {
    region: 'europe-southwest1',
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [resendApiKeySecret],
  },
  app,
)
