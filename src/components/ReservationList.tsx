import { formatTimeSpanish } from '../utils/helpers'
import type { Reservation } from '../types'
import styles from './ReservationList.module.css'

interface ReservationListProps {
  reservations: Reservation[]
  tableMeta: Record<string, { name: string; capacity: number }>
  selectedDate: Date
  onAdd: () => void
  onEdit: (reservation: Reservation) => void
  onDelete: (reservation: Reservation) => void
}

const STATUS_LABELS: Record<Reservation['status'], string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
}

function ReservationList({
  reservations,
  tableMeta,
  selectedDate,
  onAdd,
  onEdit,
  onDelete,
}: ReservationListProps) {
  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(selectedDate)

  const activeCount = reservations.filter((item) => item.status !== 'cancelled').length

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2>Reservas del día</h2>
          <p className={styles.date}>{formattedDate}</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.countBadge}>
            {activeCount} activa{activeCount === 1 ? '' : 's'}
          </span>
          <button type="button" className={styles.addButton} onClick={onAdd}>
            + Nueva
          </button>
        </div>
      </header>

      {reservations.length === 0 ? (
        <div className={styles.empty}>
          <p>No hay reservas para este día.</p>
          <button type="button" className={styles.addButton} onClick={onAdd}>
            Crear primera reserva
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tableHeader} aria-hidden="true">
            <span>Hora</span>
            <span>Cliente</span>
            <span>Mesa</span>
            <span>Pax</span>
            <span>Contacto</span>
            <span>Estado</span>
            <span />
          </div>
          <ul className={styles.list}>
            {reservations.map((reservation) => {
              const table = tableMeta[reservation.tableId]
              const isCancelled = reservation.status === 'cancelled'

              return (
                <li
                  key={reservation.id}
                  className={`${styles.row} ${isCancelled ? styles.rowCancelled : ''}`}
                >
                  <span className={styles.cellTime}>
                    {formatTimeSpanish(reservation.startTime)}
                    <small>{formatTimeSpanish(reservation.endTime)}</small>
                  </span>
                  <div className={styles.mobileBody}>
                    <div className={styles.mobileLine1}>
                      <span className={styles.cellClient}>{reservation.clientName}</span>
                      <span className={`${styles.status} ${styles[reservation.status]}`}>
                        {STATUS_LABELS[reservation.status]}
                      </span>
                    </div>
                    <div className={styles.mobileLine2}>
                      <span className={styles.cellTable}>{table?.name ?? '—'}</span>
                      <span className={styles.cellPax}>{reservation.pax} pax</span>
                      <span className={styles.cellContact}>
                        {reservation.clientPhone || reservation.clientEmail || '—'}
                      </span>
                    </div>
                  </div>
                  <span className={styles.cellActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => onEdit(reservation)}
                      aria-label={`Editar reserva de ${reservation.clientName}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                      onClick={() => onDelete(reservation)}
                      aria-label={`Eliminar reserva de ${reservation.clientName}`}
                    >
                      🗑
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

export default ReservationList
