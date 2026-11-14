import { Link } from 'react-router-dom'
import type { FriendProfile } from '../../types/friends'
import { MAX_RESERVATION_INVITEES } from '../../types/reservationInvites'
import styles from './BookingInviteFriends.module.css'

interface BookingInviteFriendsProps {
  friends: FriendProfile[]
  loading: boolean
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** Título y texto propios (por ejemplo, tras reservar). */
  title?: string
  hint?: string
}

/** Elegir amigos para invitar a una reserva (al reservar o después). */
function BookingInviteFriends({
  friends,
  loading,
  selectedIds,
  onChange,
  title = 'Invita a tus amigos y compite',
  hint = 'La reserva y sus premios van a tu nombre… pero cada invitado puede retarte a un minijuego. Quien gane se queda la mesa y los premios.',
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
      <p className={styles.title}>
        <span aria-hidden="true">⚔️ </span>
        {title}
      </p>
      <p className={styles.hint}>{hint}</p>
      {loading ? (
        <p className={styles.empty}>Cargando amigos…</p>
      ) : friends.length === 0 ? (
        <div className={styles.emptyBox}>
          <p className={styles.empty}>
            Aún no tienes amigos en Adelia. Añádelos y podrás invitarlos a tus mesas y retarlos.
          </p>
          <Link to="/app/misiones?ver=amigos" className={styles.findFriends}>
            Buscar amigos
          </Link>
        </div>
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
                  <span className={styles.name}>
                    {friend.displayName}
                    {friend.username ? <small className={styles.username}>@{friend.username}</small> : null}
                  </span>
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
