import { Link, useNavigate } from 'react-router-dom'
import { useCustomerNotifications } from '../../hooks/useCustomerNotifications'
import styles from './CustomerNotificationsTab.module.css'

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) {
    return 'Ahora'
  }

  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `Hace ${diffHours} h`
  }

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
}

function CustomerNotificationsTab() {
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
  } = useCustomerNotifications()

  const handleOpen = async (notificationId: string, actionUrl: string | null) => {
    await markRead(notificationId)
    if (actionUrl) {
      navigate(actionUrl)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Centro de avisos</p>
          <h1>Notificaciones</h1>
          <p className={styles.lead}>
            {unreadCount > 0
              ? `Tienes ${unreadCount} sin leer`
              : 'Estás al día con todo lo importante'}
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
          <p>Aún no tienes notificaciones.</p>
          <p className={styles.emptyHint}>Te avisaremos de reservas, premios, misiones y amigos.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={`${styles.item} ${notification.read ? styles.itemRead : styles.itemUnread}`}
                onClick={() => void handleOpen(notification.id, notification.actionUrl)}
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

      <p className={styles.footerHint}>
        También puedes revisar tus{' '}
        <Link to="/app/reservas">reservas</Link>
        {' '}y{' '}
        <Link to="/app/promociones">promociones</Link>
        .
      </p>
    </div>
  )
}

export default CustomerNotificationsTab
