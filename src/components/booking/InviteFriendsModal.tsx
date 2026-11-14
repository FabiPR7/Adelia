import { useEffect, useId } from 'react'
import PostBookingInvite from './PostBookingInvite'
import { useCustomerFriends } from '../../hooks/useCustomerFriends'
import styles from '../SupportMessageModal.module.css'

interface InviteFriendsModalProps {
  uid: string
  reservationId: string
  restaurantName: string
  alreadyInvitedIds: string[]
  onClose: () => void
}

/** «Invitar y competir» desde Mis reservas. */
function InviteFriendsModal({ uid, reservationId, restaurantName, alreadyInvitedIds, onClose }: InviteFriendsModalProps) {
  const titleId = useId()
  const { friends, loading } = useCustomerFriends(uid)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <h2 id={titleId} className={styles.title}>Invita a tu mesa en {restaurantName}</h2>
        <PostBookingInvite
          reservationId={reservationId}
          friends={friends}
          loading={loading}
          alreadyInvitedIds={alreadyInvitedIds}
        />
      </div>
    </div>
  )
}

export default InviteFriendsModal
