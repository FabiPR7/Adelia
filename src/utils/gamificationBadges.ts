export interface GamificationBadge {
  id: string
  name: string
  icon: string
  description: string
}

export interface BadgeProgressInput {
  level: number
  missionsCompleted: number
  streak: number
  reservationsTotal?: number
}

export const GAMIFICATION_BADGES: GamificationBadge[] = [
  { id: 'first_reservation', name: 'Primera mesa', icon: '🍽️', description: 'Completa tu primera reserva confirmada' },
  { id: 'first_walk_in', name: 'Plan espontáneo', icon: '🧾', description: 'Registra 3 consumos sin reserva' },
  { id: 'min_spend', name: 'Ticket mínimo', icon: '💳', description: 'Supera 3 gastos mínimos' },
  { id: 'explorer', name: 'Explorador', icon: '🧭', description: 'Visita 5 locales distintos' },
  { id: 'social_diner', name: 'Mesa grande', icon: '👥', description: 'Completa 8 logros de visita o reserva' },
  { id: 'reviewer', name: 'Crítico', icon: '📝', description: 'Publica 10 reseñas o logros de crítica' },
  { id: 'offer_hunter', name: 'Cazador de ofertas', icon: '🏷️', description: 'Completa 12 logros, incluidos retos de promo' },
  { id: 'mission_hunter', name: 'Cazador', icon: '🎯', description: 'Completa 10 logros históricos' },
  { id: 'gourmet', name: 'Gourmet', icon: '⭐', description: 'Completa 20 logros históricos' },
  { id: 'foodie', name: 'Foodie', icon: '🍷', description: 'Completa 30 logros históricos' },
  { id: 'week_streak', name: 'Racha semanal', icon: '🔥', description: 'Mantén 5 semanas de ritmo en Compite' },
  { id: 'level_5', name: 'Nivel 5', icon: '🥈', description: 'Alcanza el nivel 5' },
  { id: 'level_7', name: 'Nivel 7', icon: '🥇', description: 'Alcanza el nivel 7' },
  { id: 'level_10', name: 'Leyenda', icon: '👑', description: 'Alcanza el nivel 10' },
]

export function getBadgesForProfile(
  level: number,
  missionsCompleted: number,
  streak: number,
  reservationsTotal?: number,
): string[] {
  const visits = reservationsTotal ?? 0
  const earned: string[] = []

  if (visits >= 1 || (visits === 0 && missionsCompleted >= 1 && level >= 2)) {
    earned.push('first_reservation')
  }
  if (missionsCompleted >= 6) earned.push('first_walk_in')
  if (missionsCompleted >= 8) earned.push('min_spend')
  if (visits >= 5 || missionsCompleted >= 12) earned.push('explorer')
  if (missionsCompleted >= 8 && visits >= 3) earned.push('social_diner')
  if (missionsCompleted >= 10) earned.push('reviewer')
  if (missionsCompleted >= 12) earned.push('offer_hunter')
  if (missionsCompleted >= 10) earned.push('mission_hunter')
  if (missionsCompleted >= 20) earned.push('gourmet')
  if (missionsCompleted >= 30) earned.push('foodie')
  if (streak >= 5) earned.push('week_streak')
  if (level >= 5) earned.push('level_5')
  if (level >= 7) earned.push('level_7')
  if (level >= 10) earned.push('level_10')

  return earned
}

export function getBadgeById(id: string): GamificationBadge | undefined {
  return GAMIFICATION_BADGES.find((badge) => badge.id === id)
}

const PHANTOM_BADGE_IDS = new Set(GAMIFICATION_BADGES.map((badge) => badge.id))

export function isPhantomBadgeNotification(notification: {
  type: string
  data?: { badgeId?: string }
}): boolean {
  if (notification.type !== 'badge_unlocked') {
    return false
  }

  const badgeId = notification.data?.badgeId
  return Boolean(badgeId && PHANTOM_BADGE_IDS.has(badgeId))
}
