import { Link } from 'react-router-dom'
import { useCustomerNotifications } from '../hooks/useCustomerNotifications'
import styles from './CustomerNotificationsBell.module.css'

export default function CustomerNotificationsBell() {
  const { unreadCount } = useCustomerNotifications()

  return (
    <Link
      to="/app/notificaciones"
      className={styles.bell}
      aria-label={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Notificaciones'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3a5 5 0 0 0-5 5v2.1c0 .5-.2 1-.5 1.4L5.1 13.8A1 1 0 0 0 6 15h12a1 1 0 0 0 .9-1.5l-1.4-2.3c-.3-.4-.5-.9-.5-1.4V8a5 5 0 0 0-5-5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M10 18a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {unreadCount > 0 ? (
        <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
      ) : null}
    </Link>
  )
}
