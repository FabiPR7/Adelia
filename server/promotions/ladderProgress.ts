// Estado del mapa de premios (escalera de fidelidad) de un cliente en un local.
// Usa las MISMAS reglas que el canje (data/ladderRules.ts): el escalón que toca es el
// activo del ciclo (o el primero), y hacen falta `required` visitas nuevas desde el
// último canje (`baseline`). La web y la app lo reciben hecho y solo lo pintan.

export type LadderStepStatus = 'claimed' | 'claimable' | 'in_progress' | 'active' | 'locked'

export interface LadderStepState {
  promotionId: string
  index: number
  required: number
  current: number
  status: LadderStepStatus
  /** Hay alguna reserva tuya pendiente de que el local confirme que fuiste («A medias»). */
  awaiting: boolean
}

export interface LadderState {
  companyId: string
  /** Visitas que cuentan (reservas confirmadas que valen + cartas/llaves usadas). */
  confirmedCount: number
  /** Visitas ya gastadas en canjes anteriores de esta vuelta. */
  baseline: number
  /** Reservas hechas y aún sin confirmar en este local. */
  pendingCount: number
  /** Veces que has completado el mapa entero. */
  completions: number
  activePromotionId: string | null
  /** El escalón que conviene enseñar primero (listo para reclamar, o el que va en curso). */
  focusPromotionId: string | null
  steps: LadderStepState[]
}

export interface LadderStepInput {
  id: string
  requiredReservations: number | null | undefined
}

/** Orden del mapa: por visitas necesarias (y por id si empatan, para que sea estable). */
export function sortLadderSteps<T extends LadderStepInput>(steps: T[]): T[] {
  return [...steps].sort(
    (left, right) => (left.requiredReservations ?? 0) - (right.requiredReservations ?? 0)
      || left.id.localeCompare(right.id),
  )
}

export function buildLadderState(input: {
  companyId: string
  steps: LadderStepInput[]
  activePromotionId: string | null | undefined
  confirmedCount: number
  baseline: number
  pendingCount: number
  completions: number
}): LadderState {
  const ordered = sortLadderSteps(input.steps).filter((step) => (step.requiredReservations ?? 0) > 0)
  const ids = ordered.map((step) => step.id)
  const activeId = input.activePromotionId && ids.includes(input.activePromotionId)
    ? input.activePromotionId
    : ids[0] ?? null
  const activeIndex = activeId ? ids.indexOf(activeId) : -1
  const sinceBaseline = Math.max(0, input.confirmedCount - input.baseline)
  const awaiting = input.pendingCount > 0

  const steps: LadderStepState[] = ordered.map((step, index) => {
    const required = Math.max(0, Math.trunc(step.requiredReservations ?? 0))
    if (index < activeIndex) {
      return { promotionId: step.id, index, required, current: required, status: 'claimed', awaiting: false }
    }
    if (index > activeIndex) {
      return { promotionId: step.id, index, required, current: 0, status: 'locked', awaiting: false }
    }
    if (sinceBaseline >= required) {
      return { promotionId: step.id, index, required, current: required, status: 'claimable', awaiting: false }
    }
    return {
      promotionId: step.id,
      index,
      required,
      current: sinceBaseline,
      status: sinceBaseline > 0 ? 'in_progress' : 'active',
      awaiting,
    }
  })

  return {
    companyId: input.companyId,
    confirmedCount: input.confirmedCount,
    baseline: input.baseline,
    pendingCount: input.pendingCount,
    completions: input.completions,
    activePromotionId: activeId,
    focusPromotionId: activeId,
    steps,
  }
}

/** Una reserva cuenta para el mapa si está confirmada y, si pedía gasto mínimo, se validó. */
export function reservationCountsForLadder(reservation: FirebaseFirestore.DocumentData): boolean {
  if (reservation.status !== 'confirmed') return false
  const needsMinimum = typeof reservation.minimumSpendCents === 'number' && reservation.minimumSpendCents > 0
  return !needsMinimum || reservation.promotionVisitStatus === 'eligible'
}
