import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { getUserRoleWithRest, verifyIdTokenWithRest } from '../rest-firebase.ts'
import {
  applyDuePromotionPinRotation,
  defaultPromotionPinSettings,
  mapPromotionPin,
  normalizePromotionPinCode,
  type PromotionPinSettings,
} from '../utils/promotionPin.ts'

const router = Router()

interface PromotionOfferConfig {
  kind: string
  bundleGet: number | null
  bundlePay: number | null
  discountPercent: number | null
  fixedPriceCents: number | null
  customLabel: string
}

interface PromotionProductRef {
  nodeId: string
  name: string
  photoUrl: string
}

export interface PublicPromotionPayload {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  companyLatitude: number | null
  companyLongitude: number | null
  type: string
  title: string
  description: string
  photoUrl: string
  offer: PromotionOfferConfig | null
  productRefs: PromotionProductRef[]
  requiredReservations: number | null
  minimumSpendEnabled: boolean
  minimumSpendCents: number | null
  activeFromTime: string
  activeToTime: string
  arrivalWindowMinutes: number | null
  maxRedemptions: number | null
  currentRedemptions: number
  detail: string
  highlight: string
}

function normalizeOffer(data: FirebaseFirestore.DocumentData): PromotionOfferConfig | null {
  const raw = data.offer
  if (raw && typeof raw === 'object') {
    const offer = raw as Partial<PromotionOfferConfig>
    return {
      kind: typeof offer.kind === 'string' ? offer.kind : 'custom',
      bundleGet: typeof offer.bundleGet === 'number' ? offer.bundleGet : null,
      bundlePay: typeof offer.bundlePay === 'number' ? offer.bundlePay : null,
      discountPercent: typeof offer.discountPercent === 'number' ? offer.discountPercent : null,
      fixedPriceCents: typeof offer.fixedPriceCents === 'number' ? offer.fixedPriceCents : null,
      customLabel: typeof offer.customLabel === 'string' ? offer.customLabel : '',
    }
  }

  if (typeof data.offerHighlight === 'string' && data.offerHighlight.trim()) {
    return {
      kind: 'custom',
      bundleGet: null,
      bundlePay: null,
      discountPercent: null,
      fixedPriceCents: null,
      customLabel: data.offerHighlight.trim(),
    }
  }

  return null
}

function normalizeProductRefs(data: FirebaseFirestore.DocumentData): PromotionProductRef[] {
  if (!Array.isArray(data.productRefs)) {
    return []
  }

  return data.productRefs
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const ref = entry as Partial<PromotionProductRef>
      if (typeof ref.nodeId !== 'string' || !ref.nodeId.trim()) {
        return null
      }

      return {
        nodeId: ref.nodeId,
        name: typeof ref.name === 'string' ? ref.name : '',
        photoUrl: typeof ref.photoUrl === 'string' ? ref.photoUrl : '',
      }
    })
    .filter((entry): entry is PromotionProductRef => entry !== null)
}

function formatOfferBadge(offer: PromotionOfferConfig): string {
  switch (offer.kind) {
    case 'bundle':
      return offer.bundleGet && offer.bundlePay ? `${offer.bundleGet}×${offer.bundlePay}` : 'Oferta'
    case 'discount':
      return offer.discountPercent != null ? `${offer.discountPercent}% Descuento` : 'Descuento'
    case 'fixed_price':
      return offer.fixedPriceCents != null
        ? `${(offer.fixedPriceCents / 100).toFixed(2).replace('.', ',')} €`
        : 'Precio especial'
    case 'second_unit':
      return offer.discountPercent != null ? `2ª ${offer.discountPercent}% dto.` : '2ª unidad'
    case 'free_item':
      return 'GRATIS'
    case 'custom':
      return offer.customLabel.trim() || 'Promo'
    default:
      return 'Promo'
  }
}

function formatReservationCount(count: number): string {
  return `${count} reserva${count === 1 ? '' : 's'}`
}

function buildHighlight(
  data: FirebaseFirestore.DocumentData,
  offer: PromotionOfferConfig | null,
): string {
  if (offer && offer.kind !== 'custom') {
    return formatOfferBadge(offer)
  }

  if (offer?.kind === 'custom') {
    if (offer.customLabel.trim()) {
      return offer.customLabel.trim()
    }
    if (data.type === 'reservation_ladder' && typeof data.requiredReservations === 'number') {
      return formatReservationCount(data.requiredReservations)
    }
  }

  if (data.type === 'reservation_ladder' && typeof data.requiredReservations === 'number') {
    return formatReservationCount(data.requiredReservations)
  }

  if (data.type === 'time_limited') {
    const max = data.maxRedemptions as number | null
    if (max) {
      return `${Math.max(0, max - ((data.currentRedemptions as number) ?? 0))} plazas`
    }
    return 'Limitado'
  }

  return 'Puntual'
}

function buildDetail(data: FirebaseFirestore.DocumentData): string {
  if (data.type === 'reservation_ladder' && typeof data.requiredReservations === 'number') {
    return formatReservationCount(data.requiredReservations)
  }

  if (data.type === 'time_limited') {
    const from = (data.activeFromTime as string) ?? ''
    const to = (data.activeToTime as string) ?? ''
    return `${from}-${to}`.replace(/^-|-$/g, '').trim() || 'Tiempo limitado'
  }

  if (data.type === 'attendance') {
    return `${typeof data.arrivalWindowMinutes === 'number' ? data.arrivalWindowMinutes : 30} min`
  }

  return ''
}

async function loadPromotionsForCompany(
  companyDoc: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<PublicPromotionPayload[]> {
  const companyData = companyDoc.data()
  const promotionsSnapshot = await companyDoc.ref
    .collection('promotions')
    .where('active', '==', true)
    .get()

  const photos = Array.isArray(companyData.photos) ? companyData.photos : []
  const logoUrl = (companyData.logoUrl as string) ?? ''
  const mainPhotoIndex = typeof companyData.mainPhotoIndex === 'number'
    ? Math.max(0, Math.min(photos.length - 1, companyData.mainPhotoIndex))
    : 0
  const companyPhotoUrl = (photos[mainPhotoIndex] as string) ?? (photos[0] as string) ?? logoUrl

  return promotionsSnapshot.docs.map((promotionDoc) => {
    const data = promotionDoc.data()
    const offer = normalizeOffer(data)
    const productRefs = normalizeProductRefs(data)
    const productPhoto = productRefs.find((ref) => ref.photoUrl.trim())?.photoUrl ?? ''

    return {
      id: promotionDoc.id,
      companyId: companyDoc.id,
      companyName: (companyData.name as string) ?? 'Restaurante',
      companySlug: (companyData.slug as string) ?? '',
      companyPhotoUrl,
      companyLatitude: typeof companyData.latitude === 'number' ? companyData.latitude : null,
      companyLongitude: typeof companyData.longitude === 'number' ? companyData.longitude : null,
      type: (data.type as string) ?? 'time_limited',
      title: (data.title as string) ?? '',
      description: (data.description as string) ?? '',
      photoUrl: (data.photoUrl as string) ?? productPhoto ?? companyPhotoUrl,
      offer,
      productRefs,
      requiredReservations: typeof data.requiredReservations === 'number'
        ? data.requiredReservations
        : null,
      minimumSpendEnabled: data.minimumSpendEnabled === true,
      minimumSpendCents: typeof data.minimumSpendCents === 'number'
        ? data.minimumSpendCents
        : null,
      activeFromTime: (data.activeFromTime as string) ?? '',
      activeToTime: (data.activeToTime as string) ?? '',
      arrivalWindowMinutes: typeof data.arrivalWindowMinutes === 'number'
        ? data.arrivalWindowMinutes
        : null,
      maxRedemptions: typeof data.maxRedemptions === 'number' ? data.maxRedemptions : null,
      currentRedemptions: typeof data.currentRedemptions === 'number' ? data.currentRedemptions : 0,
      detail: buildDetail(data),
      highlight: buildHighlight(data, offer),
    }
  })
}

function serializePromotionPin(settings: PromotionPinSettings) {
  return {
    code: settings.code,
    rotation: settings.rotation,
    nextRotationAt: settings.nextRotationAt ? Timestamp.fromDate(settings.nextRotationAt) : null,
    lastRotatedAt: settings.lastRotatedAt ? Timestamp.fromDate(settings.lastRotatedAt) : null,
    updatedAt: Timestamp.now(),
  }
}

async function resolveCompanyPromotionPin(
  companyRef: FirebaseFirestore.DocumentReference,
  companyData: FirebaseFirestore.DocumentData,
): Promise<string> {
  const stored = mapPromotionPin(companyData.promotionPin as Record<string, unknown> | undefined)
  const base = stored ?? defaultPromotionPinSettings()
  const { settings, rotated } = applyDuePromotionPinRotation(base)

  if (rotated) {
    await companyRef.update({
      promotionPin: serializePromotionPin(settings),
    })
  }

  return settings.code
}

async function verifyCustomerToken(req: Request): Promise<string | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return null
  }

  const token = header.slice(7)

  if (canUseAdminSdk) {
    const decoded = await adminAuth.verifyIdToken(token)
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()

    if (!userSnap.exists || userSnap.data()?.role !== 'customer') {
      return null
    }

    return decoded.uid
  }

  const decoded = await verifyIdTokenWithRest(token)
  const role = await getUserRoleWithRest(token, decoded.uid)

  if (role !== 'customer') {
    return null
  }

  return decoded.uid
}

router.post('/validate-pin', async (req: Request, res: Response) => {
  try {
    const uid = await verifyCustomerToken(req)
    if (!uid) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const { companyId, pin } = req.body as { companyId?: string; pin?: string }
    const normalizedCompanyId = String(companyId ?? '').trim()
    const normalizedPin = normalizePromotionPinCode(String(pin ?? ''))

    if (!normalizedCompanyId) {
      res.status(400).json({ error: 'Restaurante no válido.' })
      return
    }

    if (normalizedPin.length !== 4) {
      res.status(400).json({ error: 'El código PIN debe tener 4 dígitos.' })
      return
    }

    const companyRef = adminDb.collection('companies').doc(normalizedCompanyId)
    const companySnap = await companyRef.get()

    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const currentPin = await resolveCompanyPromotionPin(companyRef, companySnap.data()!)
    res.json({ valid: currentPin === normalizedPin })
  } catch (error) {
    console.error('Validate promotion pin error:', error)
    res.status(500).json({ error: 'No se pudo validar el código PIN.' })
  }
})

router.get('/', async (_req: Request, res: Response) => {
  try {
    const companiesSnapshot = await adminDb.collection('companies').get()
    const promotions: PublicPromotionPayload[] = []

    for (const companyDoc of companiesSnapshot.docs) {
      promotions.push(...await loadPromotionsForCompany(companyDoc))
    }

    promotions.sort((left, right) => left.companyName.localeCompare(right.companyName, 'es'))

    res.json({ promotions: promotions.slice(0, 12) })
  } catch (error) {
    console.error('Public promotions error:', error)
    res.status(500).json({ error: 'No se pudieron cargar las promociones.' })
  }
})

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug ?? '').trim().toLowerCase()
    if (!slug) {
      res.status(400).json({ error: 'Slug inválido.' })
      return
    }

    const companiesSnapshot = await adminDb.collection('companies')
      .where('slug', '==', slug)
      .limit(1)
      .get()

    if (companiesSnapshot.empty) {
      res.json({ promotions: [] })
      return
    }

    const promotions = await loadPromotionsForCompany(companiesSnapshot.docs[0])
    res.json({ promotions })
  } catch (error) {
    console.error('Public promotions by slug error:', error)
    res.status(500).json({ error: 'No se pudieron cargar las promociones.' })
  }
})

export default router
