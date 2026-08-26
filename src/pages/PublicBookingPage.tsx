import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Calendar from '../components/Calendar'
import BookingRestaurantLanding from '../components/booking/BookingRestaurantLanding'
import BookingInviteFriends from '../components/booking/BookingInviteFriends'
import ReservationDepositPayment, {
  type ReservationDepositPaymentHandle,
} from '../components/booking/ReservationDepositPayment'
import { useAuth } from '../context/AuthContext'
import { useCustomerGamificationContext } from '../context/CustomerGamificationContext'
import { useCustomerFriends } from '../hooks/useCustomerFriends'
import { createPublicDepositIntent, type PublicDepositIntentResponse } from '../services/publicDepositApi'
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
import { isCustomerPromoLocked } from '../data/cancellationPenalties'
import { fetchPublicPromotionsBySlug, type PublicPromotion } from '../services/publicPromotions'
import {
  canRedeemPromotionAsCustomer,
  getAttendanceDayBlockMessage,
  getPromoBookingHint,
  getPromoSlotDisabledReason,
  isPromoTimeConstrained,
  validatePromoSlotSelection,
} from '../utils/promotionBooking'
import { resolvePromotionHighlight, formatPromotionMinimumSpendBookingNote } from '../utils/promotionOffer'
import {
  companyCanCollectReservationDeposits,
  companyRequiresReservationDeposit,
  companyRequiresStripeDeposit,
  computeReservationDepositCents,
  formatDepositAuthorizationSummary,
} from '../utils/reservationDeposit'
import {
  DEPOSIT_PASS_ITEM_ID,
  EXTRA_PAX_ITEM_ID,
  inventoryQuantity,
} from '../data/inventoryItems'
import {
  companyAcceptsReservations,
} from '../data/companyReservationMode'
import {
  areFloorPlansEnabled,
  enabledFloorPlans,
  parseFloorPlans,
  tableBelongsToFloorPlan,
  tablesForFloorPlan,
} from '../types'
import styles from './PublicBookingPage.module.css'

const FloorPlanViewer = lazy(() => import('../components/FloorPlanViewer'))

type ViewMode = 'hours' | 'map'
type BookingStep = 'pick' | 'form' | 'done'
type PageView = 'landing' | 'booking'

function PublicBookingPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, isLoading: authLoading, refreshProfile, patchProfileGamification } = useAuth()
  const { refreshGamificationData } = useCustomerGamificationContext()
  const isLoggedCustomer = profile?.role === 'customer'
  const { friends, loading: friendsLoading } = useCustomerFriends(
    isLoggedCustomer ? user?.uid : undefined,
  )
  const [searchParams] = useSearchParams()
  const [company, setCompany] = useState<PublicBookingCompany | null>(null)
  const [tables, setTables] = useState<PublicBookingTable[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [dayReservations, setDayReservations] = useState<Reservation[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('hours')
  const [selectedBookingMapId, setSelectedBookingMapId] = useState('')
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
  const [promoResolved, setPromoResolved] = useState(!searchParams.get('promo'))
  const [promoSlotError, setPromoSlotError] = useState<string | null>(null)
  const [depositIntent, setDepositIntent] = useState<PublicDepositIntentResponse | null>(null)
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositPaymentReady, setDepositPaymentReady] = useState(false)
  const [depositPaymentError, setDepositPaymentError] = useState<string | null>(null)
  const [useDepositPass, setUseDepositPass] = useState(false)
  const [useExtraPax, setUseExtraPax] = useState(false)
  const [inviteeIds, setInviteeIds] = useState<string[]>([])
  const [completedBookingDeposit, setCompletedBookingDeposit] = useState<{
    amountCents: number
    pax: number
    perGuestCents: number
    cancellationHours: number | null
  } | null>(null)
  const depositPaymentRef = useRef<ReservationDepositPaymentHandle>(null)

  const promoId = searchParams.get('promo')
  const durationMinutes = company?.timeSlotMinutes ?? 120
  const schedule = company?.schedule
  const hasDepositPass = inventoryQuantity(profile?.gamification?.inventory, DEPOSIT_PASS_ITEM_ID) > 0
  const hasExtraPax = inventoryQuantity(profile?.gamification?.inventory, EXTRA_PAX_ITEM_ID) > 0
  const depositRequired = company
    ? companyRequiresStripeDeposit(pax, company) && !(useDepositPass && hasDepositPass)
    : false
  const depositUnavailable = company
    ? companyRequiresReservationDeposit(pax, company)
      && computeReservationDepositCents(pax, company) > 0
      && !companyCanCollectReservationDeposits(company)
      && !(useDepositPass && hasDepositPass)
    : false

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
    if (step !== 'form' || !company || !slug) {
      return undefined
    }

    let cancelled = false

    const loadDeposit = async () => {
      if (!companyRequiresStripeDeposit(pax, company) || useDepositPass) {
        setDepositIntent(null)
        setDepositPaymentError(null)
        setDepositPaymentReady(false)
        return
      }

      setDepositLoading(true)
      setDepositPaymentError(null)

      try {
        const intent = await createPublicDepositIntent(slug, pax)
        if (!cancelled) {
          setDepositIntent(intent)
          setDepositPaymentReady(false)
        }
      } catch (err) {
        if (!cancelled) {
          setDepositIntent(null)
          setDepositPaymentError(
            err instanceof Error ? err.message : 'No se pudo preparar la fianza.',
          )
        }
      } finally {
        if (!cancelled) {
          setDepositLoading(false)
        }
      }
    }

    void loadDeposit()

    return () => {
      cancelled = true
    }
  }, [step, company, slug, pax, useDepositPass])

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
    if (!company || !companyAcceptsReservations(company.reservationMode)) {
      return
    }
    if (searchParams.get('reservar') === '1') {
      setPageView('booking')
    }
  }, [company, searchParams])

  useEffect(() => {
    if (profile?.role !== 'customer') {
      return
    }
    setClientName(profile.displayName)
    setClientEmail(profile.email)
    setClientPhone(profile.phone ?? '')
  }, [profile])

  useEffect(() => {
    if (!slug || !promoId) {
      setActivePromo(null)
      setPromoResolved(true)
      return
    }

    let cancelled = false
    setPromoResolved(false)

    void fetchPublicPromotionsBySlug(slug)
      .then((promotions) => {
        if (cancelled) {
          return
        }

        const merged = import.meta.env.DEV ? mergeDemoPromotions(promotions) : promotions
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
      .finally(() => {
        if (!cancelled) {
          setPromoResolved(true)
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

  const canRedeemPromo = canRedeemPromotionAsCustomer(user, profile)
  const promoLocked = isCustomerPromoLocked(profile)
  const promoAuthRequired = Boolean(activePromo) && !authLoading && !canRedeemPromo
  const promoPenaltyLocked = Boolean(activePromo) && !authLoading && canRedeemPromo && promoLocked
  const minSpendBookingNote = activePromo
    ? formatPromotionMinimumSpendBookingNote(activePromo)
    : null
  const waitingForPromo = Boolean(promoId) && !promoResolved
  const returnPath = `${location.pathname}${location.search}`
  const promoAuthRedirect = encodeURIComponent(returnPath)
  const selectedTable = tables.find((table) => table.id === selectedTableId)
  const extraPaxCapacity = selectedTable
    ? selectedTable.capacity + (useExtraPax && hasExtraPax ? 1 : 0)
    : 20
  const daySchedule = schedule ? getDaySchedule(selectedDate, schedule) : null
  const bookingFloorPlans = useMemo(
    () => (company ? parseFloorPlans(company.floorPlans, company.floorPlan) : []),
    [company],
  )
  const mapsForBooking = useMemo(
    () => enabledFloorPlans(bookingFloorPlans),
    [bookingFloorPlans],
  )
  const canUseMap = areFloorPlansEnabled(bookingFloorPlans)
  const selectedBookingMap =
    mapsForBooking.find((plan) => plan.id === selectedBookingMapId) ?? mapsForBooking[0]
  const mapTables = useMemo(() => {
    if (!selectedBookingMap) {
      return []
    }

    return tablesForFloorPlan(tables, selectedBookingMap, bookingFloorPlans)
  }, [tables, selectedBookingMap, bookingFloorPlans])

  useEffect(() => {
    if (!mapsForBooking.length) {
      setSelectedBookingMapId('')
      return
    }

    setSelectedBookingMapId((current) =>
      mapsForBooking.some((plan) => plan.id === current)
        ? current
        : mapsForBooking[0].id,
    )
  }, [mapsForBooking])

  const tableMapName = (tableId: string) => {
    if (mapsForBooking.length < 2) {
      return null
    }

    const table = tables.find((item) => item.id === tableId)
    if (!table) {
      return null
    }

    return bookingFloorPlans.find((plan) => tableBelongsToFloorPlan(table, plan, bookingFloorPlans))?.name
      ?? null
  }

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
    setCompletedBookingDeposit(null)
  }

  const returnToRestaurantHome = useCallback(() => {
    setPageView('landing')
    setStep('pick')
    resetSelection()
    navigate(`/reservar/${slug}`, { replace: true })
  }, [navigate, slug])

  const openBookingFlow = useCallback(() => {
    if (!companyAcceptsReservations(company?.reservationMode)) {
      return
    }
    setPageView('booking')
    setStep('pick')
    const params = new URLSearchParams(location.search)
    params.set('reservar', '1')
    navigate(
      { pathname: `/reservar/${slug}`, search: params.toString() },
      { replace: true },
    )
  }, [company?.reservationMode, location.search, navigate, slug])

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

  const selectBookingMap = (planId: string) => {
    setSelectedBookingMapId(planId)
    const plan = mapsForBooking.find((item) => item.id === planId)
    if (!plan) {
      return
    }

    const visible = tablesForFloorPlan(tables, plan, bookingFloorPlans)
    if (selectedTableId && !visible.some((table) => table.id === selectedTableId)) {
      setSelectedTableId('')
      setSelectedTime('')
    }
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

    const bookingName = isLoggedCustomer
      ? (profile?.displayName ?? '').trim()
      : clientName.trim().replace(/\s+/g, ' ')
    const bookingEmail = isLoggedCustomer ? (profile?.email ?? '').trim() : clientEmail.trim()
    const bookingPhone = isLoggedCustomer
      ? (profile?.phone ?? '').trim()
      : formatSpanishPhoneForStorage(clientPhone)

    if (!isLoggedCustomer) {
      if (!isValidClientName(bookingName)) {
        setError('Indica un nombre válido (mínimo 2 letras).')
        return
      }

      if (!bookingPhone) {
        setError('Indica un teléfono de contacto.')
        return
      }

      if (!isValidSpanishPhone(clientPhone)) {
        setError('Indica un teléfono válido de España (9 dígitos, p. ej. 612 345 678).')
        return
      }

      if (!isValidEmail(bookingEmail)) {
        setError('Indica un correo electrónico válido.')
        return
      }
    } else if (!bookingName || !isValidEmail(bookingEmail)) {
      setError('Tu cuenta no tiene nombre o email. Completa el perfil e inténtalo de nuevo.')
      return
    }

    if (pax < 1) {
      setError('Indica el número de invitados.')
      return
    }

    if (selectedTable && pax > extraPaxCapacity) {
      setError(`Esta mesa admite hasta ${extraPaxCapacity} personas.`)
      return
    }

    if (activePromo && !canRedeemPromo) {
      setError('Debes registrarte como cliente para canjear promociones.')
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
      if (depositRequired) {
        if (!depositIntent?.paymentIntentId || !depositIntent.clientSecret || !depositIntent.stripeAccountId) {
          setError('No se pudo preparar la fianza. Inténtalo de nuevo.')
          return
        }

        if (!depositPaymentReady) {
          setError('Introduce los datos de tu tarjeta para asegurar la fianza.')
          return
        }

        if (depositPaymentError) {
          setError(depositPaymentError)
          return
        }

        await depositPaymentRef.current?.confirmDeposit()
      }

      const booking = await createPublicReservation(slug, {
        date: dateToIsoDate(selectedDate),
        time: selectedTime,
        tableId: selectedTableId,
        clientName: bookingName,
        clientEmail: bookingEmail,
        clientPhone: bookingPhone,
        pax,
        notes: notes.trim(),
        ...(activePromo ? { promotionId: activePromo.id } : {}),
        ...(depositRequired && depositIntent?.paymentIntentId
          ? { depositPaymentIntentId: depositIntent.paymentIntentId }
          : {}),
        ...(useDepositPass && hasDepositPass ? { useDepositPass: true } : {}),
        ...(useExtraPax && hasExtraPax && selectedTable && pax > selectedTable.capacity
          ? { useExtraPax: true }
          : {}),
        ...(isLoggedCustomer && inviteeIds.length > 0 ? { inviteeUids: inviteeIds } : {}),
      })

      if (isLoggedCustomer) {
        if (booking.inventory) {
          patchProfileGamification({ inventory: booking.inventory })
        }
        await refreshProfile()
        await refreshGamificationData({ silent: true })
      }

      setCompletedBookingDeposit(
        depositRequired && depositIntent?.amountCents
          ? {
              amountCents: depositIntent.amountCents,
              pax,
              perGuestCents: company.depositPerGuestCents ?? Math.round(depositIntent.amountCents / pax),
              cancellationHours: company.depositCancellationHours ?? null,
            }
          : null,
      )

      setStep('done')
      setClientName('')
      setClientEmail('')
      setClientPhone('')
      setNotes('')
      setPax(2)
      setUseExtraPax(false)
      setUseDepositPass(false)
      setInviteeIds([])
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
    profile?.role === 'customer' && fromPromotions ? '/app/promociones' : '/'
  const landingBackLabel =
    profile?.role === 'customer' && fromPromotions ? '← Volver' : '← Menú principal'

  if (pageView === 'landing') {
    return (
      <BookingRestaurantLanding
        company={company}
        menuHref={menuHref}
        promotionsHref={promotionsHref}
        backHref={landingBackHref}
        backLabel={landingBackLabel}
        onReserve={openBookingFlow}
      />
    )
  }

  return (
    <div className={styles.bookingPage}>
      <header className={styles.bookingTopBar}>
        <button type="button" className={styles.backToLanding} onClick={returnToRestaurantHome}>
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

        {activePromo && isPromoTimeConstrained(activePromo) && !promoAuthRequired && !promoPenaltyLocked ? (
          <div className={styles.promoBanner}>
            <span className={styles.promoBannerBadge}>
              {resolvePromotionHighlight(activePromo, 0)}
            </span>
            <div className={styles.promoBannerText}>
              <strong>{activePromo.title}</strong>
              <p>{getPromoBookingHint(activePromo)}</p>
              {minSpendBookingNote ? (
                <p className={styles.promoBannerMinSpend}>{minSpendBookingNote}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {waitingForPromo ? (
          <p className={styles.loadingInline}>Cargando promoción…</p>
        ) : promoAuthRequired && activePromo ? (
          <div className={styles.promoAuthGate}>
            <span className={styles.promoBannerBadge}>
              {resolvePromotionHighlight(activePromo, 0)}
            </span>
            <h3>No puedes canjear promociones sin registrarte</h3>
            <p>
              Para reservar y canjear <strong>{activePromo.title}</strong> en{' '}
              <strong>{company.name}</strong> necesitas una cuenta de cliente en Adelia.
            </p>
            {minSpendBookingNote ? (
              <p className={styles.promoAuthGateMinSpend}>{minSpendBookingNote}</p>
            ) : null}
            <div className={styles.promoAuthGateActions}>
              <Link
                to={`/cuenta/registro?redirect=${promoAuthRedirect}`}
                className={styles.primaryButton}
              >
                Registrarme gratis
              </Link>
              <Link
                to={`/cuenta/entrar?redirect=${promoAuthRedirect}`}
                className={styles.secondaryButton}
              >
                Ya tengo cuenta
              </Link>
            </div>
            <Link to={`/reservar/${slug}?reservar=1`} className={styles.promoAuthGateSkip}>
              Reservar mesa sin canjear promo
            </Link>
          </div>
        ) : promoPenaltyLocked && activePromo ? (
          <div className={styles.promoAuthGate}>
            <span className={styles.promoBannerBadge}>Bloqueado</span>
            <h3>Promociones bloqueadas</h3>
            <p>
              Has cancelado demasiadas reservas. No puedes reservar con promoción ni canjear premios.
              Sí puedes reservar mesa con normalidad.
            </p>
            <Link to={`/reservar/${slug}?reservar=1`} className={styles.primaryButton}>
              Reservar mesa sin promo
            </Link>
          </div>
        ) : (
          <>
        {promoSlotError && step !== 'done' ? (
          <div className={styles.promoSlotError}>{promoSlotError}</div>
        ) : null}

        {attendanceDayBlock && step !== 'done' ? (
          <div className={styles.promoSlotError}>{attendanceDayBlock}</div>
        ) : null}

        {error && step !== 'done' && <div className={styles.error}>{error}</div>}

        {minSpendBookingNote
        && !promoAuthRequired
        && step !== 'done'
        && !(activePromo && isPromoTimeConstrained(activePromo))
          ? (
          <p className={styles.bookingMinSpendNote}>{minSpendBookingNote}</p>
        ) : null}

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
                {completedBookingDeposit ? (
                  <p className={styles.successMinSpend}>
                    {formatDepositAuthorizationSummary(
                      completedBookingDeposit.pax,
                      completedBookingDeposit.perGuestCents,
                      completedBookingDeposit.cancellationHours,
                    )}
                  </p>
                ) : null}
                {minSpendBookingNote ? (
                  <p className={styles.successMinSpend}>
                    {minSpendBookingNote}. El restaurante lo comprobará al confirmar tu visita.
                  </p>
                ) : null}
                {activePromo?.type === 'time_limited' ? (
                  <p className={styles.successMinSpend}>
                    Cuando el restaurante confirme tu asistencia podrás verificar para reclamar tu premio.
                  </p>
                ) : null}
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
                    onClick={() => {
                      setViewMode('map')
                      if (!selectedTableId) {
                        return
                      }

                      const table = tables.find((item) => item.id === selectedTableId)
                      const plan = table
                        ? mapsForBooking.find((item) =>
                            tableBelongsToFloorPlan(table, item, bookingFloorPlans),
                          )
                        : undefined

                      if (plan) {
                        setSelectedBookingMapId(plan.id)
                      }
                    }}
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
                      {tableMapName(selectedTableId) ? ` · ${tableMapName(selectedTableId)}` : ''}
                    </p>
                    {isLoggedCustomer && profile ? (
                      <p className={styles.accountHint}>
                        Reservando como <strong>{profile.displayName}</strong>
                        {profile.email ? ` · ${profile.email}` : ''}
                      </p>
                    ) : null}
                    <fieldset className={styles.formFields} disabled={isSubmitting}>
                    {isLoggedCustomer ? null : (
                      <>
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
                      </>
                    )}
                    <label>
                      Comensales
                      <input
                        type="number"
                        min={1}
                        max={extraPaxCapacity}
                        value={pax}
                        onChange={(e) => {
                          const next = Math.max(1, Number(e.target.value) || 1)
                          const clamped = Math.min(next, extraPaxCapacity)
                          setPax(clamped)
                          if (selectedTable && clamped <= selectedTable.capacity) {
                            setUseExtraPax(false)
                          }
                        }}
                      />
                    </label>
                    {hasExtraPax ? (
                      <label className={styles.itemToggle}>
                        <input
                          type="checkbox"
                          checked={useExtraPax}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setUseExtraPax(checked)
                            if (!selectedTable) {
                              return
                            }
                            if (checked) {
                              setPax(selectedTable.capacity + 1)
                            } else {
                              setPax((current) => Math.min(current, selectedTable.capacity))
                            }
                          }}
                        />
                        <span>
                          Usar Invitación extra
                          {selectedTable
                            ? ` · la mesa admite ${selectedTable.capacity}; con esta carta puedes sentar ${selectedTable.capacity + 1}`
                            : ' · +1 comensal sobre la mesa'}
                        </span>
                      </label>
                    ) : null}
                    {hasDepositPass && company && companyRequiresReservationDeposit(pax, company) ? (
                      <label className={styles.itemToggle}>
                        <input
                          type="checkbox"
                          checked={useDepositPass}
                          onChange={(event) => setUseDepositPass(event.target.checked)}
                        />
                        <span>Usar Salvoconducto de depósito · esta reserva no retiene fianza</span>
                      </label>
                    ) : null}
                    <label>
                      Descripción (opcional)
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Alergias, celebración, preferencias…"
                      />
                    </label>
                    {isLoggedCustomer ? (
                      <BookingInviteFriends
                        friends={friends}
                        loading={friendsLoading}
                        selectedIds={inviteeIds}
                        onChange={setInviteeIds}
                      />
                    ) : null}

                    {depositUnavailable ? (
                      <p className={styles.hint}>
                        Esta reserva requiere fianza, pero el restaurante aún no tiene Stripe
                        conectado. Contacta con el local para reservar.
                      </p>
                    ) : null}

                    {depositLoading ? (
                      <p className={styles.loadingInline}>Preparando fianza…</p>
                    ) : null}

                    {depositPaymentError ? (
                      <p className={styles.error}>{depositPaymentError}</p>
                    ) : null}

                    {depositRequired
                    && depositIntent?.required
                    && depositIntent.clientSecret
                    && depositIntent.stripeAccountId ? (
                      <ReservationDepositPayment
                        ref={depositPaymentRef}
                        clientSecret={depositIntent.clientSecret}
                        stripeAccountId={depositIntent.stripeAccountId}
                        amountCents={depositIntent.amountCents}
                        pax={pax}
                        perGuestCents={
                          company.depositPerGuestCents ?? Math.round(depositIntent.amountCents / pax)
                        }
                        cancellationHours={company.depositCancellationHours}
                        onReadyChange={setDepositPaymentReady}
                        onError={setDepositPaymentError}
                      />
                    ) : null}

                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={isSubmitting || depositUnavailable || depositLoading}
                    >
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
                                {tableMapName(table.id) ? (
                                  <span>{tableMapName(table.id)}</span>
                                ) : null}
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
                        {mapsForBooking.length > 1 ? (
                          <div className={styles.mapTabList} role="tablist" aria-label="Mapas del restaurante">
                            {mapsForBooking.map((plan) => {
                              const selected = selectedBookingMap?.id === plan.id
                              return (
                                <button
                                  key={plan.id}
                                  type="button"
                                  role="tab"
                                  aria-selected={selected}
                                  className={`${styles.mapTab} ${selected ? styles.mapTabActive : ''}`}
                                  onClick={() => selectBookingMap(plan.id)}
                                >
                                  {plan.name}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                        <h3>
                          Elige una mesa
                          {selectedBookingMap ? ` · ${selectedBookingMap.name}` : ''}
                        </h3>
                        <Suspense fallback={<p className={styles.loadingInline}>Cargando mapa…</p>}>
                          {selectedBookingMap ? (
                            <FloorPlanViewer
                              key={selectedBookingMap.id}
                              floorPlan={selectedBookingMap}
                              tables={mapTables}
                              selectedTableId={selectedTableId}
                              onSelectTable={handleSelectTableOnMap}
                              large
                            />
                          ) : (
                            <p className={styles.hint}>No hay un mapa disponible.</p>
                          )}
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
                              {selectedTable?.name}
                              {tableMapName(selectedTableId) ? ` · ${tableMapName(selectedTableId)}` : ''}
                              {' '}· {selectedTable?.capacity} pers.
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
          </>
        )}
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
