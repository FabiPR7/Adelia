// Las misiones y la XP las calcula el servidor (server/gamification/missions).
// Aquí solo quedan las piezas para pintar: niveles, clave de semana y visitas por local.
import { GAMIFICATION_LEVELS } from '../data/gamificationLevels'
import type { GamificationLevel } from '../types/gamification'
import type { Reservation } from '../types'
import { countsForPromotionProgress } from './reservationPromotionEligibility'

export function getWeekKey(date = new Date()): string {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + 4 - (start.getDay() || 7))
  const yearStart = new Date(start.getFullYear(), 0, 1)
  const week = Math.ceil((((start.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${start.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Visitas que cuentan por local (reservas confirmadas que valen para promos). */
export function buildVerifiedReservationCounts(
  reservations: Reservation[],
): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const reservation of reservations) {
    if (!countsForPromotionProgress(reservation)) {
      continue
    }

    counts[reservation.companyId] = (counts[reservation.companyId] ?? 0) + 1
  }

  return counts
}

export function getLevelForXp(xp: number): GamificationLevel {
  return [...GAMIFICATION_LEVELS].reverse().find((level) => xp >= level.minXp) ?? GAMIFICATION_LEVELS[0]
}

export function getLevelProgress(xp: number, level: GamificationLevel): number {
  if (level.maxXp === null) {
    return 1
  }

  const span = level.maxXp - level.minXp + 1
  return Math.min(1, Math.max(0, (xp - level.minXp) / span))
}

export function getXpToNextLevel(xp: number, level: GamificationLevel): number | null {
  if (level.maxXp === null) {
    return null
  }

  return Math.max(0, level.maxXp + 1 - xp)
}
