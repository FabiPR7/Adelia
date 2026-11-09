export type MapMarkerSize = 'large' | 'medium' | 'small'
export type MapPromoTier = 0 | 1 | 2 | 3

export interface ScreenPoint {
  x: number
  y: number
}

/** Ancho de la tarjeta grande: por debajo de esta separación ya se pisan. */
const LARGE_MIN_GAP_PX = 104
const MEDIUM_MIN_GAP_PX = 74

export const MAP_MARKER_DIMENSIONS: Record<MapMarkerSize, { size: [number, number]; anchor: [number, number] }> = {
  large: { size: [96, 104], anchor: [48, 104] },
  medium: { size: [70, 78], anchor: [35, 78] },
  small: { size: [46, 54], anchor: [23, 54] },
}

/** Distancia en píxeles de cada punto a su vecino más cercano (Infinity si está solo). */
export function nearestNeighborDistances(points: ScreenPoint[]): number[] {
  return points.map((point, index) => {
    let nearest = Number.POSITIVE_INFINITY

    points.forEach((other, otherIndex) => {
      if (otherIndex === index) {
        return
      }
      const distance = Math.hypot(point.x - other.x, point.y - other.y)
      if (distance < nearest) {
        nearest = distance
      }
    })

    return nearest
  })
}

/** Cuanto más pegado está un local a otro, más pequeño se dibuja para que quepan todos. */
export function markerSizeForGap(gapPx: number): MapMarkerSize {
  if (gapPx >= LARGE_MIN_GAP_PX) {
    return 'large'
  }
  if (gapPx >= MEDIUM_MIN_GAP_PX) {
    return 'medium'
  }
  return 'small'
}

/** 0 sin promociones, 1 con una, 2 con dos y 3 con tres o más. */
export function promoTierForCount(count: number): MapPromoTier {
  if (count >= 3) {
    return 3
  }
  if (count === 2) {
    return 2
  }
  return count === 1 ? 1 : 0
}

export function countPromotionsByCompany(promotions: Array<{ companyId: string }>): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const promotion of promotions) {
    if (promotion.companyId) {
      counts[promotion.companyId] = (counts[promotion.companyId] ?? 0) + 1
    }
  }

  return counts
}
