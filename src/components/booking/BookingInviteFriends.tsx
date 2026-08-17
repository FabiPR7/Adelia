import type { FriendProfile } from '../../types/friends'
import { MAX_RESERVATION_INVITEES } from '../../types/reservationInvites'
import styles from './BookingInviteFriends.module.css'

interface BookingInviteFriendsProps {
  friends: FriendProfile[]
  loading: boolean
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

function BookingInviteFriends({
  friends,
  loading,
  selectedIds,
  onChange,
}: BookingInviteFriendsProps) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id))
      return
    }
    if (selectedIds.length >= MAX_RESERVATION_INVITEES) {
      return
    }
    onChange([...selectedIds, id])
  }

  return (
    <div className={styles.box}>
      <p className={styles.title}>Invitar amigos</p>
      <p className={styles.hint}>
        La reserva queda a tu nombre. Ellos reciben una invitación pendiente y pueden aceptar o rechazar.
      </p>
      {loading ? (
        <p className={styles.empty}>Cargando amigos…</p>
      ) : friends.length === 0 ? (
        <p className={styles.empty}>
          Aún no tienes amigos. Añádelos en Misiones para poder invitarlos.
        </p>
      ) : (
        <ul className={styles.list}>
          {friends.map((friend) => {
            const checked = selectedIds.includes(friend.id)
            const disabled = !checked && selectedIds.length >= MAX_RESERVATION_INVITEES
            return (
              <li key={friend.id}>
                <label className={`${styles.row} ${disabled ? styles.rowDisabled : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(friend.id)}
                  />
                  {friend.photoUrl ? (
                    <img src={friend.photoUrl} alt="" className={styles.avatar} />
                  ) : (
                    <span className={styles.avatarFallback} aria-hidden="true">
                      {(friend.displayName.trim()[0] ?? '?').toUpperCase()}
                    </span>
                  )}
                  <span className={styles.name}>{friend.displayName}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {selectedIds.length > 0 ? (
        <p className={styles.count}>
          {selectedIds.length} {selectedIds.length === 1 ? 'amigo seleccionado' : 'amigos seleccionados'}
        </p>
      ) : null}
    </div>
  )
}

export default BookingInviteFriends
