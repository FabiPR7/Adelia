import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCustomerNotifications } from '../hooks/useCustomerNotifications'
import {
  type CancellationPenaltyView,
} from '../data/cancellationPenalties'
import type { CustomerNotification } from '../types/notifications'
import styles from './CancellationPenaltyModal.module.css'

const SEEN_PREFIX = 'adelia:cancel-penalty-seen:'

function isCancelPenaltyNotification(notification: CustomerNotification): boolean {
  if (
    notification.type !== 'reservation_cancelled_by_client'
    && notification.type !== 'reservation_cancelled_by_restaurant'
  ) {
    return false
  }

  return typeof notification.data.strikeCount === 'number'
    && notification.data.strikeCount > 0
    && notification.data.shielded !== true
}

function penaltyFromNotification(notification: CustomerNotification): CancellationPenaltyView {
  const data = notification.data
  return {
    xpLost: typeof data.xpLost === 'number' ? data.xpLost : 0,
    percent: typeof data.percent === 'number' ? data.percent : 0,
    strikeCount: typeof data.strikeCount === 'number' ? data.strikeCount : 1,
    nextPercent: typeof data.nextPercent === 'number' ? data.nextPercent : null,
    promoLocked: data.promoLocked === true,
    justLocked: data.justLocked === true,
    warning: typeof data.warning === 'string' ? data.warning : '',
    xpAfter: typeof data.xpAfter === 'number' ? data.xpAfter : undefined,
  }
}

function wasSeen(notificationId: string): boolean {
  try {
    return sessionStorage.getItem(`${SEEN_PREFIX}${notificationId}`) === '1'
  } catch {
    return false
  }
}

function markSeen(notificationId: string): void {
  try {
    sessionStorage.setItem(`${SEEN_PREFIX}${notificationId}`, '1')
  } catch {
    // ignore
  }
}

export default function CancellationPenaltyModal() {
  const { refreshProfile } = useAuth()
  const { unreadNotifications, markRead } = useCustomerNotifications()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [penalty, setPenalty] = useState<CancellationPenaltyView | null>(null)
  const [byRestaurant, setByRestaurant] = useState(false)

  useEffect(() => {
    if (activeId) {
      return
    }

    const next = unreadNotifications.find(
      (notification) => isCancelPenaltyNotification(notification) && !wasSeen(notification.id),
    )

    if (!next) {
      return
    }

    setActiveId(next.id)
    setPenalty(penaltyFromNotification(next))
    setByRestaurant(next.type === 'reservation_cancelled_by_restaurant')
    void refreshProfile()
  }, [unreadNotifications, refreshProfile, activeId])

  if (!activeId || !penalty) {
    return null
  }

  const handleDismiss = () => {
    markSeen(activeId)
    void markRead(activeId)
    setActiveId(null)
    setPenalty(null)
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={handleDismiss}>
      <article
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-penalty-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className={styles.eyebrow}>
          {byRestaurant ? 'El restaurante canceló tu reserva' : 'Has cancelado tu reserva'}
        </p>
        <h2 id="cancel-penalty-title">Se te restan puntos</h2>
        <div className={styles.loss}>
          <strong>−{penalty.xpLost} XP</strong>
          {penalty.percent > 0 ? <span>−{penalty.percent}% de tu experiencia</span> : null}
        </div>
        <p className={styles.copy}>
          {penalty.xpLost > 0
            ? `Se te han restado ${penalty.xpLost} XP (−${penalty.percent}%).`
            : 'Esta cancelación ha contado como aviso en tu historial.'}
        </p>
        {penalty.promoLocked ? (
          <p className={styles.lock}>
            {penalty.justLocked
              ? 'A partir de ahora no puedes reservar ni canjear promociones.'
              : 'Tienes bloqueadas las reservas y los canjes de promoción.'}
          </p>
        ) : (
          <p className={styles.warning}>{penalty.warning}</p>
        )}
        <p className={styles.strike}>Cancelación {penalty.strikeCount} de 5</p>
        <button type="button" className={styles.button} onClick={handleDismiss}>
          Entendido
        </button>
      </article>
    </div>
  )
}
