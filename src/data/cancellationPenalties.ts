export const PROMO_LOCK_STRIKES = 5

export const CANCELLATION_PENALTY_RATES = [
  { strike: 1, percent: 12, minXp: 40 },
  { strike: 2, percent: 30, minXp: 90 },
  { strike: 3, percent: 50, minXp: 160 },
  { strike: 4, percent: 70, minXp: 280 },
  { strike: 5, percent: 85, minXp: 420 },
] as const

export interface CancellationPenaltyView {
  xpLost: number
  percent: number
  strikeCount: number
  nextPercent: number | null
  promoLocked: boolean
  justLocked: boolean
  warning: string
  xpAfter?: number
  xpBefore?: number
}

export function penaltyForStrike(strike: number): { strike: number; percent: number; minXp: number } {
  const last = CANCELLATION_PENALTY_RATES[CANCELLATION_PENALTY_RATES.length - 1]
  return CANCELLATION_PENALTY_RATES.find((entry) => entry.strike === strike) ?? last
}

export function computeCancellationXpLoss(currentXp: number, strike: number): number {
  const safeXp = Math.max(0, Math.floor(currentXp))
  if (safeXp <= 0) {
    return 0
  }

  const { percent, minXp } = penaltyForStrike(strike)
  const percentLoss = Math.ceil(safeXp * (percent / 100))
  return Math.min(safeXp, Math.max(minXp, percentLoss))
}

export function nextPenaltyPercent(strikeCount: number): number | null {
  if (strikeCount >= PROMO_LOCK_STRIKES) {
    return penaltyForStrike(strikeCount + 1).percent
  }

  return penaltyForStrike(strikeCount + 1).percent
}

export function isCustomerPromoLocked(
  profile: {
    gamification?: {
      promoLocked?: boolean
      cancellationStrikeCount?: number
    }
  } | null | undefined,
): boolean {
  const gamification = profile?.gamification
  if (!gamification) {
    return false
  }

  return gamification.promoLocked === true
    || (gamification.cancellationStrikeCount ?? 0) >= PROMO_LOCK_STRIKES
}

export function buildCancelPenaltyWarning(strikeCount: number, promoLocked: boolean): string {
  if (promoLocked && strikeCount >= PROMO_LOCK_STRIKES) {
    if (strikeCount === PROMO_LOCK_STRIKES) {
      return 'Has llegado al límite: ya no puedes reservar ni canjear promociones.'
    }

    return 'Sigues sin poder usar promociones. Cada cancelación te seguirá quitando puntos.'
  }

  const nextPercent = penaltyForStrike(strikeCount + 1).percent
  if (strikeCount + 1 >= PROMO_LOCK_STRIKES) {
    return `Cuidado: si cancelas otra reserva te quitaremos un ${nextPercent}% de tus puntos y se te bloquearán las promociones.`
  }

  return `Cuidado: si cancelas otra reserva te quitaremos un ${nextPercent}% de tus puntos.`
}

export function formatCancelPenaltyPreview(penalty: CancellationPenaltyView): string {
  const lossLine = penalty.xpLost > 0
    ? `Esta cancelación te quitará ${penalty.xpLost} XP (−${penalty.percent}%).`
    : 'Esta cancelación no te quita puntos ahora, pero cuenta como aviso.'

  return `${lossLine} ${penalty.warning}`.trim()
}

export function formatCancelPenaltyResult(penalty: CancellationPenaltyView): string {
  const lossLine = penalty.xpLost > 0
    ? `Se te han restado ${penalty.xpLost} XP (−${penalty.percent}%).`
    : 'Esta cancelación ha contado como aviso en tu historial.'

  return `${lossLine} ${penalty.warning}`.trim()
}

export const PROMO_LOCK_BOOKING_MESSAGE =
  'Tienes bloqueadas las reservas con promoción por cancelar demasiadas veces. Aún puedes reservar mesa sin promo.'

export const PROMO_LOCK_CLAIM_MESSAGE =
  'Tienes bloqueado el canje de promociones por cancelar demasiadas reservas.'
