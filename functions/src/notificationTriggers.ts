import {
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore'
import { adminDb } from '../server/firebase-admin.ts'
import {
  notifyReservationCancelled,
  notifyReservationConfirmed,
} from '../server/notifications/reservationEvents.ts'
import { notifyGamificationChanges } from '../server/notifications/gamificationEvents.ts'

const reservationTriggerOptions = {
  document: 'reservations/{reservationId}',
  database: 'adelia',
  region: 'europe-southwest1',
} as const

const userTriggerOptions = {
  document: 'users/{userId}',
  database: 'adelia',
  region: 'europe-southwest1',
} as const

export const onReservationUpdatedNotifications = onDocumentUpdated(
  reservationTriggerOptions,
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    const reservationId = event.params.reservationId

    if (!before || !after) {
      return
    }

    try {
      if (before.status !== 'confirmed' && after.status === 'confirmed') {
        await notifyReservationConfirmed(reservationId, after)
      }

      if (before.status !== 'cancelled' && after.status === 'cancelled') {
        const cancelledBy = after.cancelledBy === 'client' ? 'client' : 'restaurant'
        await notifyReservationCancelled(reservationId, after, cancelledBy)
      }
    } catch (error) {
      console.error(`Notification trigger failed for reservation ${reservationId}:`, error)
    }
  },
)

export const onUserGamificationUpdatedNotifications = onDocumentUpdated(
  userTriggerOptions,
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    const userId = event.params.userId

    if (!after || after.role !== 'customer') {
      return
    }

    const beforeGamification = JSON.stringify(before?.gamification ?? {})
    const afterGamification = JSON.stringify(after.gamification ?? {})

    if (beforeGamification === afterGamification) {
      return
    }

    try {
      await notifyGamificationChanges(userId, before, after)
    } catch (error) {
      console.error(`Gamification notification trigger failed for user ${userId}:`, error)
    }
  },
)
