import { useEffect, useRef } from 'react'
import type { Reservation, RestaurantTable } from '../types'
import styles from './ReservationTimeline.module.css'

interface ReservationTimelineProps {
  reservations: Reservation[]
  tables: RestaurantTable[]
  /** Abrir una reserva (editar o ver). Sin ella, los bloques no se pueden pulsar. */
  onOpen?: (reservation: Reservation) => void
}

type Tone = 'ok' | 'info' | 'warn' | 'muted' | 'danger'

function toneFor(reservation: Reservation, now: number): { tone: Tone; label: string } {
  if (reservation.status === 'cancelled') {
    return reservation.noShow ? { tone: 'danger', label: 'No vino' } : { tone: 'muted', label: 'Cancelada' }
  }
  if (reservation.status === 'confirmed') return { tone: 'ok', label: 'Asistió' }
  return reservation.startTime.getTime() <= now
    ? { tone: 'warn', label: 'Por marcar' }
    : { tone: 'info', label: 'Reservada' }
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function hhmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const LEGEND: Array<{ tone: Tone; label: string }> = [
  { tone: 'info', label: 'Reservada' },
  { tone: 'warn', label: 'Por marcar' },
  { tone: 'ok', label: 'Asistió' },
  { tone: 'muted', label: 'Cancelada' },
]

/** Vista de servicio: una fila por mesa y las horas en horizontal. */
function ReservationTimeline({ reservations, tables, onOpen }: ReservationTimelineProps) {
  const now = Date.now()
  const visible = reservations.filter((row) => row.status !== 'cancelled' || row.noShow)

  // Franja: de la primera reserva a la última (en horas enteras), como mínimo 12:00–16:00.
  const starts = visible.map((row) => minutesOfDay(row.startTime))
  const ends = visible.map((row) => {
    const end = minutesOfDay(row.endTime)
    return end <= minutesOfDay(row.startTime) ? 24 * 60 : end
  })
  const from = Math.min(12 * 60, ...starts.map((m) => Math.floor(m / 60) * 60))
  const to = Math.max(from + 4 * 60, ...ends.map((m) => Math.ceil(m / 60) * 60))
  const span = to - from
  const hours = Array.from({ length: span / 60 }, (_, index) => from + index * 60)

  const sortedTables = [...tables].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
  // Al abrir, se desplaza hasta la primera reserva del día (o ninguna si no hay).
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const firstStart = starts.length > 0 ? Math.min(...starts) : null
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || firstStart == null) return
    const trackWidth = scroller.scrollWidth - 140
    scroller.scrollLeft = Math.max(0, ((firstStart - from) / span) * trackWidth - 24)
  }, [firstStart, from, span])

  const unknownTable = visible.some((row) => !tables.some((table) => table.id === row.tableId))

  return (
    <section className={styles.wrap} aria-label="Reservas por mesa">
      <div className={styles.legend}>
        {LEGEND.map((item) => (
          <span key={item.tone} className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles[`tone_${item.tone}`]}`} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>

      {sortedTables.length === 0 ? (
        <p className={styles.empty}>Aún no tienes mesas. Añádelas en Mi restaurante → Mesas.</p>
      ) : (
        <div className={styles.scroller} ref={scrollerRef}>
          <div className={styles.grid} style={{ minWidth: `${140 + hours.length * 120}px` }}>
            <div className={styles.headRow}>
              <span className={styles.headCell}>Mesa</span>
              <div className={styles.hours} style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
                {hours.map((minute) => (
                  <span key={minute} className={styles.hour}>{hhmm(minute)}</span>
                ))}
              </div>
            </div>

            {sortedTables.map((table) => {
              const blocks = visible.filter((row) => row.tableId === table.id)
              return (
                <div key={table.id} className={styles.row}>
                  <div className={styles.tableCell}>
                    <span className={styles.tableName}>{table.name}</span>
                    <span className={styles.tableMeta}>{table.capacity} pers.</span>
                  </div>
                  <div className={styles.track} style={{ backgroundSize: `${100 / hours.length}% 100%` }}>
                    {blocks.map((row) => {
                      const start = minutesOfDay(row.startTime)
                      const rawEnd = minutesOfDay(row.endTime)
                      const end = rawEnd <= start ? 24 * 60 : rawEnd
                      const left = ((start - from) / span) * 100
                      const width = (Math.max(15, end - start) / span) * 100
                      const { tone, label } = toneFor(row, now)
                      const content = (
                        <>
                          <span className={styles.blockName}>{row.clientName || 'Cliente'}</span>
                          <span className={styles.blockMeta}>{hhmm(start)} · {row.pax} pers. · {label}</span>
                        </>
                      )
                      const style = { left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)` }
                      const className = `${styles.block} ${styles[`tone_${tone}`]}`
                      return onOpen ? (
                        <button
                          key={row.id}
                          type="button"
                          className={className}
                          style={style}
                          onClick={() => onOpen(row)}
                          aria-label={`${row.clientName || 'Cliente'}, ${hhmm(start)}, ${row.pax} personas, ${label}`}
                        >
                          {content}
                        </button>
                      ) : (
                        <div key={row.id} className={className} style={style}>{content}</div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {unknownTable ? (
        <p className={styles.note}>Hay reservas en mesas que ya no existen: míralas en la vista de lista.</p>
      ) : null}
    </section>
  )
}

export default ReservationTimeline
