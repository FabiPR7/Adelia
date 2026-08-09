import { useEffect, useMemo, useRef, useState } from 'react'
import Calendar from './Calendar'
import { computeReservationCountsByMonth } from '../services/firestore'
import type { Reservation } from '../types'
import { dateToIsoDate, formatDateSpanish } from '../utils/helpers'
import styles from './ClientReservationDatePicker.module.css'

interface ClientReservationDatePickerProps {
  value: string
  onChange: (isoDate: string) => void
  reservations: Reservation[]
  availableDates: string[]
}

function ClientReservationDatePicker({
  value,
  onChange,
  reservations,
  availableDates,
}: ClientReservationDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      return new Date(`${value}T12:00:00`)
    }

    if (availableDates[0]) {
      return new Date(`${availableDates[0]}T12:00:00`)
    }

    return new Date()
  })

  const rootRef = useRef<HTMLDivElement>(null)

  const selectedDate = useMemo(
    () => (value ? new Date(`${value}T12:00:00`) : viewDate),
    [value, viewDate],
  )

  const availableDateSet = useMemo(
    () => new Set(availableDates),
    [availableDates],
  )

  const reservationCounts = useMemo(
    () => computeReservationCountsByMonth(
      reservations,
      viewDate.getFullYear(),
      viewDate.getMonth(),
    ),
    [reservations, viewDate],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (value) {
      setViewDate(new Date(`${value}T12:00:00`))
    }
  }, [value])

  const handleSelectDate = (date: Date) => {
    onChange(dateToIsoDate(date))
    setOpen(false)
  }

  const label = value
    ? formatDateSpanish(new Date(`${value}T12:00:00`))
    : 'Todas las fechas'

  return (
    <div className={styles.wrapper} ref={rootRef}>
      <span className={styles.label}>Fecha</span>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Filtrar por fecha"
      >
        <span className={styles.triggerText}>{label}</span>
        <svg className={styles.triggerIcon} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Seleccionar fecha">
          <div className={styles.popoverActions}>
            <button
              type="button"
              className={`${styles.allDatesButton} ${!value ? styles.allDatesButtonActive : ''}`}
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Todas las fechas
            </button>
          </div>
          <Calendar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            reservationCounts={reservationCounts}
            updateSelectionOnMonthNav={false}
            onMonthChange={setViewDate}
            compact
            highlightSelection={Boolean(value)}
            isDateDisabled={(date) => !availableDateSet.has(dateToIsoDate(date))}
          />
        </div>
      )}
    </div>
  )
}

export default ClientReservationDatePicker
