import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useCustomerNotifications } from '../../hooks/useCustomerNotifications'
import {
  acceptReservationInvite,
  rejectReservationInvite,
} from '../../services/customerReservationInvites'
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
  const [inviteActionId, setInviteActionId] = useState<string | null>(null)
  const [resolvedInviteIds, setResolvedInviteIds] = useState<string[]>([])
  const [inviteError, setInviteError] = useState<string | null>(null)

  const handleOpen = async (notificationId: string, actionUrl: string | null) => {
    await markRead(notificationId)
    if (actionUrl) {
      navigate(actionUrl)
    }
  }

  const handleInviteDecision = async (
    notificationId: string,
    inviteId: string,
    decision: 'accept' | 'reject',
  ) => {
    setInviteActionId(inviteId)
    setInviteError(null)
    try {
      if (decision === 'accept') {
        await acceptReservationInvite(inviteId)
      } else {
        await rejectReservationInvite(inviteId)
      }
      setResolvedInviteIds((current) => current.includes(inviteId) ? current : [...current, inviteId])
      await markRead(notificationId)
      if (decision === 'accept') {
        navigate('/app/reservas')
      }
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'No se pudo responder a la invitación.')
    } finally {
      setInviteActionId(null)
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
          {inviteError ? <li className={styles.inviteError}>{inviteError}</li> : null}
          {notifications.map((notification) => {
            const inviteId = notification.data.inviteId
            const isInvite = notification.type === 'reservation_invite_received' && Boolean(inviteId)
            const inviteResolved = Boolean(inviteId && resolvedInviteIds.includes(inviteId))

            return (
              <li key={notification.id}>
                <div
                  className={`${styles.item} ${notification.read ? styles.itemRead : styles.itemUnread}`}
                >
                  <button
                    type="button"
                    className={styles.itemMain}
                    onClick={() => void handleOpen(notification.id, isInvite ? null : notification.actionUrl)}
                  >
                    <span className={styles.icon} aria-hidden="true">{notification.icon}</span>
                    <span className={styles.content}>
                      <span className={styles.itemHeader}>
                        <strong>{notification.title}</strong>
                        <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
                      </span>
                      <span className={styles.body}>{notification.body}</span>
                      {!isInvite && notification.actionLabel ? (
                        <span className={styles.action}>{notification.actionLabel} →</span>
                      ) : null}
                    </span>
                    {!notification.read ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
                  </button>
                  {isInvite && inviteId && !inviteResolved ? (
                    <div className={styles.inviteActions}>
                      <button
                        type="button"
                        className={styles.acceptInvite}
                        disabled={inviteActionId === inviteId}
                        onClick={() => void handleInviteDecision(notification.id, inviteId, 'accept')}
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        className={styles.rejectInvite}
                        disabled={inviteActionId === inviteId}
                        onClick={() => void handleInviteDecision(notification.id, inviteId, 'reject')}
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : null}
                  {isInvite && inviteResolved ? (
                    <p className={styles.inviteDone}>Invitación respondida</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className={styles.footerHint}>
        También puedes revisar tus{' '}
        <Link to="/app/reservas">reservas y consumo</Link>
        {' '}y{' '}
        <Link to="/app/promociones">promociones</Link>
        .
      </p>
    </div>
  )
}

export default CustomerNotificationsTab
