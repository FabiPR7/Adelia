import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Calendar from '../components/Calendar'
import BookingRestaurantLanding from '../components/booking/BookingRestaurantLanding'
import BookingInviteFriends from '../components/booking/BookingInviteFriends'
import PostBookingInvite from '../components/booking/PostBookingInvite'
import ReservationDepositPayment, {
  type ReservationDepositPaymentHandle,
} from '../components/booking/ReservationDepositPayment'
import { useAuth } from '../context/AuthContext'
import { useCustomerProductTourOptional } from '../context/CustomerProductTourContext'
import { useCustomerGamificationContext } from '../context/CustomerGamificationContext'
import { useCustomerFriends } from '../hooks/useCustomerFriends'
import { createPublicDepositIntent, type PublicDepositIntentResponse } from '../services/publicDepositApi'
import RecaptchaNotice from '../components/RecaptchaNotice'
import {
  createPublicReservation,
  fetchPublicAvailability,
  type DayAvailability,
  fetchPublicBookingPage,
  type PublicBookingCompany,
  type PublicBookingTable,
} from '../services/publicApi'
import {
  formatSlotEndTime,
  getDaySchedule,
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
import { trackAppEvent } from '../utils/appEvents'
import { fetchPublicPromotionsBySlug, type PublicPromotion } from '../services/publicPromotions'
import {
  canRedeemPromotionAsCustomer,
  getPromoBookingHint,
  isPromoTimeConstrained,
} from '../utils/promotionBooking'
import { resolvePromotionHighlight, formatPromotionMinimumSpendBookingNote } from '../utils/promotionOffer'
import { groupBookableSlots } from '../utils/bookingSlotGroups'
import { formatDepositAuthorizationSummary } from '../utils/reservationDeposit'
import { BOOKING_RULES_UNKNOWN, bookingDepositCents, type BookingRules } from '../types/bookingRules'
import {
  DEPOSIT_PASS_ITEM_ID,
  EXTRA_PAX_ITEM_ID,
  getInventoryItem,
  inventoryQuantity,
} from '../data/inventoryItems'
import BookingItemOption from '../components/booking/BookingItemOption'
import { personNameError } from '../utils/personName'
import GuestSignupCard, { saveGuestSignupPrefill } from '../components/booking/GuestSignupCard'
import {
  areFloorPlansEnabled,
  enabledFloorPlans,
  parseFloorPlans,
  tableBelongsToFloorPlan,
  tablesForFloorPlan,
} from '../types'
import { updateCustomerPhone } from '../services/customerAuth'
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
  const productTour = useCustomerProductTourOptional()
  const { refreshGamificationData } = useCustomerGamificationContext()
  const isLoggedCustomer = profile?.role === 'customer'
  // Cuenta sin teléfono: se pide al reservar para que el local pueda avisar.
  const accountNeedsPhone = isLoggedCustomer && !isValidSpanishPhone(profile?.phone ?? '')
  const { friends, loading: friendsLoading } = useCustomerFriends(
    isLoggedCustomer ? user?.uid : undefined,
  )
  const [searchParams] = useSearchParams()
  const [company, setCompany] = useState<PublicBookingCompany | null>(null)

  // Título con el nombre del local (el genérico de RouteTitle no lo sabe).
  useEffect(() => {
    if (company?.name) {
      document.title = `${company.name}${company.municipality ? ` en ${company.municipality}` : ''} · Reserva mesa · Adelia`
    }
  }, [company?.name, company?.municipality])
  const [tables, setTables] = useState<PublicBookingTable[]>([])
  const [bookingRules, setBookingRules] = useState<BookingRules>(BOOKING_RULES_UNKNOWN)
  const [selectedDate, setSelectedDate] = useState(new Date())
  // Horas y mesas libres del día (y qué permite la promo): las calcula el servidor.
  const [dayAvailability, setDayAvailability] = useState<DayAvailability>({ slots: [], promoDayBlock: null })
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
  const [guestBookedEmail, setGuestBookedEmail] = useState<string | null>(null)
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
  // Tras reservar: id de la reserva y amigos ya invitados, para ofrecer invitar más.
  const [completedReservation, setCompletedReservation] = useState<{ id: string; invitedIds: string[] } | null>(null)
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
  // La regla de la fianza la manda el servidor; aquí solo se aplica a los comensales elegidos.
  const depositCents = bookingDepositCents(bookingRules, pax)
  const depositUsesPass = useDepositPass && hasDepositPass
  const depositRequired = depositCents > 0 && bookingRules.depositsReady && !depositUsesPass
  const depositUnavailable = depositCents > 0 && !bookingRules.depositsReady && !depositUsesPass

  const loadAvailability = useCallback(async () => {
    if (!slug) {
      return
    }

    setIsAvailabilityLoading(true)
    setError(null)

    try {
      setDayAvailability(await fetchPublicAvailability(slug, selectedDate, activePromo?.id ?? null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la disponibilidad.')
    } finally {
      setIsAvailabilityLoading(false)
    }
  }, [slug, selectedDate, activePromo?.id])

  useEffect(() => {
    if (step !== 'form' || !company || !slug) {
      return undefined
    }

    let cancelled = false

    const loadDeposit = async () => {
      if (!(depositCents > 0 && bookingRules.depositsReady) || useDepositPass) {
        setDepositIntent(null)
        setDepositPaymentError(null)
        setDepositPaymentReady(false)
        return
      }

      setDepositLoading(true)
      setDepositPaymentError(null)

      try {
        const intent = await createPublicDepositIntent(slug, pax, {
          date: dateToIsoDate(selectedDate),
          time: selectedTime,
        })
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
    // Solo lo que afecta a la fianza: con el objeto company entero se pedía dos veces
    // (al recargar sus datos) y el formulario se quedaba con un pago ya anulado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, company?.id, depositCents, bookingRules.depositsReady, slug, pax, useDepositPass, selectedDate, selectedTime])

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
        setBookingRules(data.booking)
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
    if (!company?.id || pageView !== 'booking') {
      return
    }

    void loadAvailability()
  }, [company?.id, loadAvailability, pageView])

  useEffect(() => {
    if (!company?.id) {
      return
    }
    trackAppEvent('restaurant_view', {
      companyId: company.id,
      source: promoId ? 'promo' : 'direct',
    })
  }, [company?.id, promoId])

  useEffect(() => {
    if (!company || !bookingRules.canReserve) {
      return
    }
    if (searchParams.get('reservar') === '1') {
      setPageView('booking')
    }
  }, [company, bookingRules.canReserve, searchParams])

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

  const hourSlots = useMemo(
    () => dayAvailability.slots.map((slot) => ({ time: slot.time, available: slot.freeTableIds.length > 0 })),
    [dayAvailability],
  )

  /** Por qué la promo no deja reservar a esa hora (lo decide el servidor). */
  const promoReasonFor = useCallback(
    (time: string) => dayAvailability.slots.find((slot) => slot.time === time)?.promoReason ?? null,
    [dayAvailability],
  )

  const enrichedHourSlots = useMemo(
    () => hourSlots.map((slot) => {
      const reason = slot.available ? promoReasonFor(slot.time) : null
      return { ...slot, promoBlocked: Boolean(reason), promoReason: reason ?? undefined }
    }),
    [hourSlots, promoReasonFor],
  )

  const hourSlotGroups = useMemo(
    () => groupBookableSlots(enrichedHourSlots),
    [enrichedHourSlots],
  )

  const attendanceDayBlock = dayAvailability.promoDayBlock

  const tableSlots = useMemo(
    () => (selectedTableId
      ? dayAvailability.slots.map((slot) => ({ time: slot.time, available: slot.freeTableIds.includes(selectedTableId) }))
      : []),
    [dayAvailability, selectedTableId],
  )

  const enrichedTableSlots = useMemo(
    () => tableSlots.map((slot) => {
      const reason = slot.available ? promoReasonFor(slot.time) : null
      return { ...slot, promoBlocked: Boolean(reason), promoReason: reason ?? undefined }
    }),
    [tableSlots, promoReasonFor],
  )

  const tablesForSelectedHour = useMemo(() => {
    const slot = dayAvailability.slots.find((item) => item.time === selectedTime)
    if (!slot) {
      return []
    }
    return tables.map((table) => ({ tableId: table.id, available: slot.freeTableIds.includes(table.id) }))
  }, [dayAvailability, selectedTime, tables])

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
    if (!bookingRules.canReserve) {
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
  }, [bookingRules.canReserve, location.search, navigate, slug])

  const trySelectPromoSlot = (time: string): boolean => {
    if (!activePromo || !isPromoTimeConstrained(activePromo)) {
      setPromoSlotError(null)
      return true
    }

    const validationError = promoReasonFor(time)

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
    if (!trySelectPromoSlot(time)) {
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
    if (!trySelectPromoSlot(time)) {
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
    const bookingPhone = isLoggedCustomer && !accountNeedsPhone
      ? (profile?.phone ?? '').trim()
      : formatSpanishPhoneForStorage(clientPhone)

    if (accountNeedsPhone) {
      if (!isValidSpanishPhone(clientPhone)) {
        setError('Indica un teléfono de contacto válido de España (9 dígitos, p. ej. 612 345 678).')
        return
      }
      // Se queda en el perfil: no se vuelve a pedir.
      if (user) {
        await updateCustomerPhone(user.uid, clientPhone).catch(() => undefined)
      }
    }

    if (!isLoggedCustomer) {
      const nameProblem = isValidClientName(bookingName) ? personNameError(bookingName) : 'Indica un nombre válido (mínimo 2 letras).'
      if (nameProblem) {
        setError(nameProblem)
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
      const promoError = promoReasonFor(selectedTime)
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
              perGuestCents: bookingRules.deposit?.perGuestCents ?? Math.round(depositIntent.amountCents / pax),
              cancellationHours: bookingRules.deposit?.cancellationHours ?? null,
            }
          : null,
      )

      setCompletedReservation(isLoggedCustomer ? { id: booking.id, invitedIds: inviteeIds } : null)
      if (!isLoggedCustomer) {
        setGuestBookedEmail(bookingEmail.trim().toLowerCase())
        saveGuestSignupPrefill({ name: bookingName, email: bookingEmail.trim().toLowerCase(), phone: clientPhone })
      } else {
        setGuestBookedEmail(null)
      }
      setStep('done')
      if (company?.id) {
        trackAppEvent(promoId ? 'reservation_from_promo' : 'reservation_from_profile', {
          companyId: company.id,
          entityId: promoId ?? undefined,
        })
      }
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
    // Enlace viejo, local dado de baja o dirección mal escrita: se explica y se ofrece salida.
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <h3>Este restaurante no está disponible</h3>
          <p>
            Puede que el enlace esté mal escrito o que el restaurante ya no reciba reservas por Adelia.
          </p>
          <Link to="/" className={styles.primaryButton}>
            Buscar otros restaurantes
          </Link>
        </div>
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
  const landingBackHref = productTour?.active
    ? '/app/explorar'
    : profile?.role === 'customer' && fromPromotions
      ? '/app/promociones'
      : profile?.role === 'customer'
        ? '/app/explorar'
        : '/'
  const landingBackLabel =
    productTour?.active || profile?.role === 'customer' ? '← Volver' : '← Menú principal'

  if (pageView === 'landing') {
    return (
      <BookingRestaurantLanding
        company={company}
        menuHref={menuHref}
        promotionsHref={promotionsHref}
        backHref={landingBackHref}
        backLabel={landingBackLabel}
        onReserve={openBookingFlow}
        booking={bookingRules}
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
                {completedReservation ? (
                  <PostBookingInvite
                    key={completedReservation.id}
                    reservationId={completedReservation.id}
                    friends={friends}
                    loading={friendsLoading}
                    alreadyInvitedIds={completedReservation.invitedIds}
                  />
                ) : null}
                {!isLoggedCustomer && guestBookedEmail !== null ? (
                  <GuestSignupCard email={guestBookedEmail} />
                ) : null}
                <button type="button" className={!isLoggedCustomer && guestBookedEmail !== null ? styles.secondaryButton : styles.primaryButton} onClick={resetSelection}>
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
                        aria-invalid={/\p{N}/u.test(clientName)}
                      />
                      {/\p{N}/u.test(clientName) ? (
                        <span className={styles.fieldError} role="alert">El nombre no puede llevar números.</span>
                      ) : null}
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
                    {accountNeedsPhone ? (
                      <label>
                        Teléfono de contacto
                        <input
                          type="tel"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          autoComplete="tel"
                          inputMode="tel"
                          placeholder="612 345 678"
                          required
                        />
                        <span className={styles.fieldHint}>Para que el restaurante pueda avisarte. Lo guardamos en tu perfil.</span>
                      </label>
                    ) : null}
                    <label>
                      Comensales
                      <input
                        type="number"
                        min={1}
                        max={extraPaxCapacity}
                        value={pax}
                        onChange={(e) => {
                          const next = Math.max(1, Math.trunc(Number(e.target.value)) || 1)
                          const clamped = Math.min(next, extraPaxCapacity)
                          setPax(clamped)
                          if (selectedTable && clamped <= selectedTable.capacity) {
                            setUseExtraPax(false)
                          }
                        }}
                      />
                    </label>
                    {(() => {
                      const extraPaxItem = hasExtraPax ? getInventoryItem(EXTRA_PAX_ITEM_ID) : null
                      const depositPassItem = hasDepositPass && depositCents > 0
                        ? getInventoryItem(DEPOSIT_PASS_ITEM_ID)
                        : null
                      if (!extraPaxItem && !depositPassItem) {
                        return null
                      }
                      return (
                        <div className={styles.itemOptions}>
                          <p className={styles.itemOptionsTitle}>Tus cartas para esta reserva</p>
                          {extraPaxItem ? (
                            <BookingItemOption
                              item={extraPaxItem}
                              quantity={inventoryQuantity(profile?.gamification?.inventory, EXTRA_PAX_ITEM_ID)}
                              active={useExtraPax}
                              effect={selectedTable
                                ? `La mesa admite ${selectedTable.capacity}; con esta carta sientas a ${selectedTable.capacity + 1}.`
                                : 'Un comensal más de lo que admite la mesa.'}
                              onToggle={(checked) => {
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
                          ) : null}
                          {depositPassItem ? (
                            <BookingItemOption
                              item={depositPassItem}
                              quantity={inventoryQuantity(profile?.gamification?.inventory, DEPOSIT_PASS_ITEM_ID)}
                              active={useDepositPass}
                              effect="Reservas sin dejar fianza en tu tarjeta."
                              onToggle={setUseDepositPass}
                            />
                          ) : null}
                        </div>
                      )
                    })()}
                    <label>
                      Descripción (opcional)
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Celebración, preferencias de mesa…"
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
                          bookingRules.deposit?.perGuestCents ?? Math.round(depositIntent.amountCents / pax)
                        }
                        cancellationHours={bookingRules.deposit?.cancellationHours ?? null}
                        onReadyChange={setDepositPaymentReady}
                        onError={setDepositPaymentError}
                      />
                    ) : null}

                    <p className={styles.hint}>
                      Tus datos llegan a {company.name} y a Adelia para gestionar esta reserva. Si tienes
                      alergias, avisa directamente al local. Puedes ejercer tus derechos como se explica en la{' '}
                      <a href="/legal/privacidad" target="_blank" rel="noreferrer">política de privacidad</a>.
                      Al reservar aceptas los{' '}
                      <a href="/legal/terminos" target="_blank" rel="noreferrer">términos de uso</a>.
                    </p>
                    <RecaptchaNotice />

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
                        depositRequired ? 'Confirmar reserva y autorizar fianza' : 'Confirmar reserva'
                      )}
                    </button>
                    </fieldset>
                  </form>
                ) : viewMode === 'hours' ? (
                  <div className={styles.panel}>
                    {!selectedTime ? (
                      <>
                        <h3>Elige una hora</h3>
                        {hourSlotGroups.length === 0 && tables.length === 0 ? (
                          // Sin mesas no hay ningún día con horas: no mandar al cliente a probar días.
                          <p className={styles.emptySlots}>
                            {company?.name ?? 'Este restaurante'} todavía no admite reservas por Adelia.
                            {company?.phone ? (
                              <>
                                {' '}Puedes llamar al{' '}
                                <a href={`tel:${company.phone.replace(/\s+/g, '')}`}>{company.phone}</a>.
                              </>
                            ) : null}
                          </p>
                        ) : hourSlotGroups.length === 0 ? (
                          <p className={styles.emptySlots}>
                            No quedan horas libres este día. Prueba con otro día en el calendario.
                          </p>
                        ) : (
                          hourSlotGroups.map((group) => (
                            <div key={group.id} className={styles.slotGroup}>
                              <h4 className={styles.slotGroupTitle}>{group.label}</h4>
                              <div className={styles.slotGrid}>
                                {group.slots.map((slot) => (
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
                            </div>
                          ))
                        )}
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
