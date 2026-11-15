import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { readCompanyOps } from '../data/companyOps.ts'
import { processReservationDepositOnCancel } from '../stripe/deposits.ts'
import { notifyReservationCancelled } from '../notifications/reservationEvents.ts'
import { cancelInvitesForReservation } from './invites.ts'

const OPEN_STATUSES = new Set(['completed', 'confirmed', 'pending'])

/**
 * Al eliminar la cuenta, sus reservas que aún no han pasado se cancelan como si
 * las cancelara el cliente: la fianza sigue la regla de siempre, se anulan las
 * invitaciones y el local recibe el aviso. Así no le quedan mesas reservadas por
 * alguien a quien ya no puede contactar.
 */
export async function cancelFutureReservationsOnAccountDeletion(
  uid: string,
  verifiedEmail: string,
): Promise<number> {
  const now = Timestamp.now()
  const queries = [
    adminDb.collection('reservations').where('customerUid', '==', uid),
    ...(verifiedEmail
      ? [adminDb.collection('reservations').where('clientEmail', '==', verifiedEmail)]
      : []),
  ]

  const seen = new Set<string>()
  let cancelled = 0

  for (const query of queries) {
    const snap = await query.get()
    for (const docSnap of snap.docs) {
      if (seen.has(docSnap.id)) continue
      seen.add(docSnap.id)
      const reservation = docSnap.data()
      if (!OPEN_STATUSES.has(String(reservation.status ?? ''))) continue
      const startMs = (reservation.startTime as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0
      if (startMs <= now.toMillis()) continue

      try {
        if (typeof reservation.companyId === 'string' && reservation.companyId) {
          const ops = await readCompanyOps(reservation.companyId)
          await processReservationDepositOnCancel({
            reservationId: docSnap.id,
            reservation,
            stripeAccountId: ops?.stripeAccountId as string | undefined,
            depositCancellationHours: typeof ops?.depositCancellationHours === 'number'
              ? ops.depositCancellationHours
              : null,
          })
        }

        await docSnap.ref.update({
          status: 'cancelled',
          cancelledBy: 'client',
          cancellationReason: 'account_deleted',
          cancelLockAt: FieldValue.delete(),
          updatedAt: Timestamp.now(),
        })
        cancelled += 1

        await cancelInvitesForReservation(docSnap.id).catch((error) => {
          console.error('account deletion: cancel invites error:', error)
        })
        await notifyReservationCancelled(
          docSnap.id,
          { ...reservation, status: 'cancelled', cancelledBy: 'client' },
          'client',
        ).catch((error) => {
          console.error('account deletion: cancel notification error:', error)
        })
      } catch (error) {
        // Una reserva que falla no frena el borrado de la cuenta; se anonimiza igual.
        console.error('account deletion: cancel reservation error:', docSnap.id, error)
      }
    }
  }

  return cancelled
}
