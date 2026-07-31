import type { Reservation } from '../types'
import { formatTimeSpanish } from '../utils/helpers'
import styles from './ReservationList.module.css'

interface ReservationListProps {
  reservations: Reservation[]
  tableNames: Record<string, string>
  selectedDate: Date
}

const STATUS_LABELS: Record<Reservation['status'], string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
}

function ReservationList({
  reservations,
  tableNames,
  selectedDate,
}: ReservationListProps) {
  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(selectedDate)

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>Reservas del día</h2>
        <p className={styles.date}>{formattedDate}</p>
      </header>

      {reservations.length === 0 ? (
        <div className={styles.empty}>
          <p>No hay reservas para este día.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {reservations.map((reservation) => (
            <li key={reservation.id} className={styles.card}>
              <div className={styles.timeBlock}>
                <span className={styles.time}>
                  {formatTimeSpanish(reservation.startTime)}
                </span>
              </div>
              <div className={styles.details}>
                <strong>{reservation.clientName}</strong>
                <span>
                  {reservation.pax} personas ·{' '}
                  {tableNames[reservation.tableId] ?? reservation.tableId}
                </span>
              </div>
              <span
                className={`${styles.status} ${styles[reservation.status]}`}
              >
                {STATUS_LABELS[reservation.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ReservationList
