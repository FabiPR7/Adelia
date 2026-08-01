import { useEffect, useState } from 'react'
import {
  getMonthGrid,
  isSameDay,
  MONTH_NAMES,
  WEEKDAY_NAMES,
} from '../utils/helpers'
import styles from './Calendar.module.css'

interface CalendarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  reservationCounts?: Record<number, number>
  /** Si es false, las flechas de mes solo cambian la vista sin cerrar ni cambiar el día seleccionado. */
  updateSelectionOnMonthNav?: boolean
  onMonthChange?: (date: Date) => void
}

function Calendar({
  selectedDate,
  onSelectDate,
  reservationCounts = {},
  updateSelectionOnMonthNav = true,
  onMonthChange,
}: CalendarProps) {
  const [viewDate, setViewDate] = useState(selectedDate)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const days = getMonthGrid(year, month)
  const today = new Date()

  useEffect(() => {
    setViewDate(selectedDate)
  }, [selectedDate])

  const goToMonth = (offset: number) => {
    const next = new Date(viewDate)
    next.setMonth(next.getMonth() + offset)

    if (updateSelectionOnMonthNav) {
      onSelectDate(next)
      return
    }

    setViewDate(next)
    onMonthChange?.(next)
  }

  return (
    <section className={styles.calendar}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => goToMonth(-1)}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <h3 className={styles.title}>
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => goToMonth(1)}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </header>

      <div className={styles.weekdays}>
        {WEEKDAY_NAMES.map((day) => (
          <span key={day} className={styles.weekday}>
            {day}
          </span>
        ))}
      </div>

      <div className={styles.grid}>
        {days.map((day, index) => {
          if (!day) {
            return <span key={`empty-${index}`} className={styles.emptyDay} />
          }

          const count = reservationCounts[day.getDate()] ?? 0
          const isSelected = isSameDay(day, selectedDate)
          const isToday = isSameDay(day, today)

          return (
            <button
              key={day.toISOString()}
              type="button"
              className={[
                styles.day,
                isSelected ? styles.selected : '',
                isToday ? styles.today : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(day)}
            >
              <span className={styles.dayNumber}>{day.getDate()}</span>
              {count > 0 && (
                <span className={styles.dotRow}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, dotIndex) => (
                    <span key={dotIndex} className={styles.dot} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default Calendar
