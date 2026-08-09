export interface GamificationBadge {
  id: string
  name: string
  icon: string
  description: string
}

export const GAMIFICATION_BADGES: GamificationBadge[] = [
  { id: 'first_reservation', name: 'Primera mesa', icon: '🍽️', description: 'Primera reserva completada' },
  { id: 'explorer', name: 'Explorador', icon: '🧭', description: 'Visitó 3 locales distintos' },
  { id: 'week_streak', name: 'Racha semanal', icon: '🔥', description: 'Activo 3 semanas seguidas' },
  { id: 'mission_hunter', name: 'Cazador', icon: '🎯', description: '5 misiones completadas' },
  { id: 'social_diner', name: 'Cena social', icon: '👥', description: 'Reserva para 3+ personas' },
  { id: 'gourmet', name: 'Gourmet', icon: '⭐', description: '10 misiones completadas' },
  { id: 'level_5', name: 'Nivel 5', icon: '🥈', description: 'Alcanzó nivel 5' },
  { id: 'level_7', name: 'Nivel 7', icon: '🥇', description: 'Alcanzó nivel 7' },
  { id: 'level_10', name: 'Leyenda', icon: '👑', description: 'Alcanzó nivel 10' },
  { id: 'reviewer', name: 'Crítico', icon: '📝', description: 'Dejó reseñas útiles' },
  { id: 'offer_hunter', name: 'Cazador de ofertas', icon: '🏷️', description: 'Reservó con promoción' },
  { id: 'foodie', name: 'Foodie', icon: '🍷', description: '20 misiones completadas' },
]

export function getBadgesForProfile(level: number, missionsCompleted: number, streak: number): string[] {
  const earned: string[] = []

  if (missionsCompleted >= 1) earned.push('first_reservation')
  if (missionsCompleted >= 3) earned.push('explorer')
  if (streak >= 3) earned.push('week_streak')
  if (missionsCompleted >= 5) earned.push('mission_hunter')
  if (missionsCompleted >= 8) earned.push('social_diner')
  if (missionsCompleted >= 10) earned.push('gourmet')
  if (level >= 5) earned.push('level_5')
  if (level >= 7) earned.push('level_7')
  if (level >= 10) earned.push('level_10')
  if (missionsCompleted >= 15) earned.push('reviewer')
  if (missionsCompleted >= 12) earned.push('offer_hunter')
  if (missionsCompleted >= 20) earned.push('foodie')

  return earned
}

export function getBadgeById(id: string): GamificationBadge | undefined {
  return GAMIFICATION_BADGES.find((badge) => badge.id === id)
}
