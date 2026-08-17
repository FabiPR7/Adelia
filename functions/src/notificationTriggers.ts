import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore'
import {
  notifyReservationCancelled,
  notifyReservationConfirmed,
  notifyPromotionClaimed,
} from '../server/notifications/reservationEvents.ts'
import { cancelInvitesForReservation } from '../server/reservations/invites.ts'
import { notifyGamificationChanges } from '../server/notifications/gamificationEvents.ts'

const reservationTriggerOptions = {
  document: 'reservations/{reservationId}',
  database: 'adelia',
  region: 'europe-southwest1',
} as const

const userTriggerOptions = {
  document: 'userGamification/{userId}',
  database: 'adelia',
  region: 'europe-southwest1',
} as const

const promotionClaimTriggerOptions = {
  document: 'promotionClaims/{claimId}',
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
        await cancelInvitesForReservation(reservationId)
      }
    } catch (error) {
      console.error(`Notification trigger failed for reservation ${reservationId}:`, error)
    }
  },
)

export const onUserGamificationUpdatedNotifications = onDocumentWritten(
  userTriggerOptions,
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    const userId = event.params.userId

    if (!after) {
      return
    }

    const beforeState = before?.state && typeof before.state === 'object' ? before.state : {}
    const afterState = after.state && typeof after.state === 'object' ? after.state : {}

    if (JSON.stringify(beforeState) === JSON.stringify(afterState)) {
      return
    }

    try {
      await notifyGamificationChanges(
        userId,
        { role: 'customer', gamification: beforeState },
        { role: 'customer', gamification: afterState },
      )
    } catch (error) {
      console.error(`Gamification notification trigger failed for user ${userId}:`, error)
    }
  },
)

export const onPromotionClaimCreatedNotifications = onDocumentCreated(
  promotionClaimTriggerOptions,
  async (event) => {
    const data = event.data?.data()
    if (!data) {
      return
    }

    const customerUid = typeof data.customerUid === 'string' ? data.customerUid : ''
    const promotionId = typeof data.promotionId === 'string' ? data.promotionId : ''
    const companyId = typeof data.companyId === 'string' ? data.companyId : ''
    const title = typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : 'tu premio'
    const reservationId = typeof data.reservationId === 'string' ? data.reservationId : undefined

    if (!customerUid || !promotionId || !companyId) {
      return
    }

    try {
      await notifyPromotionClaimed(
        customerUid,
        promotionId,
        companyId,
        title,
        reservationId,
        event.params.claimId,
      )
    } catch (error) {
      console.error(`Promotion claim notification failed for ${event.params.claimId}:`, error)
    }
  },
)
