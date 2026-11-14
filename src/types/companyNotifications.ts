export type CompanyNotificationType =
  | 'mission_completed'
  | 'badge_unlocked'
  | 'level_up'
  | 'adelinas_changed'
  | 'rating_changed'
  | 'review_received'
  | 'reservation_new'
  | 'reservation_cancelled_by_client'
  | 'admin_message'

export interface CompanyNotification {
  id: string
  type: CompanyNotificationType
  title: string
  body: string
  icon: string
  read: boolean
  readAt: string | null
  createdAt: string
  actionTab: string
  actionLabel: string | null
  data: Record<string, unknown>
  dedupeKey: string
}
