import type {
  MenuNode,
  PromotionOfferConfig,
  PromotionProductRef,
} from '../types/company'

export const PROMOTION_COLLAGE_MAX_VISIBLE = 4

export function normalizePromotionOffer(data: Record<string, unknown>): PromotionOfferConfig {
  const raw = data.offer
  if (raw && typeof raw === 'object') {
    const offer = raw as Partial<PromotionOfferConfig>
    return {
      kind: offer.kind ?? 'custom',
      bundleGet: typeof offer.bundleGet === 'number' ? offer.bundleGet : null,
      bundlePay: typeof offer.bundlePay === 'number' ? offer.bundlePay : null,
      discountPercent: typeof offer.discountPercent === 'number' ? offer.discountPercent : null,
      fixedPriceCents: typeof offer.fixedPriceCents === 'number' ? offer.fixedPriceCents : null,
      customLabel: typeof offer.customLabel === 'string' ? offer.customLabel : '',
    }
  }

  return {
    kind: 'custom',
    bundleGet: null,
    bundlePay: null,
    discountPercent: null,
    fixedPriceCents: null,
    customLabel: typeof data.offerHighlight === 'string' ? data.offerHighlight : '',
  }
}

export function normalizePromotionProductRefs(data: Record<string, unknown>): PromotionProductRef[] {
  const raw = data.productRefs
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
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

export function buildPromotionProductRefs(
  productIds: string[],
  menuProducts: MenuNode[],
): PromotionProductRef[] {
  return productIds
    .map((nodeId) => {
      const product = menuProducts.find((item) => item.id === nodeId)
      if (!product) {
        return null
      }

      return {
        nodeId: product.id,
        name: product.name,
        photoUrl: product.photoUrl,
      }
    })
    .filter((entry): entry is PromotionProductRef => entry !== null)
}

export function formatPromotionOfferHighlight(offer: PromotionOfferConfig): string {
  return formatPromotionOfferBadge(offer)
}

/** Texto del distintivo principal en la tarjeta de promo (2×1, 5% Descuento, etc.). */
export function formatPromotionOfferBadge(offer: PromotionOfferConfig): string {
  switch (offer.kind) {
    case 'bundle':
      if (offer.bundleGet && offer.bundlePay) {
        return `${offer.bundleGet}×${offer.bundlePay}`
      }
      return 'Oferta'
    case 'discount':
      return offer.discountPercent != null
        ? `${offer.discountPercent}% Descuento`
        : 'Descuento'
    case 'fixed_price':
      if (offer.fixedPriceCents != null) {
        return `${(offer.fixedPriceCents / 100).toFixed(2).replace('.', ',')} €`
      }
      return 'Precio especial'
    case 'second_unit':
      return offer.discountPercent != null
        ? `2ª ${offer.discountPercent}% dto.`
        : '2ª unidad'
    case 'free_item':
      return 'GRATIS'
    case 'custom':
      return offer.customLabel.trim() || 'Promo'
    default:
      return 'Promo'
  }
}

export interface PromotionDisplayFields {
  type: string
  requiredReservations: number | null
  activeFromTime?: string
  activeToTime?: string
  arrivalWindowMinutes?: number | null
  maxRedemptions?: number | null
  currentRedemptions?: number
  minimumSpendEnabled?: boolean
  minimumSpendCents?: number | null
  highlight?: string
  detail?: string
  offer?: PromotionOfferConfig | null
}

export function formatReservationOrConsumptionCount(count: number): string {
  return count === 1 ? '1 reserva o consumo' : `${count} reservas o consumos`
}

/** Distintivo que sobresale en la imagen de la promo. */
export function resolvePromotionHighlight(
  promotion: PromotionDisplayFields,
  fallbackIndex = 0,
): string {
  const offer = promotion.offer

  if (offer && offer.kind !== 'custom') {
    return formatPromotionOfferBadge(offer)
  }

  if (offer?.kind === 'custom') {
    if (offer.customLabel.trim()) {
      return offer.customLabel.trim()
    }
    if (promotion.type === 'reservation_ladder' && promotion.requiredReservations != null) {
      return formatReservationOrConsumptionCount(promotion.requiredReservations)
    }
  }

  if (promotion.type === 'reservation_ladder' && promotion.requiredReservations != null) {
    return formatReservationOrConsumptionCount(promotion.requiredReservations)
  }

  if (promotion.highlight?.trim()) {
    return promotion.highlight.trim()
  }

  if (promotion.maxRedemptions != null) {
    const spotsLeft = Math.max(
      0,
      promotion.maxRedemptions - (promotion.currentRedemptions ?? 0),
    )
    if (spotsLeft > 0 && spotsLeft <= 5) {
      return spotsLeft === 1 ? '¡Último cupo!' : `¡${spotsLeft} cupos!`
    }
  }

  return fallbackIndex % 2 === 0 ? '¡Nueva!' : 'Promo'
}

/** Chip inferior: condiciones (reserva o consumo, horario, etc.). */
export function resolvePromotionDetail(promotion: PromotionDisplayFields): string {
  if (promotion.type === 'reservation_ladder' && promotion.requiredReservations != null) {
    return formatReservationOrConsumptionCount(promotion.requiredReservations)
  }

  if (promotion.type === 'time_limited') {
    const from = promotion.activeFromTime?.trim() ?? ''
    const to = promotion.activeToTime?.trim() ?? ''
    if (from && to) {
      return `${from}-${to}`
    }
    return promotion.detail?.trim() || 'Tiempo limitado'
  }

  if (promotion.type === 'attendance') {
    const from = promotion.activeFromTime?.trim() ?? ''
    const to = promotion.activeToTime?.trim() ?? ''
    if (from && to) {
      return `${from}-${to}`
    }
    const minutes = promotion.arrivalWindowMinutes ?? 30
    return `${minutes} min`
  }

  return promotion.detail?.trim() ?? ''
}

export function formatMinimumSpendLabel(cents: number): string {
  const euros = cents / 100
  const formatted = Number.isInteger(euros)
    ? String(euros)
    : euros.toFixed(2).replace('.', ',')
  return `Gasto mínimo: ${formatted} €`
}

export function resolvePromotionMinimumSpend(promotion: PromotionDisplayFields): string | null {
  if (
    !promotion.minimumSpendEnabled
    || promotion.minimumSpendCents == null
    || promotion.minimumSpendCents <= 0
  ) {
    return null
  }

  return formatMinimumSpendLabel(promotion.minimumSpendCents)
}

export function formatPromotionMinimumSpendBookingNote(
  promotion: PromotionDisplayFields,
): string | null {
  const label = resolvePromotionMinimumSpend(promotion)
  if (!label) {
    return null
  }

  const amount = label.replace(/^Gasto mínimo:\s*/, '')
  return `Gasto mínimo de ${amount} si quieres la promoción`
}

export function formatPromotionOfferSummary(offer: PromotionOfferConfig): string {
  switch (offer.kind) {
    case 'bundle':
      return offer.bundleGet && offer.bundlePay
        ? `Lleva ${offer.bundleGet}, paga ${offer.bundlePay}`
        : 'X por X'
    case 'discount':
      return offer.discountPercent != null ? `Descuento ${offer.discountPercent}%` : 'Descuento'
    case 'fixed_price':
      return offer.fixedPriceCents != null
        ? `Precio fijo ${(offer.fixedPriceCents / 100).toFixed(2).replace('.', ',')} €`
        : 'Precio fijo'
    case 'second_unit':
      return offer.discountPercent != null
        ? `2ª unidad al ${offer.discountPercent}%`
        : '2ª unidad con descuento'
    case 'free_item':
      return 'Producto de regalo'
    case 'custom':
      return offer.customLabel.trim() || 'Personalizada'
    default:
      return 'Oferta'
  }
}

export function getPromotionProductPhotos(
  productRefs: PromotionProductRef[],
): PromotionProductRef[] {
  return productRefs.filter((ref) => ref.photoUrl.trim().length > 0)
}

export function getPromotionCollageCountLabel(totalProducts: number): string | null {
  if (totalProducts <= PROMOTION_COLLAGE_MAX_VISIBLE) {
    return null
  }

  return `${totalProducts} productos`
}

export function getMenuProductCategoryLabel(product: MenuNode, nodes: MenuNode[]): string {
  if (!product.parentId) {
    return 'Sin categoría'
  }

  const parent = nodes.find((node) => node.id === product.parentId)
  if (!parent) {
    return 'Sin categoría'
  }

  if (parent.parentId) {
    const grandParent = nodes.find((node) => node.id === parent.parentId)
    if (grandParent) {
      return `${grandParent.name} › ${parent.name}`
    }
  }

  return parent.name
}

export function suggestPromotionTitle(
  offer: PromotionOfferConfig,
  productRefs: PromotionProductRef[],
): string {
  const highlight = formatPromotionOfferHighlight(offer)
  const productNames = productRefs.slice(0, 2).map((ref) => ref.name).filter(Boolean)

  if (productNames.length === 0) {
    return highlight
  }

  if (productNames.length === 1) {
    return `${highlight} · ${productNames[0]}`
  }

  const extraCount = productRefs.length - 2
  const suffix = extraCount > 0 ? ` y ${extraCount} más` : ` y ${productNames[1]}`
  return `${highlight} · ${productNames[0]}${suffix}`
}
