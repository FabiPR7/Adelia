import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  CompanySchedule,
  Reservation,
  ReservationFormData,
  ReservationStatus,
  RestaurantTable,
} from '../types'
import { dateToTimeInput, isReservationStartInPast } from '../utils/helpers'
import {
  formatSlotEndTime,
  generateSlotTimes,
  getDaySchedule,
  getHourSlotStates,
  getSlotStatesForTable,
  getTableStatesForSlot,
  isSlotAvailableForTable,
} from '../utils/reservationSlots'
import styles from './ReservationFormModal.module.css'

interface ReservationFormModalProps {
  isOpen: boolean
  selectedDate: Date
  tables: RestaurantTable[]
  schedule: CompanySchedule
  durationMinutes: number
  dayReservations: Reservation[]
  reservation?: Reservation | null
  isSaving: boolean
  onClose: () => void
  onSubmit: (form: ReservationFormData) => Promise<void>
}

type PickerMode = 'table' | 'time'

const EMPTY_FORM: ReservationFormData = {
  clientName: '',
  clientEmail: '',
  clientPhone: '',
  pax: 2,
  tableId: '',
  time: '',
  status: 'confirmed',
}

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
]

function ReservationFormModal({
  isOpen,
  selectedDate,
  tables,
  schedule,
  durationMinutes,
  dayReservations,
  reservation,
  isSaving,
  onClose,
  onSubmit,
}: ReservationFormModalProps) {
  const [form, setForm] = useState<ReservationFormData>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [pickerMode, setPickerMode] = useState<PickerMode>('table')

  const isEditing = Boolean(reservation)
  const excludeId = reservation?.id

  const daySchedule = getDaySchedule(selectedDate, schedule)
  const allSlots = useMemo(
    () => generateSlotTimes(selectedDate, schedule, durationMinutes, durationMinutes),
    [selectedDate, schedule, durationMinutes],
  )

  const slotStates = useMemo(() => {
    if (pickerMode !== 'table' || !form.tableId) {
      return []
    }

    return getSlotStatesForTable(
      form.tableId,
      selectedDate,
      schedule,
      durationMinutes,
      durationMinutes,
      dayReservations,
      excludeId,
    )
  }, [pickerMode, form.tableId, selectedDate, schedule, durationMinutes, dayReservations, excludeId])

  const hourSlotStates = useMemo(
    () =>
      getHourSlotStates(
        selectedDate,
        schedule,
        durationMinutes,
        durationMinutes,
        tables,
        dayReservations,
        excludeId,
      ),
    [selectedDate, schedule, durationMinutes, tables, dayReservations, excludeId],
  )

  const tableStates = useMemo(() => {
    if (pickerMode !== 'time' || !form.time) {
      return []
    }

    return getTableStatesForSlot(
      form.time,
      selectedDate,
      durationMinutes,
      tables,
      dayReservations,
      excludeId,
    )
  }, [pickerMode, form.time, selectedDate, durationMinutes, tables, dayReservations, excludeId])

  const selectedTable = tables.find((table) => table.id === form.tableId)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (reservation) {
      setForm({
        clientName: reservation.clientName,
        clientEmail: reservation.clientEmail,
        clientPhone: reservation.clientPhone,
        pax: reservation.pax,
        tableId: reservation.tableId,
        time: dateToTimeInput(reservation.startTime),
        status: reservation.status,
      })
    } else {
      setForm({
        ...EMPTY_FORM,
        tableId: '',
        time: '',
      })
    }

    setPickerMode('table')
    setError(null)
  }, [isOpen, reservation])

  const handleModeChange = (mode: PickerMode) => {
    setPickerMode(mode)
    setForm((current) => ({ ...current, tableId: '', time: '' }))
  }

  const handleSelectTable = (tableId: string) => {
    setForm((current) => {
      const next = { ...current, tableId }

      if (
        pickerMode === 'table' &&
        current.time &&
        !isSlotAvailableForTable(
          tableId,
          current.time,
          selectedDate,
          durationMinutes,
          dayReservations,
          excludeId,
        )
      ) {
        next.time = ''
      }

      return next
    })
  }

  const handleSelectTableByHour = (tableId: string, available: boolean) => {
    if (!available || !form.time) {
      return
    }

    setForm((current) => ({ ...current, tableId }))
  }

  const handleSelectTime = (time: string, available: boolean) => {
    if (!available) {
      return
    }

    if (pickerMode === 'table') {
      if (!form.tableId) {
        return
      }

      setForm((current) => ({ ...current, time }))
      return
    }

    setForm((current) => {
      const next = { ...current, time }

      if (
        current.tableId &&
        !isSlotAvailableForTable(
          current.tableId,
          time,
          selectedDate,
          durationMinutes,
          dayReservations,
          excludeId,
        )
      ) {
        next.tableId = ''
      }

      return next
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!form.clientName.trim()) {
      setError('Indica el nombre del cliente.')
      return
    }

    if (!form.clientPhone.trim()) {
      setError('El teléfono es obligatorio.')
      return
    }

    if (!form.tableId) {
      setError('Selecciona una mesa.')
      return
    }

    if (!form.time) {
      setError('Selecciona una hora disponible.')
      return
    }

    if (form.pax < 1) {
      setError('Indica al menos 1 persona.')
      return
    }

    if (selectedTable && form.pax > selectedTable.capacity) {
      setError(`La mesa "${selectedTable.name}" admite máximo ${selectedTable.capacity} personas.`)
      return
    }

    if (form.status !== 'cancelled' && isReservationStartInPast(selectedDate, form.time)) {
      setError('No se pueden hacer reservas en fechas u horas pasadas.')
      return
    }

    const slotOk = isSlotAvailableForTable(
      form.tableId,
      form.time,
      selectedDate,
      durationMinutes,
      dayReservations,
      excludeId,
    )

    if (form.status !== 'cancelled' && !slotOk) {
      setError('Esa mesa ya está reservada a esa hora.')
      return
    }

    try {
      await onSubmit(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la reserva.')
    }
  }

  if (!isOpen) {
    return null
  }

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(selectedDate)

  const renderTableTiles = (
    options: { tableId: string; available: boolean }[],
    requireAvailable: boolean,
  ) => (
    <div className={styles.tileGrid}>
      {tables.map((table) => {
        const state = options.find((item) => item.tableId === table.id)
        const available = state?.available ?? true
        const isSelected = form.tableId === table.id && (!requireAvailable || available)

        return (
          <button
            key={table.id}
            type="button"
            disabled={requireAvailable && !available}
            className={[
              styles.tile,
              !available && requireAvailable ? styles.tileUnavailable : '',
              isSelected ? styles.tileSelected : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() =>
              requireAvailable
                ? handleSelectTableByHour(table.id, available)
                : handleSelectTable(table.id)
            }
          >
            <span className={styles.tileTitle}>{table.name}</span>
            <span className={styles.tileMeta}>
              {requireAvailable && !available ? 'Ocupada' : `${table.capacity} pax`}
            </span>
          </button>
        )
      })}
    </div>
  )

  const renderTimeTiles = (slots: { time: string; available: boolean }[], requireTable: boolean) => (
    <div className={styles.tileGrid}>
      {slots.map((slot) => (
        <button
          key={slot.time}
          type="button"
          disabled={!slot.available || (requireTable && !form.tableId)}
          className={[
            styles.tile,
            styles.timeTile,
            !slot.available ? styles.tileUnavailable : '',
            form.time === slot.time && slot.available ? styles.tileSelected : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => handleSelectTime(slot.time, slot.available)}
        >
          <span className={styles.tileTitle}>{slot.time}</span>
          <span className={styles.tileMeta}>
            {slot.available
              ? `→ ${formatSlotEndTime(slot.time, durationMinutes)}`
              : 'Completo'}
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-modal-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="reservation-modal-title">
              {isEditing ? 'Editar reserva' : 'Nueva reserva'}
            </h2>
            <p className={styles.subtitle}>{formattedDate}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <section className={styles.clientSection}>
            <div className={styles.clientGrid}>
              <label>
                Nombre del cliente *
                <input
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  required
                  autoFocus
                />
              </label>
              <label>
                Teléfono *
                <input
                  value={form.clientPhone}
                  onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                  placeholder="+34 …"
                  required
                />
              </label>
              <label>
                Email (opcional)
                <input
                  type="email"
                  value={form.clientEmail}
                  onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </label>
              <label>
                Personas *
                <input
                  type="number"
                  min={1}
                  max={selectedTable?.capacity ?? 20}
                  value={form.pax}
                  onChange={(e) => setForm({ ...form, pax: Number(e.target.value) || 1 })}
                  required
                  disabled={!form.tableId}
                />
              </label>
              {isEditing && (
                <label>
                  Estado
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as ReservationStatus })
                    }
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <p className={styles.durationHint}>
              Turnos cada {durationMinutes} min · reserva de {durationMinutes} min
              {!daySchedule.active && ' · Restaurante cerrado este día'}
            </p>
          </section>

          <section className={styles.pickerSection}>
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.modeButton} ${pickerMode === 'table' ? styles.modeButtonActive : ''}`}
                onClick={() => handleModeChange('table')}
              >
                Por mesa
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${pickerMode === 'time' ? styles.modeButtonActive : ''}`}
                onClick={() => handleModeChange('time')}
              >
                Por hora
              </button>
            </div>

            {pickerMode === 'table' ? (
              <>
                <div className={styles.pickerColumn}>
                  <h3>Mesas</h3>
                  {tables.length === 0 ? (
                    <p className={styles.pickerEmpty}>Configura mesas en Mi restaurante.</p>
                  ) : (
                    renderTableTiles(
                      tables.map((table) => ({ tableId: table.id, available: true })),
                      false,
                    )
                  )}
                </div>

                <div className={styles.pickerColumn}>
                  <h3>Horas</h3>
                  {!form.tableId ? (
                    <p className={styles.pickerEmpty}>Elige una mesa para ver horarios.</p>
                  ) : allSlots.length === 0 ? (
                    <p className={styles.pickerEmpty}>No hay horarios disponibles este día.</p>
                  ) : (
                    renderTimeTiles(slotStates, true)
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.pickerColumn}>
                  <h3>Horas</h3>
                  {allSlots.length === 0 ? (
                    <p className={styles.pickerEmpty}>No hay horarios disponibles este día.</p>
                  ) : (
                    renderTimeTiles(hourSlotStates, false)
                  )}
                </div>

                <div className={styles.pickerColumn}>
                  <h3>Mesas</h3>
                  {!form.time ? (
                    <p className={styles.pickerEmpty}>Elige una hora para ver mesas.</p>
                  ) : tables.length === 0 ? (
                    <p className={styles.pickerEmpty}>Configura mesas en Mi restaurante.</p>
                  ) : (
                    renderTableTiles(tableStates, true)
                  )}
                </div>
              </>
            )}
          </section>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={isSaving || tables.length === 0 || allSlots.length === 0}
            >
              {isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ReservationFormModal
