import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  // El calendario flota con position: fixed para que ningún contenedor con
  // overflow: hidden (p. ej. la ficha del cliente) lo recorte.
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPosition(null)
      return
    }

    const GAP = 6
    const MARGIN = 12

    const place = () => {
      const trigger = triggerRef.current
      const popover = popoverRef.current

      if (!trigger || !popover) {
        return
      }

      const rect = trigger.getBoundingClientRect()
      const width = popover.offsetWidth
      const height = popover.offsetHeight
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom - MARGIN
      const spaceAbove = rect.top - MARGIN
      const openUp = spaceBelow < height + GAP && spaceAbove > spaceBelow
      const top = openUp
        ? Math.max(MARGIN, rect.top - height - GAP)
        : Math.min(rect.bottom + GAP, Math.max(MARGIN, viewportHeight - height - MARGIN))
      const left = Math.min(
        Math.max(MARGIN, rect.left),
        Math.max(MARGIN, viewportWidth - width - MARGIN),
      )

      setPopoverPosition({ top, left })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)

    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

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
        ref={triggerRef}
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
        <div
          ref={popoverRef}
          className={styles.popover}
          role="dialog"
          aria-label="Seleccionar fecha"
          style={
            popoverPosition
              ? { top: popoverPosition.top, left: popoverPosition.left }
              : { visibility: 'hidden' }
          }
        >
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
