import type { ReservationInvite } from '../types/reservationInvites'
import { reservationInviteStatusLabel } from '../types/reservationInvites'
import styles from './ReservationInvitesModal.module.css'

interface ReservationInvitesModalProps {
  open: boolean
  invites: ReservationInvite[]
  onClose: () => void
}

function ReservationInvitesModal({ open, invites, onClose }: ReservationInvitesModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="invites-title">
      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2 id="invites-title">Invitaciones</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        {invites.length === 0 ? (
          <p className={styles.empty}>No hay invitaciones en esta reserva.</p>
        ) : (
          <ul className={styles.list}>
            {invites.map((invite) => (
              <li key={invite.id} className={styles.row}>
                {invite.toPhotoUrl ? (
                  <img src={invite.toPhotoUrl} alt="" className={styles.avatar} />
                ) : (
                  <span className={styles.avatarFallback} aria-hidden="true">
                    {(invite.toDisplayName.trim()[0] ?? '?').toUpperCase()}
                  </span>
                )}
                <div className={styles.meta}>
                  <strong>{invite.toDisplayName}</strong>
                  <span className={`${styles.status} ${styles[invite.status]}`}>
                    {reservationInviteStatusLabel(invite.status)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ReservationInvitesModal
