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

/** Tonos cálidos para quien no tiene foto: siempre el mismo para la misma persona. */
const AVATAR_TONES = [
  ['#c9853f', '#8b4f1f'],
  ['#b5654a', '#7a3426'],
  ['#8f8a4a', '#5b5826'],
  ['#5f8a7a', '#2f5a4c'],
  ['#7a6aa8', '#4a3c78'],
  ['#b8576f', '#7d2c43'],
]

function avatarTone(id: string): string[] {
  let hash = 0
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

function FriendAvatar({ friend }: { friend: FriendProfile }) {
  if (friend.photoUrl) {
    return <img src={friend.photoUrl} alt="" className={styles.avatar} loading="lazy" />
  }
  const [from, to] = avatarTone(friend.id)
  return (
    <span
      className={`${styles.avatar} ${styles.avatarInitial}`}
      style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {(friend.displayName.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
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

  const count = selectedIds.length

  return (
    <section className={styles.box}>
      <header className={styles.header}>
        <span className={styles.badge} aria-hidden="true">⚔️</span>
        <div>
          <p className={styles.title}>{title}</p>
          <p className={styles.hint}>{hint}</p>
        </div>
      </header>

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
        <ul className={styles.grid}>
          {friends.map((friend) => {
            const checked = selectedIds.includes(friend.id)
            const disabled = !checked && count >= MAX_RESERVATION_INVITEES
            return (
              <li key={friend.id}>
                <button
                  type="button"
                  className={`${styles.friend} ${checked ? styles.friendOn : ''}`}
                  aria-pressed={checked}
                  disabled={disabled}
                  onClick={() => toggle(friend.id)}
                >
                  <span className={styles.avatarWrap}>
                    <FriendAvatar friend={friend} />
                    <span className={styles.level} aria-label={`Nivel ${friend.level}`}>{friend.level}</span>
                    {checked ? <span className={styles.check} aria-hidden="true">✓</span> : null}
                  </span>
                  <span className={styles.name}>{friend.displayName.split(' ')[0]}</span>
                  <span className={styles.sub}>
                    {friend.username ? `@${friend.username}` : friend.levelTitle}
                  </span>
                  <span className={styles.action}>{checked ? 'Invitado' : 'Invitar'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {count > 0 ? (
        <p className={styles.count}>
          {count === 1 ? 'Invitas a 1 amigo: puede retarte por la mesa.' : `Invitas a ${count} amigos: cualquiera puede retarte por la mesa.`}
        </p>
      ) : null}
    </section>
  )
}

export default BookingInviteFriends
