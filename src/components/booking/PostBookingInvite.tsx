import { useState } from 'react'
import { Link } from 'react-router-dom'
import BookingInviteFriends from './BookingInviteFriends'
import { inviteFriendsToReservation } from '../../services/customerReservationInvites'
import type { FriendProfile } from '../../types/friends'
import styles from './PostBookingInvite.module.css'

interface PostBookingInviteProps {
  reservationId: string
  friends: FriendProfile[]
  loading: boolean
  /** Amigos ya invitados al reservar. */
  alreadyInvitedIds: string[]
}

/** Tras reservar: invita a tus amigos (o búscalos) para que compitan por la mesa. */
function PostBookingInvite({ reservationId, friends, loading, alreadyInvitedIds }: PostBookingInviteProps) {
  const [invitedIds, setInvitedIds] = useState<string[]>(alreadyInvitedIds)
  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invitedNames = friends.filter((friend) => invitedIds.includes(friend.id)).map((friend) => friend.displayName)
  const available = friends.filter((friend) => !invitedIds.includes(friend.id))

  const handleInvite = async () => {
    if (selected.length === 0) return
    setSending(true)
    setError(null)
    try {
      const result = await inviteFriendsToReservation(reservationId, selected)
      // Solo cuentan como invitados los que el servidor ha invitado de verdad.
      const nowInvited = result.invites
        .filter((invite) => invite.status === 'pending' || invite.status === 'accepted')
        .map((invite) => invite.toUid)
      setInvitedIds((current) => [...new Set([...current, ...nowInvited])])
      setSelected([])
      if (result.created === 0) {
        setError('No se ha enviado ninguna invitación nueva: ya estaban invitados o ya no sois amigos.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la invitación.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={styles.card} aria-label="Invitar amigos a esta reserva">
      {invitedNames.length > 0 ? (
        <p className={styles.sent}>
          <strong>Invitación enviada a {invitedNames.join(', ')}.</strong> Si aceptan, podrán retarte a un minijuego
          por la mesa. ¡Defiende tu reserva!
        </p>
      ) : null}

      {loading || available.length > 0 || friends.length === 0 ? (
        <BookingInviteFriends
          friends={available}
          loading={loading}
          selectedIds={selected}
          onChange={setSelected}
          title={invitedNames.length > 0 ? '¿Invitas a alguien más?' : '¿Te acompaña alguien? Invítale y compite'}
          hint="Tus amigos reciben la invitación al momento. Si te retan y ganan, la reserva y sus premios pasan a su nombre."
        />
      ) : null}

      {selected.length > 0 ? (
        <button type="button" className={styles.inviteButton} onClick={() => void handleInvite()} disabled={sending}>
          {sending ? 'Enviando…' : `Invitar a ${selected.length} ${selected.length === 1 ? 'amigo' : 'amigos'}`}
        </button>
      ) : null}

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {friends.length > 0 ? (
        <Link to="/app/misiones?ver=amigos" className={styles.moreFriends}>
          Buscar más amigos →
        </Link>
      ) : null}
    </section>
  )
}

export default PostBookingInvite
