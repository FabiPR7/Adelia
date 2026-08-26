import { useMemo, useState } from 'react'
import { dateToTimeInput, formatTimeSpanish, isPastCalendarDate, isReservationStartInPast, startOfDay } from '../utils/helpers'
import type { Reservation } from '../types'
import styles from './ReservationList.module.css'

interface ReservationListProps {
  reservations: Reservation[]
  tableMeta: Record<string, { name: string; capacity: number }>
  selectedDate: Date
  canCreate?: boolean
  onAdd: () => void
  onEdit: (reservation: Reservation) => void
  onDelete: (reservation: Reservation) => void
  onOpenAttendance?: (hour: string) => void
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
  canCreate = true,
  onAdd,
  onEdit,
  onDelete,
  onOpenAttendance,
}: ReservationListProps) {
  const [nameSearchQuery, setNameSearchQuery] = useState('')
  const [hourFilter, setHourFilter] = useState('')

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(selectedDate)

  const reservationHours = useMemo(() => {
    const hours = new Set(reservations.map((item) => dateToTimeInput(item.startTime)))
    return [...hours].sort()
  }, [reservations])

  const isFutureDay =
    startOfDay(selectedDate).getTime() > startOfDay(new Date()).getTime()
  const isPastDay = isPastCalendarDate(selectedDate)

  const isReservationLocked = (reservation: Reservation) =>
    isReservationStartInPast(selectedDate, dateToTimeInput(reservation.startTime))

  const attendanceHours = useMemo(() => {
    if (isFutureDay) {
      return []
    }

    return reservationHours.filter((hour) => isReservationStartInPast(selectedDate, hour))
  }, [isFutureDay, reservationHours, selectedDate])

  const showAttendanceBar = attendanceHours.length > 0 && Boolean(onOpenAttendance)

  const filteredReservations = useMemo(() => {
    const query = nameSearchQuery.trim().toLowerCase()

    return reservations.filter((reservation) => {
      const matchesName =
        !query || reservation.clientName.toLowerCase().includes(query)
      const matchesHour =
        !hourFilter || dateToTimeInput(reservation.startTime) === hourFilter

      return matchesName && matchesHour
    })
  }, [reservations, nameSearchQuery, hourFilter])

  const hasFilters = Boolean(nameSearchQuery.trim() || hourFilter)
  const activeCount = filteredReservations.filter((item) => item.status !== 'cancelled').length

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
          {canCreate ? (
            <button type="button" className={styles.addButton} onClick={onAdd}>
              + Nueva
            </button>
          ) : null}
        </div>
      </header>

      {showAttendanceBar && (
        <div className={styles.attendanceBar}>
          <span className={styles.attendanceLabel}>Control de asistencia por hora</span>
          <div className={styles.attendanceHours}>
            {attendanceHours.map((hour) => {
              const pendingCount = reservations.filter(
                (item) =>
                  item.status === 'completed' && dateToTimeInput(item.startTime) === hour,
              ).length

              return (
                <button
                  key={hour}
                  type="button"
                  className={`${styles.attendanceHourButton} ${
                    pendingCount > 0 ? styles.attendanceHourPending : ''
                  }`}
                  onClick={() => onOpenAttendance?.(hour)}
                >
                  {hour}
                  {pendingCount > 0 && (
                    <span className={styles.attendancePendingBadge}>{pendingCount}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {reservations.length > 0 && (
        <div className={styles.filters}>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Buscar cliente</span>
            <input
              type="search"
              value={nameSearchQuery}
              onChange={(e) => setNameSearchQuery(e.target.value)}
              placeholder="Nombre del cliente…"
              aria-label="Buscar reserva por nombre de cliente"
            />
          </label>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Hora</span>
            <select
              value={hourFilter}
              onChange={(e) => setHourFilter(e.target.value)}
              aria-label="Filtrar por hora"
            >
              <option value="">Todas</option>
              {reservationHours.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
          </label>
          {hasFilters && (
            <button
              type="button"
              className={styles.filterClear}
              onClick={() => {
                setNameSearchQuery('')
                setHourFilter('')
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {reservations.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {isPastDay
              ? 'No hay reservas en este día anterior.'
              : 'No hay reservas para este día.'}
          </p>
          {canCreate ? (
            <button type="button" className={styles.addButton} onClick={onAdd}>
              Crear primera reserva
            </button>
          ) : null}
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className={styles.empty}>
          <p>Ninguna reserva coincide con los filtros.</p>
          <button
            type="button"
            className={styles.filterClearButton}
            onClick={() => {
              setNameSearchQuery('')
              setHourFilter('')
            }}
          >
            Limpiar filtros
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
            {filteredReservations.map((reservation) => {
              const table = tableMeta[reservation.tableId]
              const isCancelled = reservation.status === 'cancelled'
              const isLocked = isReservationLocked(reservation)

              return (
                <li
                  key={reservation.id}
                  className={`${styles.rowGroup} ${isCancelled ? styles.rowGroupCancelled : ''}`}
                >
                  <div className={`${styles.row} ${isCancelled ? styles.rowCancelled : ''}`}>
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
                      {isLocked ? (
                        <span className={styles.lockedHint}>Solo asistencia</span>
                      ) : (
                        <>
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
                        </>
                      )}
                    </span>
                  </div>
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
