export { api } from './api.ts'
export {
  onReservationCreatedSendEmail,
  onReservationUpdatedSendEmail,
  onReservationUpdatedNotifications,
  onUserGamificationUpdatedNotifications,
  onPromotionClaimCreatedNotifications,
  processScheduledNotifications,
  processDueNotifications,
} from './triggers.ts'
export { adminCreateCompany } from './adminCompanyManagement.ts'
export {
  createReservation,
  cancelReservation,
  checkReservationAvailability,
} from './reservationManagement.ts'
export { cleanupRateLimitsScheduled } from './scheduledFunctions.ts'

// Stats counters triggers for optimized analytics
export {
  onUserCreate,
  onUserDelete,
  onCompanyCreate,
  onCompanyDelete,
  onReservationCreate,
  onReservationDelete,
  onReviewCreate,
  onReviewDelete,
  recalculateAllCounters
} from './triggers/statsCounters.ts'
