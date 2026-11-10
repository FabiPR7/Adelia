/** Campos de una promo que fijan sus reglas (sirve para la promo guardada y para el formulario). */
export interface PromotionRuleFields {
  type: string
  requiredReservations?: number | null
  activeFromTime?: string
  activeToTime?: string
  arrivalWindowMinutes?: number | null
  maxRedemptions?: number | null
  currentRedemptions?: number
  maxClaimsPerCustomer?: number | null
  claimWindowEnabled?: boolean
  minimumSpendEnabled?: boolean
  minimumSpendCents?: number | null
}

function euros(cents: number): string {
  const value = cents / 100
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace('.', ',')} €`
}

/**
 * Reglas en frases cortas, en el orden en que le importan al cliente:
 * cuándo, cuántas visitas, cuántas plazas, cuántas veces y cuánto gastar.
 */
export function describePromotionRules(
  promotion: PromotionRuleFields,
  options: { showUsedSpots?: boolean } = {},
): string[] {
  const rules: string[] = []

  if ((promotion.type === 'time_limited' || promotion.type === 'attendance')
    && promotion.activeFromTime && promotion.activeToTime) {
    rules.push(`De ${promotion.activeFromTime} a ${promotion.activeToTime}`)
  }

  if (promotion.type === 'attendance' && promotion.arrivalWindowMinutes) {
    rules.push(`Llegar en ${promotion.arrivalWindowMinutes} min`)
  }

  if (promotion.type === 'reservation_ladder' && (promotion.requiredReservations ?? 0) > 0) {
    const count = promotion.requiredReservations ?? 0
    rules.push(count === 1 ? 'Tras 1 reserva o consumo' : `Tras ${count} reservas o consumos`)
  }

  if (promotion.type === 'reservation_ladder' && promotion.claimWindowEnabled
    && promotion.activeFromTime && promotion.activeToTime) {
    rules.push(`Se canjea de ${promotion.activeFromTime} a ${promotion.activeToTime}`)
  }

  if (promotion.maxRedemptions != null && promotion.maxRedemptions > 0) {
    const used = promotion.currentRedemptions ?? 0
    rules.push(
      options.showUsedSpots
        ? `${used} de ${promotion.maxRedemptions} plazas usadas`
        : `Solo ${promotion.maxRedemptions} ${promotion.maxRedemptions === 1 ? 'plaza' : 'plazas'}`,
    )
  }

  if (promotion.maxClaimsPerCustomer != null && promotion.maxClaimsPerCustomer > 0) {
    rules.push(
      promotion.maxClaimsPerCustomer === 1
        ? '1 vez por cliente'
        : `${promotion.maxClaimsPerCustomer} veces por cliente`,
    )
  } else {
    rules.push('Sin límite por cliente')
  }

  if (promotion.minimumSpendEnabled && promotion.minimumSpendCents != null && promotion.minimumSpendCents > 0) {
    rules.push(`Gasto mín. ${euros(promotion.minimumSpendCents)}`)
  }

  return rules
}
