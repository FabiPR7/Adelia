import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import Calendar from '../components/Calendar'
import BookingRestaurantLanding from '../components/booking/BookingRestaurantLanding'
import { useAuth } from '../context/AuthContext'
import {
  availabilityToReservations,
  createPublicReservation,
  fetchPublicAvailability,
  fetchPublicBookingPage,
  type PublicBookingCompany,
  type PublicBookingTable,
} from '../services/publicApi'
import type { Reservation } from '../types'
import {
  formatSlotEndTime,
  getDaySchedule,
  getHourSlotStates,
  getSlotStatesForTable,
  getTableStatesForSlot,
} from '../utils/reservationSlots'
import {
  assertReservationStartInFuture,
  clampToTodayOrFuture,
  dateToIsoDate,
  formatDateSpanish,
  formatSpanishPhoneForStorage,
  isValidClientName,
  isValidEmail,
  isValidSpanishPhone,
} from '../utils/helpers'
import { mergeDemoPromotions } from '../data/demoNearbyPromotions'
import { fetchPublicPromotionsBySlug, type PublicPromotion } from '../services/publicPromotions'
import {
  getAttendanceDayBlockMessage,
  getPromoBookingHint,
  getPromoSlotDisabledReason,
  isPromoTimeConstrained,
  validatePromoSlotSelection,
} from '../utils/promotionBooking'
import { resolvePromotionHighlight, resolvePromotionMinimumSpend } from '../utils/promotionOffer'
import styles from './PublicBookingPage.module.css'

const FloorPlanViewer = lazy(() => import('../components/FloorPlanViewer'))

type ViewMode = 'hours' | 'map'
type BookingStep = 'pick' | 'form' | 'done'
type PageView = 'landing' | 'booking'

function PublicBookingPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [company, setCompany] = useState<PublicBookingCompany | null>(null)
  const [tables, setTables] = useState<PublicBookingTable[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [dayReservations, setDayReservations] = useState<Reservation[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('hours')
  const [step, setStep] = useState<BookingStep>('pick')
  const [selectedTime, setSelectedTime] = useState('')
  const [selectedTableId, setSelectedTableId] = useState('')
  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [pax, setPax] = useState(2)
  const [notes, setNotes] = useState('')
  const [pageView, setPageView] = useState<PageView>('landing')
  const [activePromo, setActivePromo] = useState<PublicPromotion | null>(null)
  const [promoSlotError, setPromoSlotError] = useState<string | null>(null)

  const promoId = searchParams.get('promo')
  const durationMinutes = company?.timeSlotMinutes ?? 120
  const schedule = company?.schedule

  const loadAvailability = useCallback(async () => {
    if (!slug) {
      return
    }

    setIsAvailabilityLoading(true)
    setError(null)

    try {
      const availability = await fetchPublicAvailability(slug, selectedDate)
      setDayReservations(availabilityToReservations(availability))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la disponibilidad.')
    } finally {
      setIsAvailabilityLoading(false)
    }
  }, [slug, selectedDate])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      setIsBootLoading(true)
      setError(null)

      try {
        const data = await fetchPublicBookingPage(slug)
        if (cancelled) return
        setCompany(data.company)
        setTables(data.tables)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Restaurante no encontrado.')
        }
      } finally {
        if (!cancelled) {
          setIsBootLoading(false)
        }
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!company || pageView !== 'booking') {
      return
    }

    void loadAvailability()
  }, [company, loadAvailability, pageView])

  useEffect(() => {
    if (searchParams.get('reservar') === '1') {
      setPageView('booking')
    }
  }, [searchParams])

  useEffect(() => {
    if (!slug || !promoId) {
      setActivePromo(null)
      return
    }

    let cancelled = false

    void fetchPublicPromotionsBySlug(slug)
      .then((promotions) => {
        if (cancelled) {
          return
        }

        const merged = mergeDemoPromotions(promotions)
        const found = merged.find(
          (promotion) => promotion.id === promoId && promotion.companySlug === slug,
        ) ?? null
        setActivePromo(found)
      })
      .catch(() => {
        if (!cancelled) {
          setActivePromo(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [slug, promoId])

  useEffect(() => {
    setStep('pick')
    setSelectedTime('')
    setSelectedTableId('')
    setPromoSlotError(null)
  }, [selectedDate, viewMode])

  const selectedTable = tables.find((table) => table.id === selectedTableId)
  const daySchedule = schedule ? getDaySchedule(selectedDate, schedule) : null
  const canUseMap = Boolean(company?.floorPlan.enabled)

  const hourSlots = useMemo(() => {
    if (!schedule) {
      return []
    }

    return getHourSlotStates(
      selectedDate,
      schedule,
      durationMinutes,
      durationMinutes,
      tables,
      dayReservations,
    )
  }, [schedule, selectedDate, durationMinutes, tables, dayReservations])

  const availableHourTimes = useMemo(
    () => hourSlots.filter((slot) => slot.available).map((slot) => slot.time),
    [hourSlots],
  )

  const enrichedHourSlots = useMemo(() => {
    if (!activePromo || !isPromoTimeConstrained(activePromo)) {
      return hourSlots.map((slot) => ({ ...slot, promoBlocked: false, promoReason: undefined as string | undefined }))
    }

    return hourSlots.map((slot) => {
      const reason = getPromoSlotDisabledReason(
        activePromo,
        slot.time,
        slot.available,
        selectedDate,
        availableHourTimes,
      )

      return {
        ...slot,
        promoBlocked: Boolean(reason),
        promoReason: reason ?? undefined,
      }
    })
  }, [hourSlots, activePromo, selectedDate, availableHourTimes])

  const attendanceDayBlock = useMemo(() => {
    if (!activePromo || activePromo.type !== 'attendance') {
      return null
    }

    return getAttendanceDayBlockMessage(activePromo, selectedDate)
  }, [activePromo, selectedDate])

  const tableSlots = useMemo(() => {
    if (!schedule || !selectedTableId) {
      return []
    }

    return getSlotStatesForTable(
      selectedTableId,
      selectedDate,
      schedule,
      durationMinutes,
      durationMinutes,
      dayReservations,
    )
  }, [schedule, selectedTableId, selectedDate, durationMinutes, dayReservations])

  const availableTableSlotTimes = useMemo(
    () => tableSlots.filter((slot) => slot.available).map((slot) => slot.time),
    [tableSlots],
  )

  const enrichedTableSlots = useMemo(() => {
    if (!activePromo || !isPromoTimeConstrained(activePromo)) {
      return tableSlots.map((slot) => ({ ...slot, promoBlocked: false, promoReason: undefined as string | undefined }))
    }

    return tableSlots.map((slot) => {
      const reason = getPromoSlotDisabledReason(
        activePromo,
        slot.time,
        slot.available,
        selectedDate,
        availableTableSlotTimes,
      )

      return {
        ...slot,
        promoBlocked: Boolean(reason),
        promoReason: reason ?? undefined,
      }
    })
  }, [tableSlots, activePromo, selectedDate, availableTableSlotTimes])

  const tablesForSelectedHour = useMemo(() => {
    if (!selectedTime) {
      return []
    }

    return getTableStatesForSlot(
      selectedTime,
      selectedDate,
      durationMinutes,
      tables,
      dayReservations,
    )
  }, [selectedTime, selectedDate, durationMinutes, tables, dayReservations])

  const resetSelection = () => {
    setStep('pick')
    setSelectedTime('')
    setSelectedTableId('')
    setError(null)
    setPromoSlotError(null)
  }

  const trySelectPromoSlot = (time: string, availableTimes: string[]): boolean => {
    if (!activePromo || !isPromoTimeConstrained(activePromo)) {
      setPromoSlotError(null)
      return true
    }

    const validationError = validatePromoSlotSelection(
      activePromo,
      time,
      selectedDate,
      availableTimes,
    )

    if (validationError) {
      setPromoSlotError(validationError)
      return false
    }

    setPromoSlotError(null)
    return true
  }

  const openForm = () => {
    setStep('form')
    setError(null)
  }

  const handleSelectHour = (time: string) => {
    if (!trySelectPromoSlot(time, availableHourTimes)) {
      return
    }

    setSelectedTime(time)
    setSelectedTableId('')
  }

  const handleSelectTableForHour = (tableId: string) => {
    setSelectedTableId(tableId)
    openForm()
  }

  const handleSelectTableOnMap = (tableId: string) => {
    setSelectedTableId(tableId)
    setSelectedTime('')
  }

  const handleSelectSlotForTable = (time: string) => {
    if (!trySelectPromoSlot(time, availableTableSlotTimes)) {
      return
    }

    setSelectedTime(time)
    openForm()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!company || !selectedTableId || !selectedTime) {
      return
    }

    if (!isValidClientName(clientName)) {
      setError('Indica un nombre válido (mínimo 2 letras).')
      return
    }

    if (!clientPhone.trim()) {
      setError('Indica un teléfono de contacto.')
      return
    }

    if (!isValidSpanishPhone(clientPhone)) {
      setError('Indica un teléfono válido de España (9 dígitos, p. ej. 612 345 678).')
      return
    }

    if (!isValidEmail(clientEmail)) {
      setError('Indica un correo electrónico válido.')
      return
    }

    if (pax < 1) {
      setError('Indica el número de invitados.')
      return
    }

    if (selectedTable && pax > selectedTable.capacity) {
      setError(`Esta mesa admite hasta ${selectedTable.capacity} personas.`)
      return
    }

    try {
      assertReservationStartInFuture(selectedDate, selectedTime)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Horario no válido.')
      return
    }

    if (activePromo && isPromoTimeConstrained(activePromo)) {
      const promoError = validatePromoSlotSelection(
        activePromo,
        selectedTime,
        selectedDate,
        viewMode === 'map' ? availableTableSlotTimes : availableHourTimes,
      )
      if (promoError) {
        setError(promoError)
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await createPublicReservation(slug, {
        date: dateToIsoDate(selectedDate),
        time: selectedTime,
        tableId: selectedTableId,
        clientName: clientName.trim().replace(/\s+/g, ' '),
        clientEmail: clientEmail.trim(),
        clientPhone: formatSpanishPhoneForStorage(clientPhone),
        pax,
        notes: notes.trim(),
      })

      setStep('done')
      setClientName('')
      setClientEmail('')
      setClientPhone('')
      setNotes('')
      setPax(2)
      await loadAvailability()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la reserva.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectBookingDate = (date: Date) => {
    setSelectedDate(clampToTodayOrFuture(date))
  }

  const shiftSelectedDate = (days: number) => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + days)
    setSelectedDate(clampToTodayOrFuture(next))
  }

  if (isBootLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Cargando restaurante…</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error ?? 'Restaurante no encontrado.'}</p>
      </div>
    )
  }

  const today = new Date()
  const isToday = selectedDate.toDateString() === today.toDateString()
  const menuHref = `/reservar/${slug}/carta`
  const promotionsHref = `/reservar/${slug}/promociones`
  const fromPromotions =
    (location.state as { from?: string } | null)?.from === 'promociones'
    || searchParams.get('from') === 'promociones'
  const landingBackHref =
    profile?.role === 'customer' && fromPromotions ? '/app/promociones' : null

  if (pageView === 'landing') {
    return (
      <BookingRestaurantLanding
        company={company}
        menuHref={menuHref}
        promotionsHref={promotionsHref}
        backHref={landingBackHref}
        onReserve={() => {
          setPageView('booking')
          setStep('pick')
        }}
      />
    )
  }

  return (
    <div className={styles.bookingPage}>
      <header className={styles.bookingTopBar}>
        <button type="button" className={styles.backToLanding} onClick={() => setPageView('landing')}>
          ← Volver
        </button>
        <h1 className={styles.bookingTitle}>{company.name}</h1>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <div>
              <span className={styles.heroLabel}>{isToday ? 'Hoy' : 'Día seleccionado'}</span>
              <h2>{formatDateSpanish(selectedDate)}</h2>
            </div>
            <div className={styles.mobileDateNav}>
              <button type="button" className={styles.iconButton} onClick={() => shiftSelectedDate(-1)} aria-label="Día anterior">
                ‹
              </button>
              <button type="button" className={styles.iconButton} onClick={() => setCalendarOpen(true)} aria-label="Abrir calendario">
                ▦
              </button>
              <button type="button" className={styles.iconButton} onClick={() => shiftSelectedDate(1)} aria-label="Día siguiente">
                ›
              </button>
            </div>
          </div>
          <div className={styles.heroActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setSelectedDate(new Date())}>
              Ir a hoy
            </button>
          </div>
        </section>

        {activePromo && isPromoTimeConstrained(activePromo) ? (
          <div className={styles.promoBanner}>
            <span className={styles.promoBannerBadge}>
              {resolvePromotionHighlight(activePromo, 0)}
            </span>
            <div className={styles.promoBannerText}>
              <strong>{activePromo.title}</strong>
              <p>{getPromoBookingHint(activePromo)}</p>
              {resolvePromotionMinimumSpend(activePromo) ? (
                <p className={styles.promoBannerMinSpend}>
                  {resolvePromotionMinimumSpend(activePromo)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {promoSlotError && step !== 'done' ? (
          <div className={styles.promoSlotError}>{promoSlotError}</div>
        ) : null}

        {attendanceDayBlock && step !== 'done' ? (
          <div className={styles.promoSlotError}>{attendanceDayBlock}</div>
        ) : null}

        {error && step !== 'done' && <div className={styles.error}>{error}</div>}

        <div className={styles.layout}>
          <aside className={styles.calendarPane}>
            <Calendar
              selectedDate={selectedDate}
              onSelectDate={selectBookingDate}
              disablePastDates
            />
          </aside>

          <div className={styles.bookingPane}>
            {step === 'done' ? (
              <div className={styles.successCard}>
                <h3>Reserva recibida</h3>
                <p>
                  Hemos recibido tu solicitud de reserva en <strong>{company.name}</strong> para el{' '}
                  <strong>{formatDateSpanish(selectedDate)}</strong> a las <strong>{selectedTime}</strong>{' '}
                  ({selectedTable?.name ?? 'mesa'}). Te avisaremos por correo cuando se confirme tu asistencia.
                </p>
                <button type="button" className={styles.primaryButton} onClick={resetSelection}>
                  Hacer otra reserva
                </button>
              </div>
            ) : (
              <>
                <div className={styles.viewToggle}>
                  <button
                    type="button"
                    className={`${styles.toggleButton} ${viewMode === 'hours' ? styles.toggleButtonActive : ''}`}
                    onClick={() => setViewMode('hours')}
                  >
                    Ver por horas
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleButton} ${viewMode === 'map' ? styles.toggleButtonActive : ''}`}
                    onClick={() => setViewMode('map')}
                    disabled={!canUseMap}
                  >
                    Ver por mapa
                  </button>
                </div>

                {!canUseMap && viewMode === 'map' && (
                  <p className={styles.hint}>Este restaurante no tiene mapa activo. Usa «Ver por horas».</p>
                )}

                {daySchedule && !daySchedule.active && (
                  <p className={styles.hint}>El restaurante está cerrado este día.</p>
                )}

                {isAvailabilityLoading ? (
                  <p className={styles.loadingInline}>Actualizando disponibilidad…</p>
                ) : step === 'form' ? (
                  <form className={styles.formCard} onSubmit={(event) => void handleSubmit(event)}>
                    {isSubmitting && (
                      <div className={styles.submitOverlay} aria-live="polite">
                        <span className={styles.spinner} aria-hidden="true" />
                        <span>Enviando tu reserva…</span>
                      </div>
                    )}
                    <button type="button" className={styles.backButton} onClick={resetSelection} disabled={isSubmitting}>
                      ← Volver
                    </button>
                    <h3>Completa tu reserva</h3>
                    <p className={styles.summary}>
                      {formatDateSpanish(selectedDate)} · {selectedTime} –{' '}
                      {formatSlotEndTime(selectedTime, durationMinutes)} · {selectedTable?.name}
                    </p>
                    <fieldset className={styles.formFields} disabled={isSubmitting}>
                    <label>
                      Nombre
                      <input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Teléfono
                      <input
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="612 345 678"
                        required
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="tu@email.com"
                        required
                      />
                    </label>
                    <label>
                      Invitados
                      <input
                        type="number"
                        min={1}
                        max={selectedTable?.capacity ?? 20}
                        value={pax}
                        onChange={(e) => setPax(Number(e.target.value) || 1)}
                      />
                    </label>
                    <label>
                      Comentarios (opcional)
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Alergias, celebración, preferencias…"
                      />
                    </label>
                    <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <span className={styles.submittingLabel}>
                          <span className={styles.spinner} aria-hidden="true" />
                          Enviando…
                        </span>
                      ) : (
                        'Confirmar reserva'
                      )}
                    </button>
                    </fieldset>
                  </form>
                ) : viewMode === 'hours' ? (
                  <div className={styles.panel}>
                    {!selectedTime ? (
                      <>
                        <h3>Elige una hora</h3>
                        <div className={styles.slotGrid}>
                          {enrichedHourSlots.map((slot) => (
                              <button
                                key={slot.time}
                                type="button"
                                className={`${styles.slotButton} ${!slot.available ? styles.slotButtonDisabled : ''} ${slot.promoBlocked ? styles.slotButtonPromoBlocked : ''}`}
                                disabled={!slot.available}
                                title={slot.promoReason}
                                onClick={() => handleSelectHour(slot.time)}
                              >
                                {slot.time}
                              </button>
                            ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <button type="button" className={styles.backButton} onClick={() => setSelectedTime('')}>
                          ← Cambiar hora
                        </button>
                        <h3>Mesas libres a las {selectedTime}</h3>
                        <div className={styles.tableGrid}>
                          {tablesForSelectedHour.map((item) => {
                            const table = tables.find((row) => row.id === item.tableId)
                            if (!table) return null
                            return (
                              <button
                                key={table.id}
                                type="button"
                                className={`${styles.tableButton} ${item.available ? '' : styles.tableButtonDisabled}`}
                                disabled={!item.available}
                                onClick={() => handleSelectTableForHour(table.id)}
                              >
                                <strong>{table.name}</strong>
                                <span>Hasta {table.capacity} pers.</span>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={styles.panel}>
                    <div className={styles.mapLayout}>
                      <div className={styles.mapColumn}>
                        <h3>Elige una mesa</h3>
                        <Suspense fallback={<p className={styles.loadingInline}>Cargando mapa…</p>}>
                          <FloorPlanViewer
                            floorPlan={company.floorPlan}
                            tables={tables}
                            selectedTableId={selectedTableId}
                            onSelectTable={handleSelectTableOnMap}
                            large
                          />
                        </Suspense>
                      </div>
                      <div className={styles.mapHoursColumn}>
                        {selectedTableId ? (
                          <>
                            <button
                              type="button"
                              className={styles.cancelButton}
                              onClick={() => setSelectedTableId('')}
                            >
                              Cancelar
                            </button>
                            <h3 className={styles.mapHoursTitle}>
                              {selectedTable?.name} · {selectedTable?.capacity} pers.
                            </h3>
                            <div className={styles.mapSlotGrid}>
                              {enrichedTableSlots.map((slot) => (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    className={`${styles.slotButton} ${!slot.available ? styles.slotButtonDisabled : ''} ${slot.promoBlocked ? styles.slotButtonPromoBlocked : ''}`}
                                    disabled={!slot.available}
                                    title={slot.promoReason}
                                    onClick={() => handleSelectSlotForTable(slot.time)}
                                  >
                                    {slot.time}
                                    <span>{formatSlotEndTime(slot.time, durationMinutes)}</span>
                                  </button>
                                ))}
                            </div>
                          </>
                        ) : (
                          <p className={styles.mapHoursHint}>
                            Pulsa una mesa en el mapa para ver las horas disponibles.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {calendarOpen && (
        <div className={styles.calendarOverlay} onClick={() => setCalendarOpen(false)} role="presentation">
          <div className={styles.calendarModal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <Calendar
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                selectBookingDate(date)
                setCalendarOpen(false)
              }}
              disablePastDates
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default PublicBookingPage
