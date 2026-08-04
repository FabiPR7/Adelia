import { Router, type Request, type Response } from 'express'
import { adminDb } from '../firebase-admin.ts'

const router = Router()

export interface PublicPromotionPayload {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  type: string
  title: string
  description: string
  photoUrl: string
  requiredReservations: number | null
  activeFromTime: string
  activeToTime: string
  maxRedemptions: number | null
  currentRedemptions: number
  detail: string
  highlight: string
}

function buildHighlight(data: FirebaseFirestore.DocumentData): string {
  if (data.type === 'reservation_ladder') {
    return `${data.requiredReservations ?? 0} reservas`
  }

  if (data.type === 'time_limited') {
    const max = data.maxRedemptions as number | null
    return max ? `${Math.max(0, max - ((data.currentRedemptions as number) ?? 0))} plazas` : 'Limitado'
  }

  return 'Puntual'
}

function buildDetail(data: FirebaseFirestore.DocumentData): string {
  if (data.type === 'reservation_ladder') {
    return `${data.requiredReservations ?? 0} reservas`
  }

  if (data.type === 'time_limited') {
    return `${data.activeFromTime ?? ''}-${data.activeToTime ?? ''}`.trim()
  }

  return `${data.arrivalWindowMinutes ?? 30} min`
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const companiesSnapshot = await adminDb.collection('companies').get()
    const promotions: PublicPromotionPayload[] = []

    for (const companyDoc of companiesSnapshot.docs) {
      const companyData = companyDoc.data()
      const promotionsSnapshot = await companyDoc.ref
        .collection('promotions')
        .where('active', '==', true)
        .get()

      for (const promotionDoc of promotionsSnapshot.docs) {
        const data = promotionDoc.data()
        const photos = Array.isArray(companyData.photos) ? companyData.photos : []
        const logoUrl = (companyData.logoUrl as string) ?? ''

        promotions.push({
          id: promotionDoc.id,
          companyId: companyDoc.id,
          companyName: (companyData.name as string) ?? 'Restaurante',
          companySlug: (companyData.slug as string) ?? '',
          companyPhotoUrl: (photos[0] as string) ?? logoUrl,
          type: (data.type as string) ?? 'time_limited',
          title: (data.title as string) ?? '',
          description: (data.description as string) ?? '',
          photoUrl: (data.photoUrl as string) ?? (photos[0] as string) ?? logoUrl,
          requiredReservations: typeof data.requiredReservations === 'number'
            ? data.requiredReservations
            : null,
          activeFromTime: (data.activeFromTime as string) ?? '',
          activeToTime: (data.activeToTime as string) ?? '',
          maxRedemptions: typeof data.maxRedemptions === 'number' ? data.maxRedemptions : null,
          currentRedemptions: typeof data.currentRedemptions === 'number' ? data.currentRedemptions : 0,
          detail: buildDetail(data),
          highlight: buildHighlight(data),
        })
      }
    }

    promotions.sort((left, right) => left.companyName.localeCompare(right.companyName, 'es'))

    res.json({ promotions: promotions.slice(0, 12) })
  } catch (error) {
    console.error('Public promotions error:', error)
    res.status(500).json({ error: 'No se pudieron cargar las promociones.' })
  }
})

export default router
