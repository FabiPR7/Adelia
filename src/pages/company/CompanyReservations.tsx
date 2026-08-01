import { useCallback, useEffect, useMemo, useState } from 'react'
import Calendar from '../../components/Calendar'
import ConfirmDialog from '../../components/ConfirmDialog'
import ReservationFormModal from '../../components/ReservationFormModal'
import ReservationList from '../../components/ReservationList'
import { useAuth } from '../../context/AuthContext'
import {
  computeReservationCountsByMonth,
  createReservation,
  deleteReservation,
  filterReservationsForDate,
  getFirestoreErrorMessage,
  getReservationsByCompany,
  getTablesByCompany,
  tablesToMeta,
  updateReservation,
} from '../../services/firestore'
import type { Reservation, ReservationFormData } from '../../types'
import type { RestaurantTable } from '../../types'
import { formatDateSpanish, defaultSchedule } from '../../utils/helpers'
import styles from './CompanyReservations.module.css'

interface CompanyReservationsProps {
  companyId: string
}

function sortReservations(items: Reservation[]) {
  return [...items].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}

function CompanyReservations({ companyId }: CompanyReservationsProps) {
  const { company } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [allReservations, setAllReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarViewDate, setCalendarViewDate] = useState(new Date())

  const durationMinutes = company?.timeSlotMinutes ?? 120

  const reservations = useMemo(
    () => filterReservationsForDate(allReservations, selectedDate),
    [allReservations, selectedDate],
  )

  const reservationCounts = useMemo(
    () =>
      computeReservationCountsByMonth(
        allReservations,
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
      ),
    [allReservations, selectedDate],
  )

  const tableMeta = useMemo(() => tablesToMeta(tables), [tables])

  const calendarModalCounts = useMemo(
    () =>
      computeReservationCountsByMonth(
        allReservations,
        calendarViewDate.getFullYear(),
        calendarViewDate.getMonth(),
      ),
    [allReservations, calendarViewDate],
  )

  const shiftSelectedDate = (days: number) => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + days)
    setSelectedDate(next)
  }

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date)
    setCalendarOpen(false)
  }

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    setError(null)

    try {
      const [reservationRows, tableRows] = await Promise.all([
        getReservationsByCompany(companyId),
        getTablesByCompany(companyId),
      ])

      setAllReservations(reservationRows)
      setTables(tableRows)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      if (refresh) {
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
      }
    }
  }, [companyId])

  const handleRefresh = () => {
    void loadData(true)
  }

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (calendarOpen) {
      setCalendarViewDate(selectedDate)
    }
  }, [calendarOpen, selectedDate])

  const handleOpenCreate = () => {
    setEditingReservation(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (reservation: Reservation) => {
    setEditingReservation(reservation)
    setModalOpen(true)
  }

  const handleDelete = (reservation: Reservation) => {
    setReservationToDelete(reservation)
  }

  const handleConfirmDelete = async () => {
    if (!reservationToDelete) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await deleteReservation(reservationToDelete.id)
      setReservationToDelete(null)
      setAllReservations((current) =>
        current.filter((reservation) => reservation.id !== reservationToDelete.id),
      )
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSubmit = async (form: ReservationFormData) => {
    setIsSaving(true)
    setError(null)

    const schedule = company?.schedule ?? defaultSchedule()

    try {
      if (editingReservation) {
        const updated = await updateReservation(
          editingReservation.id,
          companyId,
          selectedDate,
          form,
          durationMinutes,
          schedule,
          reservations,
        )

        setAllReservations((current) =>
          sortReservations(
            current.map((reservation) =>
              reservation.id === updated.id ? updated : reservation,
            ),
          ),
        )
      } else {
        const created = await createReservation(
          companyId,
          selectedDate,
          form,
          durationMinutes,
          schedule,
          reservations,
        )

        setAllReservations((current) => sortReservations([...current, created]))
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error(getFirestoreErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const today = new Date()
  const isToday = selectedDate.toDateString() === today.toDateString()

  return (
    <div className={styles.wrapper}>
      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <div>
            <span className={styles.heroLabel}>{isToday ? 'Hoy' : 'Día seleccionado'}</span>
            <h2>{formatDateSpanish(selectedDate)}</h2>
          </div>
          <div className={styles.mobileDateNav}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => shiftSelectedDate(-1)}
              aria-label="Día anterior"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setCalendarOpen(true)}
              aria-label="Abrir calendario"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 3v4M16 3v4M3 10h18" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => shiftSelectedDate(1)}
              aria-label="Día siguiente"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            aria-label="Actualizar reservas"
          >
            <svg
              className={isRefreshing ? styles.refreshIconSpinning : undefined}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            <span>{isRefreshing ? 'Actualizando…' : 'Actualizar'}</span>
          </button>
          <button
            type="button"
            className={styles.todayButton}
            onClick={() => setSelectedDate(new Date())}
          >
            Ir a hoy
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleOpenCreate}>
            + Nueva reserva
          </button>
        </div>
      </section>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.layout}>
        <aside className={styles.calendarPane}>
          <Calendar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            reservationCounts={reservationCounts}
          />
        </aside>

        <div className={styles.listPane}>
          {isLoading ? (
            <p className={styles.loading}>Cargando reservas…</p>
          ) : (
            <ReservationList
              reservations={reservations}
              tableMeta={tableMeta}
              selectedDate={selectedDate}
              onAdd={handleOpenCreate}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {calendarOpen && (
        <div
          className={styles.calendarOverlay}
          onClick={() => setCalendarOpen(false)}
          role="presentation"
        >
          <div
            className={styles.calendarModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar fecha"
          >
            <Calendar
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              reservationCounts={calendarModalCounts}
              updateSelectionOnMonthNav={false}
              onMonthChange={setCalendarViewDate}
            />
          </div>
        </div>
      )}

      <ReservationFormModal
        isOpen={modalOpen}
        selectedDate={selectedDate}
        tables={tables}
        schedule={company?.schedule ?? defaultSchedule()}
        durationMinutes={durationMinutes}
        dayReservations={reservations}
        reservation={editingReservation}
        isSaving={isSaving}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        isOpen={Boolean(reservationToDelete)}
        title="Eliminar reserva"
        message="¿Estás seguro de eliminar esta reserva?"
        confirmLabel="Eliminar"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setReservationToDelete(null)}
      />
    </div>
  )
}

export default CompanyReservations
