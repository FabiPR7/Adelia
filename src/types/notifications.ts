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
  | 'reservation_invite_received'
  | 'reservation_invite_accepted'
  | 'reservation_invite_rejected'
  | 'reservation_invite_cancelled'
  | 'reservation_challenge_received'
  | 'reservation_challenge_resolved'
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
  inviteId?: string
  challengeId?: string
  inviteStatus?: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  promotionId?: string
  promotionTitle?: string
  missionId?: string
  missionName?: string
  badgeId?: string
  badgeName?: string
  fromLevel?: number
  toLevel?: number
  cancelledBy?: 'client' | 'restaurant'
  xpLost?: number
  xpAfter?: number
  strikeCount?: number
  percent?: number
  nextPercent?: number | null
  promoLocked?: boolean
  justLocked?: boolean
  warning?: string
  shielded?: boolean
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
