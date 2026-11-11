import { getRemoteCatalog } from '../data/remoteCatalog.ts'

const DEFAULT_PROMO_LOCK_STRIKES = 5

const DEFAULT_PENALTY_RATES = [
  { strike: 1, percent: 12, minXp: 40 },
  { strike: 2, percent: 30, minXp: 90 },
  { strike: 3, percent: 50, minXp: 160 },
  { strike: 4, percent: 70, minXp: 280 },
  { strike: 5, percent: 85, minXp: 420 },
]

/** Avisos de cancelación a partir de los cuales se bloquean las promos (`gameConfig/penalties`). */
export function promoLockStrikes(): number {
  return getRemoteCatalog().penalties.lockStrikes ?? DEFAULT_PROMO_LOCK_STRIKES
}

/** Escala de penalización por aviso (`gameConfig/penalties`); el código solo es el respaldo. */
export function cancellationPenaltyRates(): Array<{ strike: number; percent: number; minXp: number }> {
  return getRemoteCatalog().penalties.rates ?? DEFAULT_PENALTY_RATES
}
