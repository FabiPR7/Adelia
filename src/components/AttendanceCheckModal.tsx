import { useMemo, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { dateToTimeInput } from '../utils/helpers'
import type { PromotionVisitStatus, Reservation } from '../types'
import { formatMinimumSpendLabel } from '../utils/promotionOffer'
import {
  reservationHasMinimumSpendRequirement,
  reservationNeedsMinimumSpendReview,
} from '../utils/reservationPromotionEligibility'
import { formatCentsAsEuros } from '../utils/minimumSpendVerification'
import {
  buildDepositCancelConfirmCopy,
  reservationHasAuthorizedDeposit,
} from '../utils/reservationDeposit'
import styles from './AttendanceCheckModal.module.css'

interface AttendanceCheckModalProps {
  isOpen: boolean
  hour: string
  reservations: Reservation[]
  tableMeta: Record<string, { name: string; capacity: number }>
  isSavingId: string | null
  depositCancellationHours: number | null | undefined
  onDismiss: () => void
  onMarkAttendance: (
    reservationId: string,
    status: 'confirmed' | 'cancelled',
    promotionVisitStatus?: PromotionVisitStatus,
  ) => Promise<void>
}

function AttendanceCheckModal({
  isOpen,
  hour,
  reservations,
  tableMeta,
  isSavingId,
  depositCancellationHours,
  onDismiss,
  onMarkAttendance,
}: AttendanceCheckModalProps) {
  const [pendingCancelReservation, setPendingCancelReservation] = useState<Reservation | null>(null)

  const hourReservations = useMemo(
    () =>
      reservations
        .filter((item) => dateToTimeInput(item.startTime) === hour)
        .sort((a, b) => a.clientName.localeCompare(b.clientName, 'es')),
    [hour, reservations],
  )

  if (!isOpen && !pendingCancelReservation) {
    return null
  }

  const handleDismiss = () => {
    setPendingCancelReservation(null)
    onDismiss()
  }

  const handleAttendanceYes = (reservation: Reservation) => {
    const promotionVisitStatus: PromotionVisitStatus =
      reservationHasMinimumSpendRequirement(reservation)
        ? 'pending'
        : reservation.promotionId
          ? 'eligible'
          : 'n/a'
    void onMarkAttendance(reservation.id, 'confirmed', promotionVisitStatus)
  }

  const handleAttendanceNo = (reservation: Reservation) => {
    if (reservationHasAuthorizedDeposit(reservation)) {
      setPendingCancelReservation(reservation)
      return
    }

    void onMarkAttendance(reservation.id, 'cancelled', 'n/a')
  }

  const depositCancelCopy = pendingCancelReservation
    ? buildDepositCancelConfirmCopy(pendingCancelReservation, depositCancellationHours)
    : null

  return (
    <>
    {isOpen ? (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="attendance-title">Control de asistencia</h2>
            <p className={styles.subtitle}>Reservas de las {hour}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={handleDismiss} aria-label="Cerrar">
            ×
          </button>
        </header>

        {hourReservations.length === 0 ? (
          <p className={styles.empty}>No hay reservas a esta hora.</p>
        ) : (
          <div className={styles.tableWrap}>
            <div className={styles.tableHead} aria-hidden="true">
              <span>Cliente</span>
              <span>Mesa</span>
              <span>Pax</span>
              <span>¿Asistió?</span>
            </div>
            <ul className={styles.list}>
              {hourReservations.map((reservation) => {
                const table = tableMeta[reservation.tableId]
                const isPending = reservation.status === 'completed'
                const isSaving = isSavingId === reservation.id
                const minSpendLabel =
                  reservationHasMinimumSpendRequirement(reservation)
                  && reservation.minimumSpendCents != null
                    ? formatMinimumSpendLabel(reservation.minimumSpendCents)
                    : null
                const verification = reservation.minSpendVerification

                return (
                  <li key={reservation.id} className={styles.row}>
                    <span className={styles.client}>
                      {reservation.clientName}
                      {minSpendLabel && (isPending || reservationNeedsMinimumSpendReview(reservation)) ? (
                        <span className={styles.minSpendHint}>{minSpendLabel}</span>
                      ) : null}
                      {verification ? (
                        <span className={styles.verificationHint}>
                          Verificado: {formatCentsAsEuros(verification.totalCents)}
                          {verification.lineItems.length > 0
                            ? ` · ${verification.lineItems.length} producto${verification.lineItems.length === 1 ? '' : 's'}`
                            : ''}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.meta}>{table?.name ?? '—'}</span>
                    <span className={styles.meta}>{reservation.pax}</span>
                    <div className={styles.actions}>
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            className={styles.yesButton}
                            disabled={Boolean(isSavingId)}
                            onClick={() => handleAttendanceYes(reservation)}
                          >
                            {isSaving ? '…' : 'Sí'}
                          </button>
                          <button
                            type="button"
                            className={styles.noButton}
                            disabled={Boolean(isSavingId)}
                            onClick={() => handleAttendanceNo(reservation)}
                          >
                            {isSaving ? '…' : 'No'}
                          </button>
                        </>
                      ) : reservation.status === 'confirmed' ? (
                        <span className={styles.resultYes}>
                          Sí · Confirmada
                          {verification
                            ? verification.meetsMinimumSpend
                              ? ' · Mínimo OK'
                              : ' · Sin mínimo'
                            : reservationNeedsMinimumSpendReview(reservation)
                              ? ' · Verificar en app'
                              : ''}
                        </span>
                      ) : (
                        <span className={styles.resultNo}>No · Cancelada</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <footer className={styles.footer}>
          <button type="button" className={styles.laterButton} onClick={handleDismiss}>
            Más tarde
          </button>
        </footer>
      </div>
    </div>
    ) : null}

    <ConfirmDialog
      isOpen={Boolean(pendingCancelReservation && depositCancelCopy)}
      title={depositCancelCopy?.title ?? 'Reserva con fianza'}
      message={depositCancelCopy?.message ?? ''}
      confirmLabel="Sí, cancelar"
      cancelLabel="Volver"
      variant="danger"
      elevated
      isLoading={Boolean(isSavingId && pendingCancelReservation?.id === isSavingId)}
      onConfirm={() => {
        if (!pendingCancelReservation) {
          return
        }

        const reservationId = pendingCancelReservation.id
        setPendingCancelReservation(null)
        void onMarkAttendance(reservationId, 'cancelled', 'n/a')
      }}
      onCancel={() => setPendingCancelReservation(null)}
    />
    </>
  )
}

export default AttendanceCheckModal
