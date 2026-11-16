import {
  AlertTriangle,
  Award,
  Bell,
  CalendarCheck,
  CalendarX,
  ChevronRight,
  Medal,
  MessageSquare,
  Star,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { EmptyState, ReportCard, ReportHeader } from '../../components/reports/ReportKit'
import { useCompanyNotifications } from '../../hooks/useCompanyNotifications'
import type { CompanyTab } from '../../types/company'
import type { CompanyNotificationType } from '../../types/companyNotifications'
import styles from './CompanyCompiteNotifications.module.css'

interface CompanyCompiteNotificationsProps {
  onOpenTab: (tab: CompanyTab) => void
}

const TYPE_ICON: Record<CompanyNotificationType, LucideIcon> = {
  mission_completed: Target,
  badge_unlocked: Award,
  level_up: TrendingUp,
  adelinas_changed: Star,
  rating_changed: Star,
  review_received: MessageSquare,
  reservation_new: CalendarCheck,
  reservation_cancelled_by_client: CalendarX,
  setup_no_tables: AlertTriangle,
  league_result: Medal,
  admin_message: Bell,
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMinutes < 1) return 'Ahora'
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export default function CompanyCompiteNotifications({ onOpenTab }: CompanyCompiteNotificationsProps) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useCompanyNotifications()

  const handleOpen = async (notificationId: string, actionTab: string) => {
    await markRead(notificationId)
    onOpenTab(actionTab as CompanyTab)
  }

  return (
    <div className={styles.page}>
      <ReportHeader
        title="Notificaciones"
        subtitle="Reservas, reseñas, misiones, niveles y resultados de la Liga Adelia."
        actions={
          unreadCount > 0 ? (
            <button type="button" className={styles.secondaryButton} onClick={() => void markAllRead()}>
              Marcar todo como leído
            </button>
          ) : null
        }
      />

      <ReportCard
        title={unreadCount > 0 ? `${unreadCount} sin leer` : 'Estás al día'}
        subtitle="Pulsa un aviso para ir a la sección relacionada."
        icon={Bell}
      >
        {loading ? (
          <p className={styles.loading}>Cargando notificaciones…</p>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Aún no hay avisos"
            text="Te avisaremos de reservas nuevas, reseñas, misiones completadas, subidas de nivel y resultados de la Liga."
          />
        ) : (
          <ul className={styles.list}>
            {notifications.map((notification) => {
              const Icon = TYPE_ICON[notification.type] ?? Bell
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${notification.read ? '' : styles.unread}`}
                    onClick={() => void handleOpen(notification.id, notification.actionTab)}
                  >
                    <span className={styles.icon}>
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className={styles.content}>
                      <span className={styles.itemHead}>
                        <strong>{notification.title}</strong>
                        <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
                      </span>
                      <span className={styles.body}>{notification.body}</span>
                      {notification.actionLabel ? (
                        <span className={styles.action}>{notification.actionLabel}</span>
                      ) : null}
                    </span>
                    {!notification.read ? (
                      <span className={styles.dot} aria-label="Sin leer" />
                    ) : (
                      <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </ReportCard>
    </div>
  )
}
