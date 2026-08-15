export type NotificationType =
  | 'reservation_received'
  | 'reservation_confirmed'
  | 'reservation_cancelled_by_client'
  | 'reservation_cancelled_by_restaurant'
  | 'reservation_reminder_1h'
  | 'reservation_review_prompt'
  | 'promotion_ready_to_verify'
  | 'promotion_ready_to_claim'
  | 'promotion_claimed'
  | 'friend_request_received'
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'mission_completed'
  | 'badge_unlocked'
  | 'level_up'

export interface NotificationData {
  actorUid?: string
  actorDisplayName?: string
  actorPhotoUrl?: string
  companyId?: string
  companyName?: string
  companySlug?: string
  reservationId?: string
  promotionId?: string
  promotionTitle?: string
  missionId?: string
  missionName?: string
  badgeId?: string
  badgeName?: string
  fromLevel?: number
  toLevel?: number
  cancelledBy?: 'client' | 'restaurant'
}

export interface CustomerNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  icon: string
  read: boolean
  readAt: string | null
  createdAt: string
  actionUrl: string | null
  actionLabel: string | null
  data: NotificationData
  dedupeKey: string
}
