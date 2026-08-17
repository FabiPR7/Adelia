import { useCompanyNotifications } from '../../hooks/useCompanyNotifications'
import type { CompanyTab } from '../../types/company'
import styles from '../customer/CustomerNotificationsTab.module.css'

interface CompanyCompiteNotificationsProps {
  onOpenTab: (tab: CompanyTab) => void
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
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Compite</p>
          <h1>Notificaciones</h1>
          <p className={styles.lead}>
            {unreadCount > 0
              ? `Tienes ${unreadCount} sin leer: misiones, niveles, Adelinas y estrellas.`
              : 'Estás al día con misiones, niveles y puntuación.'}
          </p>
        </div>
        {unreadCount > 0 ? (
          <button type="button" className={styles.markAllButton} onClick={() => void markAllRead()}>
            Marcar todo leído
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className={styles.loading}>Cargando notificaciones…</div>
      ) : notifications.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">🔔</span>
          <p>Aún no hay avisos de Compite.</p>
          <p className={styles.emptyHint}>
            Te avisaremos al completar misiones, subir de nivel, recibir reseñas o si suben o bajan tus estrellas y Adelinas.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={`${styles.item} ${notification.read ? styles.itemRead : styles.itemUnread}`}
                onClick={() => void handleOpen(notification.id, notification.actionTab)}
              >
                <span className={styles.icon} aria-hidden="true">{notification.icon}</span>
                <span className={styles.content}>
                  <span className={styles.itemHeader}>
                    <strong>{notification.title}</strong>
                    <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
                  </span>
                  <span className={styles.body}>{notification.body}</span>
                  {notification.actionLabel ? (
                    <span className={styles.action}>{notification.actionLabel} →</span>
                  ) : null}
                </span>
                {!notification.read ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
