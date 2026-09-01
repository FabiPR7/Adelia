import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { isValidClientEmail } from '../email/config.ts'
import { adminAuth, adminDb } from '../firebase-admin.ts'
import {
  assertReservationSlotValid,
  isSameDay,
  parseBookingDate,
  combineDateAndTime,
  assertReservationStartInFuture,
} from '../reservationSlots.ts'
import { defaultSchedule, companyAcceptsReservations, parseCompanyReservationMode } from '../utils.ts'
import {
  computeDepositAmountCents,
  createDepositPaymentIntent,
  verifyDepositPaymentIntent,
  previewDepositCancellation,
  processReservationDepositOnCancel,
  type DepositCancelOutcome,
} from '../stripe/deposits.ts'
import { notifyReservationCancelled } from '../notifications/reservationEvents.ts'
import { cancelInvitesForReservation, createReservationInvites } from '../reservations/invites.ts'
import { createReservationWithOccupiedSlot, SlotUnavailableError } from '../reservations/bookReservation.ts'
import { readCompanyOps } from '../data/companyOps.ts'
import { clampEnabledMaps, parseStoredPlanId, planAllowsDeposits } from '../company/planLimits.ts'
import { readGamificationFromDocs, userGamificationRef, writeGamification } from '../data/userGamification.ts'
import { consumeInventoryItem, numberRecord } from '../gamification/inventory.ts'
import { DEPOSIT_PASS_ITEM_ID, EXTRA_PAX_ITEM_ID } from '../gamification/inventoryItems.ts'
import { isPromoLockedForBooking,
  previewCancellationPenalty,
  previewCancelShieldCount,
  PROMO_LOCK_BOOKING_MESSAGE,
} from '../gamification/cancellationPenalty.ts'
import { InputError, asDateYmd, asId, asInt, asOptionalTrimmed, asPlainText, asSlug } from '../security/validate.ts'
import { allowPublicCache } from '../security/httpCache.ts'

const router = Router()

async function resolveBookingCustomer(req: Request): Promise<{
  uid: string
  displayName: string
  email: string
  phone: string
  photoUrl: string
} | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return null
  }

  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7))
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
    const data = userSnap.data()
    if (!userSnap.exists || data?.role !== 'customer') {
      return null
    }

    const emailFromDoc = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
    const emailFromToken = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : ''

    return {
      uid: decoded.uid,
      displayName: typeof data.displayName === 'string' && data.displayName.trim()
        ? data.displayName.trim()
        : 'Cliente',
      email: emailFromDoc || emailFromToken,
      phone: typeof data.phone === 'string' ? data.phone.trim() : '',
      photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
    }
  } catch {
    return null
  }
}

async function findReservationByCancelToken(token: string) {
  const snapshot = await adminDb
    .collection('reservations')
    .where('cancelToken', '==', token)
    .limit(1)
    .get()

  if (snapshot.empty) {
    return null
  }

  const doc = snapshot.docs[0]
  return {
    ref: doc.ref,
    id: doc.id,
    data: doc.data(),
  }
}

function buildPublicCancelSuccessMessage(
  depositOutcome: DepositCancelOutcome,
  depositAmountCents: number | null,
): string {
  if (depositOutcome === 'captured' && depositAmountCents) {
    const amountLabel = (depositAmountCents / 100).toFixed(2).replace('.', ',')
    return `Tu reserva ha sido cancelada correctamente. Se ha cobrado la fianza de ${amountLabel} € en tu tarjeta.`
  }

  if (depositOutcome === 'released' && depositAmountCents) {
    const amountLabel = (depositAmountCents / 100).toFixed(2).replace('.', ',')
    return `Tu reserva ha sido cancelada correctamente. La fianza de ${amountLabel} € no se ha cobrado.`
  }

  return 'Tu reserva ha sido cancelada correctamente.'
}

function stringList(value: unknown, max: number) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, max)
}

function mapPublicCompany(id: string, data: FirebaseFirestore.DocumentData) {
  const photos = stringList(data.photos, 5)
  const characteristics = stringList(data.characteristics, 20)
  const venueTypes = stringList(data.venueTypes, 3)
  const amenities = stringList(data.amenities, 40)
  const planId = parseStoredPlanId(data.planId)
  const rawFloorPlan = data.floorPlan ?? { enabled: false }
  const rawFloorPlans = Array.isArray(data.floorPlans) && data.floorPlans.length > 0
    ? data.floorPlans
    : [rawFloorPlan]
  const floorPlans = clampEnabledMaps(rawFloorPlans as Array<{ enabled?: unknown }>, planId)
  const floorPlan = clampEnabledMaps([rawFloorPlan as { enabled?: unknown }], planId)[0]
  const depositMinPax = typeof data.depositMinPax === 'number' && data.depositMinPax > 0
    ? Math.trunc(data.depositMinPax)
    : null
  const depositPerGuestCents = typeof data.depositPerGuestCents === 'number' && data.depositPerGuestCents > 0
    ? Math.trunc(data.depositPerGuestCents)
    : null
  const depositsAllowed = planAllowsDeposits(planId)

  return {
    id,
    name: data.name as string,
    slug: data.slug as string,
    phone: (data.phone as string) ?? '',
    contactEmail: (data.contactEmail as string) ?? '',
    location: (data.location as string) ?? '',
    municipality: (data.municipality as string) ?? '',
    country: (data.country as string) ?? '',
    postalCode: (data.postalCode as string) ?? '',
    description: (data.description as string) ?? '',
    logoUrl: (data.logoUrl as string) ?? '',
    photos,
    mainPhotoIndex: typeof data.mainPhotoIndex === 'number'
      ? Math.max(0, Math.min(4, Math.trunc(data.mainPhotoIndex)))
      : 0,
    videos: stringList(data.videos, 2),
    characteristics,
    venueTypes,
    amenities,
    priceRange: typeof data.priceRange === 'string' ? data.priceRange : '',
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
    timeSlotMinutes: (data.timeSlotMinutes as number) ?? 120,
    reservationMode: parseCompanyReservationMode(data.reservationMode),
    schedule: data.schedule ?? defaultSchedule(),
    floorPlan,
    floorPlans,
    reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
    reviewRatingSum: typeof data.reviewRatingSum === 'number' ? data.reviewRatingSum : 0,
    reviewAdelinas: typeof data.reviewAdelinas === 'number' ? data.reviewAdelinas : 0,
    depositMinPax: depositsAllowed ? depositMinPax : null,
    depositPerGuestCents: depositsAllowed ? depositPerGuestCents : null,
    depositEnabled: depositsAllowed && (data.depositEnabled === true || depositMinPax != null),
    depositCancellationHours: typeof data.depositCancellationHours === 'number'
      && data.depositCancellationHours > 0
      ? Math.trunc(data.depositCancellationHours)
      : null,
    stripeAccountId: null as string | null,
    stripeChargesEnabled: data.stripeChargesEnabled === true,
    stripeDetailsSubmitted: data.stripeDetailsSubmitted === true,
  }
}

async function getCompanyBySlug(slug: string) {
  let normalized: string
  try {
    normalized = asSlug(slug)
  } catch {
    return null
  }
  const snapshot = await adminDb
    .collection('companies')
    .where('slug', '==', normalized)
    .limit(1)
    .get()

  if (snapshot.empty) {
    return null
  }

  const docSnap = snapshot.docs[0]
  const data = (await readCompanyOps(docSnap.id)) ?? docSnap.data()
  return mapPublicCompany(docSnap.id, data)
}

async function getCompanyRecordBySlug(slug: string) {
  let normalized: string
  try {
    normalized = asSlug(slug)
  } catch {
    return null
  }
  const snapshot = await adminDb
    .collection('companies')
    .where('slug', '==', normalized)
    .limit(1)
    .get()

  if (snapshot.empty) {
    return null
  }

  const docSnap = snapshot.docs[0]
  const data = (await readCompanyOps(docSnap.id)) ?? docSnap.data()
  return {
    id: docSnap.id,
    data,
    public: mapPublicCompany(docSnap.id, data),
  }
}

function mapReviewMediaItems(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const record = item as Record<string, unknown>
    const url = typeof record.url === 'string' ? record.url.trim() : ''
    const type = record.type === 'video' ? 'video' : record.type === 'image' ? 'image' : null

    if (!url || !type) {
      return []
    }

    return [{ url, type }]
  })
}

function mapReviewTaggedProducts(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const record = item as Record<string, unknown>
    const nodeId = typeof record.nodeId === 'string' ? record.nodeId : ''
    const boardId = typeof record.boardId === 'string' ? record.boardId : ''
    const name = typeof record.name === 'string' ? record.name.trim() : ''

    if (!nodeId || !boardId || !name) {
      return []
    }

    return [{ nodeId, boardId, name }]
  })
}

function mapReviewTaggedPromotions(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const record = item as Record<string, unknown>
    const promotionId = typeof record.promotionId === 'string' ? record.promotionId : ''
    const name = typeof record.name === 'string' ? record.name.trim() : ''

    if (!promotionId || !name) {
      return []
    }

    return [{ promotionId, name }]
  })
}

function mapOwnerReply(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const text = typeof record.text === 'string' ? record.text.trim() : ''
  const createdAt = (record.createdAt as Timestamp | undefined)?.toDate?.()
  const updatedAt = (record.updatedAt as Timestamp | undefined)?.toDate?.()

  if (!text || !createdAt) {
    return null
  }

  return {
    text,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt?.toISOString(),
  }
}

function mapPublicReview(id: string, data: FirebaseFirestore.DocumentData) {
  const rating = typeof data.rating === 'number' ? data.rating : null
  const comment = typeof data.comment === 'string' ? data.comment : ''
  const createdAt = (data.createdAt as Timestamp | undefined)?.toDate?.()
  const mediaItems = mapReviewMediaItems(data.mediaItems)
  const legacyHasPhoto = data.hasPhoto === true
  const hasPhoto = legacyHasPhoto || mediaItems.some((item) => item.type === 'image')

  if (rating == null || !createdAt) {
    return null
  }

  return {
    id,
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    rating,
    comment,
    hasPhoto,
    mediaItems,
    taggedProducts: mapReviewTaggedProducts(data.taggedProducts),
    taggedPromotions: mapReviewTaggedPromotions(data.taggedPromotions),
    createdAt: createdAt.toISOString(),
    ownerReply: mapOwnerReply(data.ownerReply),
  }
}

router.post('/:slug/deposit-intent', async (req: Request, res: Response) => {
  try {
    const record = await getCompanyRecordBySlug(req.params.slug)

    if (!record) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    if (!companyAcceptsReservations(record.data.reservationMode)) {
      res.status(409).json({ error: 'Este restaurante no admite reservas.' })
      return
    }

    const pax = asInt(req.body?.pax, 1, 50, 'El número de comensales')

    const depositMinPax = typeof record.data.depositMinPax === 'number'
      ? record.data.depositMinPax
      : null
    const depositPerGuestCents = typeof record.data.depositPerGuestCents === 'number'
      ? record.data.depositPerGuestCents
      : null
    const depositEnabled = record.data.depositEnabled === true
      || (typeof depositMinPax === 'number' && depositMinPax > 0)
    const stripeAccountId = typeof record.data.stripeAccountId === 'string'
      ? record.data.stripeAccountId
      : null
    const stripeChargesEnabled = record.data.stripeChargesEnabled === true

    const amountCents = depositEnabled
      ? computeDepositAmountCents(pax, depositMinPax, depositPerGuestCents)
      : 0

    if (amountCents <= 0) {
      res.json({ required: false, amountCents: 0 })
      return
    }

    if (!stripeAccountId || !stripeChargesEnabled) {
      res.status(409).json({
        error: 'Este restaurante aún no puede cobrar fianzas. Contacta con el local.',
      })
      return
    }

    const payment = await createDepositPaymentIntent({
      connectedAccountId: stripeAccountId,
      amountCents,
      companyId: record.id,
      slug: req.params.slug,
      pax,
    })

    res.json({
      required: true,
      amountCents,
      depositMinPax,
      depositPerGuestCents,
      stripeAccountId,
      clientSecret: payment.clientSecret,
      paymentIntentId: payment.paymentIntentId,
    })
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Public deposit intent error:', error)
    res.status(500).json({ error: 'No se pudo preparar la fianza.' })
  }
})

router.get('/:slug/reviews', async (req: Request, res: Response) => {
  try {
    const companySnap = await adminDb
      .collection('companies')
      .where('slug', '==', req.params.slug)
      .limit(1)
      .get()

    if (companySnap.empty) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const companyDoc = companySnap.docs[0]
    const companyData = companyDoc.data()
    const reviewCount = typeof companyData.reviewCount === 'number' ? companyData.reviewCount : 0
    const reviewRatingSum = typeof companyData.reviewRatingSum === 'number'
      ? companyData.reviewRatingSum
      : 0

    const reviewsSnapshot = await adminDb
      .collection('companies')
      .doc(companyDoc.id)
      .collection('reviews')
      .limit(80)
      .get()

    const reviews = reviewsSnapshot.docs
      .map((item) => mapPublicReview(item.id, item.data()))
      .filter((review): review is NonNullable<typeof review> => review !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

    const count = reviews.length > 0 ? reviews.length : reviewCount
    const ratingSum = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0)
      : reviewRatingSum
    const averageRating = count > 0 ? Math.round((ratingSum / count) * 10) / 10 : 0

    allowPublicCache(res, 60)
    res.json({
      stats: {
        reviewCount: count,
        reviewRatingSum: ratingSum,
        averageRating,
      },
      reviews,
    })
  } catch (error) {
    console.error('Public reviews load error:', error)
    res.status(500).json({ error: 'No se pudieron cargar las reseñas.' })
  }
})

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const company = await getCompanyBySlug(req.params.slug)

    if (!company) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const tablesSnapshot = await adminDb
      .collection('tables')
      .where('companyId', '==', company.id)
      .limit(80)
      .get()

    const tables = tablesSnapshot.docs
      .map((item) => ({
        id: item.id,
        name: item.data().name as string,
        capacity: (item.data().capacity as number) ?? 2,
        sortOrder: (item.data().sortOrder as number) ?? 0,
        floorPlanId: typeof item.data().floorPlanId === 'string' ? item.data().floorPlanId : '',
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))

    allowPublicCache(res, 60)
    res.json({ company, tables })
  } catch (error) {
    console.error('Public booking load error:', error)
    res.status(500).json({ error: 'No se pudo cargar la información del restaurante.' })
  }
})

router.get('/:slug/availability', async (req: Request, res: Response) => {
  try {
    const company = await getCompanyBySlug(req.params.slug)

    if (!company) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    if (!companyAcceptsReservations(company.reservationMode)) {
      res.status(409).json({ error: 'Este restaurante no admite reservas.' })
      return
    }

    const dateParam = String(req.query.date ?? '')

    let date: Date

    try {
      date = parseBookingDate(dateParam)
    } catch {
      res.status(400).json({ error: 'Indica una fecha válida (YYYY-MM-DD).' })
      return
    }

    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const reservationsSnapshot = await adminDb
      .collection('reservations')
      .where('companyId', '==', company.id)
      .where('startTime', '>=', Timestamp.fromDate(dayStart))
      .where('startTime', '<', Timestamp.fromDate(dayEnd))
      .limit(400)
      .get()

    const reservations = reservationsSnapshot.docs
      .map((item) => {
        const data = item.data()
        const startTime = data.startTime?.toDate?.() as Date | undefined
        const endTime = data.endTime?.toDate?.() as Date | undefined

        if (!startTime || !endTime) {
          return null
        }

        return {
          id: item.id,
          tableId: data.tableId as string,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          status: data.status as string,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => isSameDay(new Date(item.startTime), date))

    // Cache corta: la disponibilidad cambia según entran reservas, pero la
    // reserva final está protegida por transacción (devuelve 409 si el hueco
    // se ocupó mientras tanto), así que unos segundos de desfase son seguros.
    allowPublicCache(res, 15)
    res.json({ date: dateParam, reservations })
  } catch (error) {
    console.error('Public availability error:', error)
    res.status(500).json({ error: 'No se pudo cargar la disponibilidad.' })
  }
})

router.post('/:slug/reservations', async (req: Request, res: Response) => {
  try {
    const record = await getCompanyRecordBySlug(req.params.slug)

    if (!record) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    if (!companyAcceptsReservations(record.data.reservationMode ?? record.public.reservationMode)) {
      res.status(409).json({ error: 'Este restaurante no admite reservas.' })
      return
    }

    const company = record.public

    const customer = await resolveBookingCustomer(req)

    const {
      date: dateParam,
      time,
      tableId,
      clientName,
      clientEmail = '',
      clientPhone = '',
      pax,
      notes = '',
      promotionId: promotionIdRaw,
      depositPaymentIntentId: depositPaymentIntentIdRaw,
    } = req.body as Record<string, unknown>

    const name = customer
      ? customer.displayName
      : asPlainText(clientName, 80, 'Tu nombre')
    const email = customer
      ? customer.email
      : typeof clientEmail === 'string' ? clientEmail.trim().toLowerCase() : ''
    const phone = customer
      ? customer.phone
      : asOptionalTrimmed(clientPhone, 30)
    const notesText = asOptionalTrimmed(notes, 500).replace(/<[^>]*>/g, '')

    if (!isValidClientEmail(email)) {
      res.status(400).json({ error: 'Indica un correo electrónico válido.' })
      return
    }

    if (!customer && !phone) {
      res.status(400).json({ error: 'Indica un teléfono de contacto.' })
      return
    }

    const table = asId(tableId, 'La mesa')
    const bookingTime = asOptionalTrimmed(time, 8)
    if (!/^\d{2}:\d{2}$/.test(bookingTime)) {
      res.status(400).json({ error: 'Selecciona una hora.' })
      return
    }

    const guestCount = asInt(pax, 1, 50, 'El número de invitados')
    const bookingDate = asDateYmd(dateParam)

    let date: Date

    try {
      date = parseBookingDate(bookingDate)
    } catch {
      res.status(400).json({ error: 'Fecha inválida.' })
      return
    }

    const tableSnap = await adminDb.collection('tables').doc(table).get()

    if (!tableSnap.exists || tableSnap.data()?.companyId !== company.id) {
      res.status(400).json({ error: 'Mesa no válida.' })
      return
    }

    const tableCapacity = (tableSnap.data()?.capacity as number) ?? 2

    if (guestCount > tableCapacity) {
      if (!customer || req.body?.useExtraPax !== true || guestCount > tableCapacity + 1) {
        res.status(400).json({ error: `Esta mesa admite hasta ${tableCapacity} personas.` })
        return
      }
    }

    try {
      assertReservationStartInFuture(date, bookingTime)
      assertReservationSlotValid(
        table,
        bookingTime,
        date,
        company.schedule,
        company.timeSlotMinutes,
        company.timeSlotMinutes,
        [],
      )
    } catch (validationError) {
      res.status(409).json({
        error:
          validationError instanceof Error
            ? validationError.message
            : 'Horario no disponible.',
      })
      return
    }

    const startTime = combineDateAndTime(date, bookingTime)
    const endTime = new Date(startTime.getTime() + company.timeSlotMinutes * 60000)

    let promotionId: string | null = null
    let minimumSpendCents: number | null = null
    let promotionVisitStatus: 'pending' | 'n/a' | undefined

    if (typeof promotionIdRaw === 'string' && promotionIdRaw.trim()) {
      const promoSnap = await adminDb
        .collection('companies')
        .doc(company.id)
        .collection('promotions')
        .doc(promotionIdRaw.trim())
        .get()

      if (!promoSnap.exists) {
        res.status(400).json({ error: 'La promoción indicada no existe.' })
        return
      }

      const promoData = promoSnap.data()!

      if (promoData.active !== true) {
        res.status(400).json({ error: 'Esta promoción ya no está activa.' })
        return
      }

      promotionId = promoSnap.id

      if (await isPromoLockedForBooking(customer?.uid ?? null, email)) {
        res.status(403).json({ error: PROMO_LOCK_BOOKING_MESSAGE })
        return
      }

      if (
        promoData.minimumSpendEnabled === true
        && typeof promoData.minimumSpendCents === 'number'
        && promoData.minimumSpendCents > 0
      ) {
        minimumSpendCents = promoData.minimumSpendCents
        promotionVisitStatus = 'pending'
      }
    }

    const reservationData: Record<string, unknown> = {
      companyId: company.id,
      tableId: table,
      clientName: name,
      clientEmail: email,
      clientPhone: phone,
      pax: guestCount,
      notes: notesText,
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      status: 'completed',
      cancelToken: randomUUID(),
      schemaVersion: 1,
      createdAt: Timestamp.now(),
    }

    if (promotionId) {
      reservationData.promotionId = promotionId
    }

    if (minimumSpendCents !== null) {
      reservationData.minimumSpendCents = minimumSpendCents
    }

    if (promotionVisitStatus) {
      reservationData.promotionVisitStatus = promotionVisitStatus
    }

    if (customer) {
      reservationData.customerUid = customer.uid
    }

    const depositMinPax = typeof record.data.depositMinPax === 'number'
      ? record.data.depositMinPax
      : null
    const depositPerGuestCents = typeof record.data.depositPerGuestCents === 'number'
      ? record.data.depositPerGuestCents
      : null
    const depositEnabled = record.data.depositEnabled === true
      || (typeof depositMinPax === 'number' && depositMinPax > 0)
    const stripeAccountId = typeof record.data.stripeAccountId === 'string'
      ? record.data.stripeAccountId
      : null
    const depositAmountCents = depositEnabled
      ? computeDepositAmountCents(
        guestCount,
        depositMinPax,
        depositPerGuestCents,
      )
      : 0

    const skipDeposit = req.body?.useDepositPass === true && depositAmountCents > 0
    const useExtraPax = req.body?.useExtraPax === true && guestCount > tableCapacity

    if ((skipDeposit || useExtraPax) && !customer) {
      res.status(401).json({ error: 'Inicia sesión para usar este ítem.' })
      return
    }

    if (depositAmountCents > 0 && !skipDeposit) {
      const depositPaymentIntentId = typeof depositPaymentIntentIdRaw === 'string'
        ? depositPaymentIntentIdRaw.trim()
        : ''

      if (!depositPaymentIntentId || !stripeAccountId) {
        res.status(400).json({ error: 'Debes autorizar la fianza antes de confirmar la reserva.' })
        return
      }

      try {
        await verifyDepositPaymentIntent({
          paymentIntentId: depositPaymentIntentId,
          connectedAccountId: stripeAccountId,
          expectedAmountCents: depositAmountCents,
          companyId: record.id,
        })
      } catch (depositError) {
        console.error('Public reservation deposit verification error:', depositError)
        res.status(400).json({
          error: depositError instanceof Error
            ? depositError.message
            : 'No se pudo verificar la fianza.',
        })
        return
      }

      // Una fianza (PaymentIntent) no puede respaldar más de una reserva.
      const reusedDeposit = await adminDb
        .collection('reservations')
        .where('depositPaymentIntentId', '==', depositPaymentIntentId)
        .limit(1)
        .get()
      if (!reusedDeposit.empty) {
        res.status(409).json({ error: 'Esa fianza ya está asociada a otra reserva.' })
        return
      }

      reservationData.depositAmountCents = depositAmountCents
      reservationData.depositPaymentIntentId = depositPaymentIntentId
      reservationData.depositStatus = 'authorized'
    }

    const reservationRef = adminDb.collection('reservations').doc()
    let consumedInventory: Record<string, number> | null = null

    try {
      if (customer && (skipDeposit || useExtraPax)) {
        const userRef = adminDb.collection('users').doc(customer.uid)
        const statsRef = userGamificationRef(customer.uid)
        const state = await createReservationWithOccupiedSlot({
          reservationRef,
          reservationData,
          companyId: company.id,
          tableId: table,
          startTime,
          endTime,
          prepare: async (transaction) => {
            const [userSnap, statsSnap] = await Promise.all([
              transaction.get(userRef),
              transaction.get(statsRef),
            ])
            let next = readGamificationFromDocs(statsSnap.data(), userSnap.data())
            if (useExtraPax) {
              next = consumeInventoryItem(next, EXTRA_PAX_ITEM_ID, 1)
            }
            if (skipDeposit) {
              next = consumeInventoryItem(next, DEPOSIT_PASS_ITEM_ID, 1)
            }
            return next
          },
          apply: (transaction, state) => {
            writeGamification(transaction, customer.uid, state)
          },
        })
        consumedInventory = state ? numberRecord(state.inventory) : null
      } else {
        await createReservationWithOccupiedSlot({
          reservationRef,
          reservationData,
          companyId: company.id,
          tableId: table,
          startTime,
          endTime,
        })
      }
    } catch (itemError) {
      if (itemError instanceof SlotUnavailableError) {
        res.status(409).json({ error: itemError.message })
        return
      }
      const message = itemError instanceof Error ? itemError.message : 'No se pudo crear la reserva.'
      if (message === 'No te quedan cartas de este tipo.') {
        res.status(403).json({ error: message })
        return
      }
      throw itemError
    }

    res.status(201).json({
      id: reservationRef.id,
      message: 'Hemos recibido tu reserva.',
      ...(consumedInventory ? { inventory: consumedInventory } : {}),
    })

    if (customer) {
      try {
        const photos = Array.isArray(record.data.photos) ? record.data.photos : []
        const photoUrl = (typeof photos[0] === 'string' && photos[0].trim()
          ? photos[0].trim()
          : typeof record.data.logoUrl === 'string' ? record.data.logoUrl : '') || ''

        await createReservationInvites({
          reservationId: reservationRef.id,
          startTime,
          pax: guestCount,
          companyId: company.id,
          companyName: company.name,
          companySlug: company.slug,
          companyPhotoUrl: photoUrl,
          fromUid: customer.uid,
          fromDisplayName: customer.displayName,
          fromPhotoUrl: customer.photoUrl,
          inviteeUids: req.body?.inviteeUids,
        })
      } catch (inviteError) {
        console.error('Public reservation invites error:', inviteError)
      }
    }
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    if (error instanceof SlotUnavailableError) {
      res.status(409).json({ error: error.message })
      return
    }
    console.error('Public reservation error:', error)
    res.status(500).json({ error: 'No se pudo crear la reserva.' })
  }
})

router.get('/cancel/preview', async (req: Request, res: Response) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim().slice(0, 80) : ''

    if (!token) {
      res.status(400).json({ error: 'Enlace de cancelación no válido.' })
      return
    }

    const reservationRecord = await findReservationByCancelToken(token)

    if (!reservationRecord) {
      res.status(404).json({ error: 'No encontramos ninguna reserva con este enlace.' })
      return
    }

    const reservation = reservationRecord.data
    const companyId = typeof reservation.companyId === 'string' ? reservation.companyId : null
    let companyName = ''
    let depositCancellationHours: number | null = null

    if (companyId) {
      const companySnap = await adminDb.collection('companies').doc(companyId).get()
      const companyData = companySnap.data()
      companyName = typeof companyData?.name === 'string' ? companyData.name : ''
      depositCancellationHours = typeof companyData?.depositCancellationHours === 'number'
        ? companyData.depositCancellationHours
        : null
    }

    const startTimeValue = reservation.startTime as { toDate?: () => Date } | undefined
    const startTime = startTimeValue && typeof startTimeValue.toDate === 'function'
      ? startTimeValue.toDate().toISOString()
      : null
    const depositPreview = previewDepositCancellation({
      reservation,
      depositCancellationHours,
    })
    const xpPenalty = reservation.status === 'cancelled'
      ? null
      : await previewCancellationPenalty(reservation as Record<string, unknown>, reservationRecord.id)
    const cancelShieldCount = reservation.status === 'cancelled'
      ? 0
      : await previewCancelShieldCount(reservation as Record<string, unknown>)

    res.json({
      companyName,
      clientName: typeof reservation.clientName === 'string' ? reservation.clientName : '',
      pax: typeof reservation.pax === 'number' ? reservation.pax : null,
      startTime,
      status: typeof reservation.status === 'string' ? reservation.status : 'completed',
      alreadyCancelled: reservation.status === 'cancelled',
      depositAmountCents: depositPreview.depositAmountCents,
      depositCancellationHours,
      hasAuthorizedDeposit: depositPreview.hasAuthorizedDeposit,
      willChargeDeposit: depositPreview.willCaptureDeposit,
      xpPenalty: xpPenalty
        ? {
            xpLost: xpPenalty.xpLost,
            percent: xpPenalty.percent,
            strikeCount: xpPenalty.strikeCount,
            nextPercent: xpPenalty.nextPercent,
            promoLocked: xpPenalty.promoLocked,
            justLocked: xpPenalty.justLocked,
            warning: xpPenalty.warning,
            xpAfter: xpPenalty.xpAfter,
            xpBefore: xpPenalty.xpBefore,
          }
        : null,
      hasCustomerAccount: Boolean(xpPenalty),
      cancelShieldCount,
    })
  } catch (error) {
    console.error('Public reservation cancel preview error:', error)
    res.status(500).json({ error: 'No se pudo cargar la información de cancelación.' })
  }
})

router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''

    if (!token) {
      res.status(400).json({ error: 'Enlace de cancelación no válido.' })
      return
    }

    const reservationRecord = await findReservationByCancelToken(token)

    if (!reservationRecord) {
      res.status(404).json({ error: 'No encontramos ninguna reserva con este enlace.' })
      return
    }

    const reservationRef = reservationRecord.ref
    const reservation = reservationRecord.data

    if (reservation.status === 'cancelled') {
      res.status(409).json({ error: 'Esta reserva ya estaba cancelada.' })
      return
    }

    let depositOutcome: DepositCancelOutcome = 'none'
    let depositAmountCents: number | null = typeof reservation.depositAmountCents === 'number'
      ? reservation.depositAmountCents
      : null

    if (typeof reservation.companyId === 'string') {
      const companyData = await readCompanyOps(reservation.companyId)
      const stripeAccountId = companyData?.stripeAccountId as string | undefined
      const depositCancellationHours = typeof companyData?.depositCancellationHours === 'number'
        ? companyData.depositCancellationHours
        : null

      depositOutcome = await processReservationDepositOnCancel({
        reservationId: reservationRecord.id,
        reservation,
        stripeAccountId,
        depositCancellationHours,
      })
    }

    const useCancelShield = req.body?.useCancelShield === true

    await reservationRef.update({
      status: 'cancelled',
      cancelledBy: 'client',
      cancelShieldRequested: useCancelShield,
      updatedAt: Timestamp.now(),
    })

    try {
      await cancelInvitesForReservation(reservationRecord.id)
    } catch (inviteError) {
      console.error('Cancel reservation invites error:', inviteError)
    }

    let penalty = null
    try {
      const notified = await notifyReservationCancelled(
        reservationRecord.id,
        {
          ...reservation,
          status: 'cancelled',
          cancelledBy: 'client',
          cancelShieldRequested: useCancelShield,
        },
        'client',
      )
      penalty = notified.penalty
    } catch (notificationError) {
      console.error('Cancel notification error:', notificationError)
    }

    res.json({
      message: buildPublicCancelSuccessMessage(depositOutcome, depositAmountCents),
      depositOutcome,
      depositCharged: depositOutcome === 'captured',
      xpPenalty: penalty
        ? {
            xpLost: penalty.xpLost,
            percent: penalty.percent,
            strikeCount: penalty.strikeCount,
            nextPercent: penalty.nextPercent,
            promoLocked: penalty.promoLocked,
            justLocked: penalty.justLocked,
            warning: penalty.warning,
            xpAfter: penalty.xpAfter,
            xpBefore: penalty.xpBefore,
            shielded: penalty.shielded === true,
          }
        : null,
    })
  } catch (error) {
    console.error('Public reservation cancel error:', error)
    res.status(500).json({
      error: error instanceof Error
        ? error.message
        : 'No se pudo cancelar la reserva.',
    })
  }
})

export default router
