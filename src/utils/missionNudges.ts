import type { MissionProgress } from '../types/gamification'

export interface MissionAction {
  label: string
  to: string
}

/**
 * Qué puede hacer el comensal para avanzar una misión. Las misiones de cada
 * semana se identifican por su id, así que se agrupan por palabras clave: una
 * misión nueva sin regla cae en "Ver misión" en vez de quedarse sin botón.
 */
export function missionAction(mission: { id: string; category?: string }): MissionAction {
  const id = mission.id

  if (/critico|resena|voz_|opinion/.test(id) || mission.category === 'reviews') {
    return { label: 'Dejar reseña', to: '/app/reservas' }
  }
  if (/consumo|ticket|gasto|promo|premio|botin|oferta/.test(id) || mission.category === 'rewards') {
    return { label: 'Ver promos', to: '/app/promociones' }
  }
  if (/reserva|mesa|club_|socio|maraton|leyenda|centurion|llama/.test(id)) {
    return { label: 'Reservar mesa', to: '/app/explorar' }
  }
  if (/visita|bar|restaurante|fiel_seguidor|ruta|explor|zona|nomada|embajador/.test(id) || mission.category === 'exploration') {
    return { label: 'Buscar restaurante', to: '/app/explorar' }
  }
  return { label: 'Ver misión', to: '/app/misiones' }
}

export function pendingMissions(...lists: MissionProgress[][]): MissionProgress[] {
  return lists.flat().filter((item) => !item.completed)
}

/** La más cercana a completarse; a igualdad de avance, la que más XP da. */
export function closestMission(pending: MissionProgress[]): MissionProgress | null {
  if (pending.length === 0) {
    return null
  }
  return [...pending].sort((left, right) => (
    right.progress - left.progress || right.mission.xp - left.mission.xp
  ))[0]
}

/** Casi hecha: ya va por la mitad o más. */
export function isAlmostDone(item: MissionProgress): boolean {
  return !item.completed && item.progress >= 0.5
}

export function remainingLabel(item: MissionProgress): string {
  const remaining = Math.max(1, item.mission.target - item.current)
  if (item.current <= 0) {
    return item.mission.target === 1 ? 'Solo una vez' : `${item.mission.target} para completarla`
  }
  return remaining === 1 ? 'Te falta 1' : `Te faltan ${remaining}`
}

/** Misiones que una reserva futura hará avanzar cuando el comensal asista. */
export function missionsFedByReservation(pending: MissionProgress[]): MissionProgress[] {
  return pending.filter((item) => /reserva|mesa_/.test(item.mission.id))
}

/** El lunes a las 00:00 (hora local) en que empieza la semana de misiones. */
export function nextWeekStart(now = new Date()): Date {
  const next = new Date(now)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + (8 - (next.getDay() || 7)))
  return next
}

export function weekTimeLeftLabel(now = new Date()): string {
  const ms = nextWeekStart(now).getTime() - now.getTime()
  const hours = Math.ceil(ms / 3_600_000)
  if (hours <= 24) {
    return hours <= 1 ? 'Termina en menos de 1 h' : `Termina en ${hours} h`
  }
  const days = Math.ceil(hours / 24)
  return `Quedan ${days} días`
}

export function formatPendingBadge(count: number): string {
  return count > 9 ? '9+' : String(count)
}
