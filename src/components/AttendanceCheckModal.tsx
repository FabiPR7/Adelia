import { useMemo } from 'react'
import { dateToTimeInput } from '../utils/helpers'
import type { Reservation } from '../types'
import styles from './AttendanceCheckModal.module.css'

interface AttendanceCheckModalProps {
  isOpen: boolean
  hour: string
  reservations: Reservation[]
  tableMeta: Record<string, { name: string; capacity: number }>
  isSavingId: string | null
  onDismiss: () => void
  onMarkAttendance: (reservationId: string, status: 'confirmed' | 'cancelled') => Promise<void>
}

function AttendanceCheckModal({
  isOpen,
  hour,
  reservations,
  tableMeta,
  isSavingId,
  onDismiss,
  onMarkAttendance,
}: AttendanceCheckModalProps) {
  const hourReservations = useMemo(
    () =>
      reservations
        .filter((item) => dateToTimeInput(item.startTime) === hour)
        .sort((a, b) => a.clientName.localeCompare(b.clientName, 'es')),
    [hour, reservations],
  )

  if (!isOpen) {
    return null
  }

  return (
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
          <button type="button" className={styles.closeButton} onClick={onDismiss} aria-label="Cerrar">
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

                return (
                  <li key={reservation.id} className={styles.row}>
                    <span className={styles.client}>{reservation.clientName}</span>
                    <span className={styles.meta}>{table?.name ?? '—'}</span>
                    <span className={styles.meta}>{reservation.pax}</span>
                    <div className={styles.actions}>
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            className={styles.yesButton}
                            disabled={Boolean(isSavingId)}
                            onClick={() => void onMarkAttendance(reservation.id, 'confirmed')}
                          >
                            {isSaving ? '…' : 'Sí'}
                          </button>
                          <button
                            type="button"
                            className={styles.noButton}
                            disabled={Boolean(isSavingId)}
                            onClick={() => void onMarkAttendance(reservation.id, 'cancelled')}
                          >
                            {isSaving ? '…' : 'No'}
                          </button>
                        </>
                      ) : reservation.status === 'confirmed' ? (
                        <span className={styles.resultYes}>Sí · Confirmada</span>
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
          <button type="button" className={styles.laterButton} onClick={onDismiss}>
            Más tarde
          </button>
        </footer>
      </div>
    </div>
  )
}

export default AttendanceCheckModal
