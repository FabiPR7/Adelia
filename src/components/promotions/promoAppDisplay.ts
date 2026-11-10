import type { PublicPromotion } from '../../services/publicPromotions'
import { CLOUDINARY_DISPLAY, ensureHttpsUrl, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import { sortCompanyLadderPromotions } from '../../utils/promotionReservationProgress'
import { haversineDistanceKm } from '../../utils/geo'

/** Foto de la promo; si no tiene, la de un producto incluido o la del local. */
export function getPromotionHeroUrl(
  promotion: PublicPromotion,
  size: keyof typeof CLOUDINARY_DISPLAY = 'photoPreview',
): string {
  const raw = promotion.photoUrl?.trim()
    || promotion.productRefs?.find((ref) => ref.photoUrl?.trim())?.photoUrl
    || promotion.companyPhotoUrl?.trim()
    || ''

  return raw ? optimizeCloudinaryUrl(ensureHttpsUrl(raw), CLOUDINARY_DISPLAY[size]) : ''
}

export function promotionTypeLabel(type: string): string {
  if (type === 'reservation_ladder') return 'Fidelidad'
  if (type === 'time_limited') return 'Horario'
  if (type === 'attendance') return 'Asistencia'
  return 'Promo'
}

export function formatDistance(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null) return null
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1).replace('.', ',')} km`
}

export function isLadderStep(promotion: PublicPromotion): boolean {
  return promotion.type === 'reservation_ladder' && (promotion.requiredReservations ?? 0) > 0
}

export function promotionDistanceKm(
  promotion: PublicPromotion,
  coords: { lat: number; lng: number } | null,
): number | null {
  if (!coords || promotion.companyLatitude == null || promotion.companyLongitude == null) {
    return null
  }
  return haversineDistanceKm(coords, {
    lat: promotion.companyLatitude,
    lng: promotion.companyLongitude,
  })
}

export interface RestaurantPromoGroup {
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  distanceKm: number | null
  promotions: PublicPromotion[]
}

function compareGroups(left: RestaurantPromoGroup, right: RestaurantPromoGroup): number {
  if (left.distanceKm != null && right.distanceKm != null) {
    return left.distanceKm - right.distanceKm
  }
  if (left.distanceKm != null) return -1
  if (right.distanceKm != null) return 1
  return left.companyName.localeCompare(right.companyName, 'es')
}

/** Agrupa por restaurante: primero los más cercanos, si hay ubicación; si no, por nombre. */
export function groupPromotionsByRestaurant(
  promotions: PublicPromotion[],
  coords: { lat: number; lng: number } | null,
): RestaurantPromoGroup[] {
  const byCompany = new Map<string, RestaurantPromoGroup>()

  for (const promotion of promotions) {
    const existing = byCompany.get(promotion.companyId)
    if (existing) {
      existing.promotions.push(promotion)
      continue
    }
    byCompany.set(promotion.companyId, {
      companyId: promotion.companyId,
      companyName: promotion.companyName,
      companySlug: promotion.companySlug,
      companyPhotoUrl: promotion.companyPhotoUrl,
      distanceKm: promotionDistanceKm(promotion, coords),
      promotions: [promotion],
    })
  }

  return [...byCompany.values()].sort(compareGroups)
}

/** Restaurantes con mapa de premios (escalera de fidelidad), con los pasos ordenados. */
export function groupLadderRestaurants(
  promotions: PublicPromotion[],
  coords: { lat: number; lng: number } | null,
): Array<RestaurantPromoGroup & { ladderPromotions: PublicPromotion[] }> {
  return groupPromotionsByRestaurant(promotions.filter(isLadderStep), coords)
    .map((group) => ({ ...group, ladderPromotions: sortCompanyLadderPromotions(group.promotions) }))
    .filter((group) => group.companySlug && group.ladderPromotions.length > 0)
}
