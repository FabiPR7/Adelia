import type { MissionProgress } from '../types/gamification'
import { sortRestaurantsByReviewRating, type PublicDiscoveryRestaurant } from './publicDiscovery'
import { missionAction } from './missionNudges'

export type QuickFilterId = 'promo' | 'mission' | 'unvisited' | 'topRated' | 'reservable'

export interface QuickFilterContext {
  /** Promociones activas por restaurante. */
  promoCounts?: Record<string, number>
  /** Restaurantes donde el comensal ya estuvo. */
  visitedCompanyIds?: string[]
  /** La misión más cercana, para el filtro "Para tu misión". */
  mission?: MissionProgress | null
}

/** Qué tipo de restaurante ayuda a completar una misión. */
export type MissionFocus = 'promo' | 'visited' | 'reservable' | 'unvisited'

export function missionSearchFocus(mission: MissionProgress['mission']): MissionFocus {
  const action = missionAction(mission)
  if (action.to === '/app/promociones') return 'promo'
  if (action.to === '/app/reservas') return 'visited'
  if (action.label === 'Reservar mesa') return 'reservable'
  return 'unvisited'
}

const FOCUS_LABEL: Record<MissionFocus, string> = {
  promo: 'con promo',
  visited: 'donde ya fuiste',
  reservable: 'con reserva',
  unvisited: 'nuevos para ti',
}

export function missionFilterLabel(mission: MissionProgress['mission']): string {
  return `Para «${mission.name}» · ${FOCUS_LABEL[missionSearchFocus(mission)]}`
}

function matchesFocus(
  restaurant: PublicDiscoveryRestaurant,
  focus: MissionFocus,
  context: QuickFilterContext,
): boolean {
  const visited = new Set(context.visitedCompanyIds ?? [])
  switch (focus) {
    case 'promo':
      return (context.promoCounts?.[restaurant.id] ?? 0) > 0
    case 'visited':
      return visited.has(restaurant.id)
    case 'reservable':
      return restaurant.reservationMode !== 'none'
    case 'unvisited':
      return !visited.has(restaurant.id)
  }
}

/** Aplica los filtros rápidos activos. `topRated` ordena; los demás recortan. */
export function applyQuickFilters(
  restaurants: PublicDiscoveryRestaurant[],
  active: ReadonlySet<QuickFilterId>,
  context: QuickFilterContext,
  options: { keepOrder?: boolean } = {},
): PublicDiscoveryRestaurant[] {
  let results = restaurants

  if (active.has('promo')) {
    results = results.filter((restaurant) => (context.promoCounts?.[restaurant.id] ?? 0) > 0)
  }
  if (active.has('reservable')) {
    results = results.filter((restaurant) => restaurant.reservationMode !== 'none')
  }
  if (active.has('unvisited')) {
    results = results.filter((restaurant) => matchesFocus(restaurant, 'unvisited', context))
  }
  if (active.has('mission') && context.mission) {
    const focus = missionSearchFocus(context.mission.mission)
    results = results.filter((restaurant) => matchesFocus(restaurant, focus, context))
  }
  if (active.has('topRated') && !options.keepOrder) {
    results = sortRestaurantsByReviewRating(results)
  }

  return results
}
