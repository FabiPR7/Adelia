import { MONTHLY_MISSION_POOL, WEEKLY_MISSIONS } from '../data/gamificationMissions'
import { GAMIFICATION_LEVELS } from '../data/gamificationLevels'
import type {
  CustomerGamificationState,
  GamificationLevel,
  MissionDefinition,
  MissionProgress,
} from '../types/gamification'
import type { Reservation } from '../types'
import type { CustomerVerifiedConsumption } from '../types/verifiedConsumption'
import { WEEKLY_BONUS_TARGET, WEEKLY_MISSION_BONUS_XP, CONFIRMED_RESERVATION_XP } from '../types/gamification'
import { countsForPromotionProgress } from './reservationPromotionEligibility'
import { venueTypesIncludeKind } from '../data/companyProfileFacilities'

export interface GamificationContext {
  reservations: Reservation[]
  consumptions: CustomerVerifiedConsumption[]
  favoriteSlugs: string[]
  promotionCompanyIds: Set<string>
  restaurantZones: Map<string, string>
  restaurantCategories: Map<string, string[]>
  restaurantVenueTypes: Map<string, string[]>
  restaurantReservationModes: Map<string, 'required' | 'optional' | 'none'>
  weeklyFeaturedCategory: string
}

interface MissionVisit {
  id: string
  companyId: string
  visitedAt: Date
  promotionId: string | null
}

const WEEKLY_FEATURED_CATEGORIES = [
  'Italiana',
  'Tapas',
  'Sushi',
  'Mexicana',
  'Brunch',
  'Mariscos',
  'Pizza',
  'Vegano',
  'Brasas',
  'Mediterránea',
  'Gastronómico',
  'Cocina de mercado',
] as const

const INTERNATIONAL_CUISINE_TAGS = new Set([
  'Comida asiática',
  'Sushi',
  'Ramen',
  'Wok',
  'Comida china',
  'Comida japonesa',
  'Comida coreana',
  'Comida tailandesa',
  'Comida vietnamita',
  'Comida india',
  'Italiana',
  'Pizza',
  'Pasta',
  'Mexicana',
  'Tex-Mex',
  'Argentino',
  'Peruano',
  'Mediterránea',
  'Japonesa',
  'Fusión',
  'Fine dining',
  'Steakhouse',
])

export function getWeekKey(date = new Date()): string {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() + 4 - (start.getDay() || 7))
  const yearStart = new Date(start.getFullYear(), 0, 1)
  const week = Math.ceil((((start.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${start.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function hashKey(key: string): number {
  return key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

export function getWeeklyFeaturedCategory(date = new Date()): string {
  const weekKey = getWeekKey(date)
  const index = hashKey(weekKey) % WEEKLY_FEATURED_CATEGORIES.length
  return WEEKLY_FEATURED_CATEGORIES[index] ?? WEEKLY_FEATURED_CATEGORIES[0]
}

function getWeekStart(date = new Date()): Date {
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

function reservationsCreatedThisWeek(reservations: Reservation[]): Reservation[] {
  const weekStart = getWeekStart()

  return reservations.filter(
    (reservation) => reservation.createdAt >= weekStart,
  )
}

function computeFavoritesAddedThisWeek(
  favoriteSlugs: string[],
  favoriteSlugsAtWeekStart: string[],
): number {
  const baseline = new Set(favoriteSlugsAtWeekStart)
  return favoriteSlugs.filter((slug) => !baseline.has(slug)).length
}

function firstVisitsThisWeek(visits: MissionVisit[]): MissionVisit[] {
  const weekStart = getWeekStart()
  const weekVisits = visits.filter((visit) => visit.visitedAt >= weekStart)

  return weekVisits.filter((visit) => {
    const hadPriorVisit = visits.some(
      (entry) =>
        entry.companyId === visit.companyId
        && entry.visitedAt < weekStart,
    )
    return !hadPriorVisit
  })
}

function firstVisitsThisMonth(visits: MissionVisit[]): MissionVisit[] {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthVisits = visits.filter((visit) => (
    visit.visitedAt.getMonth() === now.getMonth()
    && visit.visitedAt.getFullYear() === now.getFullYear()
  ))

  return monthVisits.filter((visit) => {
    const hadPriorVisit = visits.some(
      (entry) =>
        entry.companyId === visit.companyId
        && entry.visitedAt < monthStart,
    )
    return !hadPriorVisit
  })
}

function restaurantHasCharacteristic(
  companyId: string,
  characteristic: string,
  categories: Map<string, string[]>,
): boolean {
  const normalizedTarget = characteristic.trim().toLowerCase()
  const characteristics = categories.get(companyId) ?? []

  return characteristics.some(
    (entry) => entry.trim().toLowerCase() === normalizedTarget,
  )
}

function uniqueInternationalCuisines(
  visits: Array<{ companyId: string }>,
  categories: Map<string, string[]>,
): number {
  const seen = new Set<string>()

  for (const visit of visits) {
    for (const characteristic of categories.get(visit.companyId) ?? []) {
      if (INTERNATIONAL_CUISINE_TAGS.has(characteristic)) {
        seen.add(characteristic)
      }
    }
  }

  return seen.size
}

function totalLadderCompletions(
  ladderCompletionsByCompany: Record<string, number>,
): number {
  return Object.values(ladderCompletionsByCompany).reduce(
    (sum, count) => sum + (count > 0 ? count : 0),
    0,
  )
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 5 || day === 6 || day === 0
}

function isWeekdaySlow(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 4
}

function isSameDay(left: Date, right: Date): boolean {
  return left.toDateString() === right.toDateString()
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / 86400000)
}

function isLunchHour(date: Date): boolean {
  const hour = date.getHours()
  return hour >= 12 && hour < 17
}

function isDinnerHour(date: Date): boolean {
  const hour = date.getHours()
  return hour >= 19 && hour <= 23
}

function attendedReservations(reservations: Reservation[]): Reservation[] {
  return reservations.filter((reservation) => reservation.status === 'confirmed')
}

function verifiedWalkInConsumptions(
  consumptions: CustomerVerifiedConsumption[],
): CustomerVerifiedConsumption[] {
  return verifiedConsumptions(consumptions).filter((consumption) => (
    consumption.source === 'walk_in'
  ))
}

function verifiedConsumptions(
  consumptions: CustomerVerifiedConsumption[],
): CustomerVerifiedConsumption[] {
  return consumptions.filter((consumption) => (
    consumption.meetsMinimumSpend
    && Number.isFinite(Date.parse(consumption.visitAt))
  ))
}

function attendedVisits(context: GamificationContext): MissionVisit[] {
  const reservationVisits = attendedReservations(context.reservations).map((reservation) => ({
    id: reservation.id,
    companyId: reservation.companyId,
    visitedAt: reservation.startTime,
    promotionId: null,
  }))
  const consumptionVisits = verifiedWalkInConsumptions(context.consumptions).map((consumption) => ({
    id: `consumption:${consumption.id}`,
    companyId: consumption.companyId,
    visitedAt: new Date(consumption.visitAt),
    promotionId: consumption.promotionId,
  }))

  return [...reservationVisits, ...consumptionVisits]
}

function activeReservations(reservations: Reservation[]): Reservation[] {
  return reservations.filter((reservation) => reservation.status !== 'cancelled')
}

function countSinceBaseline(current: number, baseline: number | undefined): number {
  if (typeof baseline !== 'number' || !Number.isFinite(baseline)) {
    return 0
  }
  return Math.max(0, current - baseline)
}

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

function processVisitXp(
  state: CustomerGamificationState,
  reservations: Reservation[],
  consumptions: CustomerVerifiedConsumption[],
): CustomerGamificationState {
  const awarded = new Set(state.awardedReservationXpIds)
  let xpGain = 0
  const nextAwarded = [...state.awardedReservationXpIds]

  for (const visit of attendedVisits({
    reservations,
    consumptions,
    favoriteSlugs: [],
    promotionCompanyIds: new Set(),
    restaurantZones: new Map(),
    restaurantCategories: new Map(),
    restaurantVenueTypes: new Map(),
    restaurantReservationModes: new Map(),
    weeklyFeaturedCategory: '',
  })) {
    if (awarded.has(visit.id)) {
      continue
    }

    xpGain += CONFIRMED_RESERVATION_XP
    nextAwarded.push(visit.id)
  }

  if (xpGain === 0) {
    return state
  }

  return {
    ...state,
    xp: state.xp + xpGain,
    awardedReservationXpIds: nextAwarded,
  }
}

function reservationsThisWeek(reservations: Reservation[]): Reservation[] {
  const weekStart = getWeekStart()

  return reservations.filter((reservation) => reservation.startTime >= weekStart)
}

function reservationsThisMonth(reservations: Reservation[]): Reservation[] {
  const now = new Date()
  return reservations.filter(
    (reservation) =>
      reservation.startTime.getMonth() === now.getMonth()
      && reservation.startTime.getFullYear() === now.getFullYear(),
  )
}

function totalPax(reservations: Reservation[]): number {
  return reservations.reduce((sum, reservation) => sum + reservation.pax, 0)
}

function uniqueZones(visits: Array<{ companyId: string }>, zones: Map<string, string>): number {
  const seen = new Set<string>()

  for (const visit of visits) {
    const zone = zones.get(visit.companyId)
    if (zone) {
      seen.add(zone.toLowerCase())
    }
  }

  return seen.size
}

function evaluateMission(
  mission: MissionDefinition,
  context: GamificationContext,
  state: CustomerGamificationState,
): { current: number; completed: boolean } {
  const attended = attendedReservations(context.reservations)
  const visits = attendedVisits(context)
  const booked = activeReservations(context.reservations)
  const weekReservations = reservationsThisWeek(attended)
  const weekBooked = reservationsThisWeek(booked)
  const monthReservations = reservationsThisMonth(attended)
  const monthBooked = reservationsThisMonth(booked)
  const weekStart = getWeekStart()
  const now = new Date()
  const weekVisits = visits.filter((visit) => visit.visitedAt >= weekStart)
  const monthVisits = visits.filter((visit) => (
    visit.visitedAt.getMonth() === now.getMonth()
    && visit.visitedAt.getFullYear() === now.getFullYear()
  ))
  const consumptions = verifiedConsumptions(context.consumptions)
  const weekConsumptions = consumptions.filter(
    (consumption) => new Date(consumption.visitAt) >= weekStart,
  )
  const monthConsumptions = consumptions.filter((consumption) => {
    const visitAt = new Date(consumption.visitAt)
    return visitAt.getMonth() === now.getMonth() && visitAt.getFullYear() === now.getFullYear()
  })
  const weekWalkIns = weekConsumptions.filter((consumption) => consumption.source === 'walk_in')
  const monthWalkIns = monthConsumptions.filter((consumption) => consumption.source === 'walk_in')
  const weekBookings = reservationsCreatedThisWeek(context.reservations)
  const favoritesAddedThisWeek = computeFavoritesAddedThisWeek(
    context.favoriteSlugs,
    state.favoriteSlugsAtWeekStart,
  )
  const firstVisits = firstVisitsThisWeek(visits)

  switch (mission.id) {
    case 'reserva_confirmada_semana':
      return { current: weekReservations.length, completed: weekReservations.length >= 1 }
    case 'reserva_obligatoria_semana': {
      const matches = weekReservations.filter(
        (reservation) => context.restaurantReservationModes.get(reservation.companyId) === 'required',
      )
      return { current: matches.length, completed: matches.length >= 1 }
    }
    case 'consumo_sin_reserva_semana':
      return { current: weekWalkIns.length, completed: weekWalkIns.length >= 1 }
    case 'consumo_productos_semana': {
      const matches = weekConsumptions.filter(
        (consumption) => consumption.mode === 'products' && consumption.lineItems.length > 0,
      )
      return { current: matches.length, completed: matches.length >= 1 }
    }
    case 'gasto_minimo_semana': {
      const matches = weekConsumptions.filter((consumption) => consumption.minimumSpendCents > 0)
      return { current: matches.length, completed: matches.length >= 1 }
    }
    case 'ticket_30_semana': {
      const matches = weekConsumptions.filter((consumption) => consumption.totalCents >= 3000)
      return { current: matches.length, completed: matches.length >= 1 }
    }
    case 'visita_bar_semana': {
      const matches = weekVisits.filter((visit) => venueTypesIncludeKind(
        context.restaurantVenueTypes.get(visit.companyId) ?? [],
        'bar',
      ))
      return { current: matches.length, completed: matches.length >= 1 }
    }
    case 'visita_restaurante_semana': {
      const matches = weekVisits.filter((visit) => venueTypesIncludeKind(
        context.restaurantVenueTypes.get(visit.companyId) ?? [],
        'restaurant',
      ))
      return { current: matches.length, completed: matches.length >= 1 }
    }
    case 'promo_consumo_semana': {
      const matches = weekWalkIns.filter((consumption) => Boolean(consumption.promotionId))
      return { current: matches.length, completed: matches.length >= 1 }
    }
    case 'mesa_compartida_semana': {
      const matches = weekReservations.filter((reservation) => reservation.pax >= 3)
      return { current: matches.length, completed: matches.length >= mission.target }
    }
    case 'plan_fin_semana':
      return {
        current: weekBooked.filter((reservation) => isWeekend(reservation.startTime)).length,
        completed: weekBooked.some((reservation) => isWeekend(reservation.startTime)),
      }
    case 'cena_amigos':
      return {
        current: weekReservations.filter((reservation) => reservation.pax >= 3).length,
        completed: weekReservations.some((reservation) => reservation.pax >= 3),
      }
    case 'reserva_relampago': {
      const matches = weekBookings.filter(
        (reservation) =>
          reservation.status !== 'cancelled'
          && isSameDay(reservation.createdAt, reservation.startTime),
      )
      return {
        current: matches.length,
        completed: matches.length >= 1,
      }
    }
    case 'reserva_anticipada': {
      const matches = weekBookings.filter(
        (reservation) =>
          reservation.status !== 'cancelled'
          && daysBetween(reservation.createdAt, reservation.startTime) >= 3,
      )
      return {
        current: matches.length,
        completed: matches.length >= 1,
      }
    }
    case 'gourmet_reincidente': {
      return { current: weekVisits.length, completed: weekVisits.length >= 2 }
    }
    case 'descubrimiento_semanal':
      return {
        current: firstVisits.length,
        completed: firstVisits.length >= 1,
      }
    case 'en_busca_ofertas': {
      const promoVisits = weekVisits.filter(
        (visit) => Boolean(visit.promotionId) || context.promotionCompanyIds.has(visit.companyId),
      )
      return {
        current: promoVisits.length,
        completed: promoVisits.length >= 1,
      }
    }
    case 'fiel_seguidor':
      return {
        current: favoritesAddedThisWeek,
        completed: favoritesAddedThisWeek >= 3,
      }
    case 'critico_foto': {
      const current = countSinceBaseline(
        state.reviewsWithPhotoCount,
        state.reviewsWithPhotoCountAtWeekStart,
      )
      return { current, completed: current >= mission.target }
    }
    case 'voz_experiencia': {
      const current = countSinceBaseline(
        state.textReviewsCount,
        state.textReviewsCountAtWeekStart,
      )
      return { current, completed: current >= mission.target }
    }
    case 'critico_consistente': {
      const current = countSinceBaseline(
        state.reviewsWithPhotoCount,
        state.reviewsWithPhotoCountAtMonthStart,
      )
      return { current, completed: current >= mission.target }
    }
    case 'ruta_especialidades': {
      const matches = weekVisits.filter((visit) =>
        restaurantHasCharacteristic(
          visit.companyId,
          context.weeklyFeaturedCategory,
          context.restaurantCategories,
        ),
      )
      return {
        current: matches.length > 0 ? 1 : 0,
        completed: matches.length > 0,
      }
    }
    case 'apoyo_hosteleria':
      return {
        current: weekBooked.filter((reservation) => isWeekdaySlow(reservation.startTime)).length,
        completed: weekBooked.some((reservation) => isWeekdaySlow(reservation.startTime)),
      }
    case 'ruta_gastronomica':
      return {
        current: monthVisits.length,
        completed: monthVisits.length >= 4,
      }
    case 'reservas_mes':
      return { current: monthReservations.length, completed: monthReservations.length >= 3 }
    case 'consumos_mes':
      return { current: monthWalkIns.length, completed: monthWalkIns.length >= 3 }
    case 'gastos_minimos_mes': {
      const current = monthConsumptions.filter(
        (consumption) => consumption.minimumSpendCents > 0,
      ).length
      return { current, completed: current >= 2 }
    }
    case 'gasto_acumulado_mes': {
      const current = Math.floor(
        monthConsumptions.reduce((sum, consumption) => sum + consumption.totalCents, 0) / 100,
      )
      return { current, completed: current >= mission.target }
    }
    case 'bar_y_restaurante_mes': {
      const bar = monthVisits.some((visit) => venueTypesIncludeKind(
        context.restaurantVenueTypes.get(visit.companyId) ?? [],
        'bar',
      ))
      const restaurant = monthVisits.some((visit) => venueTypesIncludeKind(
        context.restaurantVenueTypes.get(visit.companyId) ?? [],
        'restaurant',
      ))
      const current = Number(bar) + Number(restaurant)
      return { current, completed: bar && restaurant }
    }
    case 'productos_mes': {
      const current = monthConsumptions.filter(
        (consumption) => consumption.mode === 'products' && consumption.lineItems.length > 0,
      ).length
      return { current, completed: current >= 3 }
    }
    case 'dos_modalidades_mes': {
      const withReservation = monthReservations.length > 0
      const walkIn = monthWalkIns.length > 0
      const current = Number(withReservation) + Number(walkIn)
      return { current, completed: withReservation && walkIn }
    }
    case 'cazador_adelinas': {
      const current = countSinceBaseline(
        state.redemptionsCount,
        state.redemptionsCountAtMonthStart,
      )
      return { current, completed: current >= 1 }
    }
    case 'explorador_ciudad':
      return {
        current: uniqueZones(monthVisits, context.restaurantZones),
        completed: uniqueZones(monthVisits, context.restaurantZones) >= 3,
      }
    case 'menu_completo': {
      const lunch = monthVisits.some((visit) => isLunchHour(visit.visitedAt))
      const dinner = monthVisits.some((visit) => isDinnerHour(visit.visitedAt))
      const current = Number(lunch) + Number(dinner)
      return { current, completed: lunch && dinner }
    }
    case 'maraton_mensual':
      return {
        current: monthVisits.length,
        completed: monthVisits.length >= 6,
      }
    case 'grupo_grande_mes':
      return {
        current: monthBooked.filter((reservation) => reservation.pax >= 4).length,
        completed: monthBooked.some((reservation) => reservation.pax >= 4),
      }
    case 'promo_doble_mes': {
      const promoCount = monthBooked.filter(
        (reservation) => context.promotionCompanyIds.has(reservation.companyId),
      ).length
      return { current: promoCount, completed: promoCount >= 2 }
    }
    case 'finde_gourmet_mes':
      return {
        current: monthVisits.filter((visit) => isWeekend(visit.visitedAt)).length,
        completed: monthVisits.filter((visit) => isWeekend(visit.visitedAt)).length >= 2,
      }
    case 'valle_laboral_mes':
      return {
        current: monthBooked.filter((reservation) => isWeekdaySlow(reservation.startTime)).length,
        completed: monthBooked.filter((reservation) => isWeekdaySlow(reservation.startTime)).length >= 2,
      }
    case 'descubridor_mes':
      return {
        current: firstVisitsThisMonth(visits).length,
        completed: firstVisitsThisMonth(visits).length >= 2,
      }
    case 'debut_gastronomico':
      return { current: attended.length, completed: attended.length >= 1 }
    case 'primer_consumo_libre': {
      const walkIns = verifiedWalkInConsumptions(context.consumptions)
      return { current: walkIns.length, completed: walkIns.length >= 1 }
    }
    case 'primer_gasto_minimo': {
      const current = consumptions.filter((consumption) => consumption.minimumSpendCents > 0).length
      return { current, completed: current >= mission.target }
    }
    case 'primera_carta_productos': {
      const current = consumptions.filter(
        (consumption) => consumption.mode === 'products' && consumption.lineItems.length > 0,
      ).length
      return { current, completed: current >= mission.target }
    }
    case 'ruta_de_bar': {
      const current = visits.filter((visit) => venueTypesIncludeKind(
        context.restaurantVenueTypes.get(visit.companyId) ?? [],
        'bar',
      )).length
      return { current, completed: current >= mission.target }
    }
    case 'ruta_de_restaurante': {
      const current = visits.filter((visit) => venueTypesIncludeKind(
        context.restaurantVenueTypes.get(visit.companyId) ?? [],
        'restaurant',
      )).length
      return { current, completed: current >= mission.target }
    }
    case 'consumidor_habitual': {
      const walkIns = verifiedWalkInConsumptions(context.consumptions)
      return { current: walkIns.length, completed: walkIns.length >= mission.target }
    }
    case 'cazador_minimos': {
      const current = consumptions.filter((consumption) => consumption.minimumSpendCents > 0).length
      return { current, completed: current >= mission.target }
    }
    case 'corazon_favorito':
      return {
        current: context.favoriteSlugs.length,
        completed: context.favoriteSlugs.length >= 1,
      }
    case 'almuerzo_sol':
      return {
        current: visits.filter((visit) => isLunchHour(visit.visitedAt)).length,
        completed: visits.some((visit) => isLunchHour(visit.visitedAt)),
      }
    case 'cena_especial':
      return {
        current: visits.filter((visit) => isDinnerHour(visit.visitedAt)).length,
        completed: visits.some((visit) => isDinnerHour(visit.visitedAt)),
      }
    case 'martes_valiente':
      return {
        current: booked.filter((reservation) => isWeekdaySlow(reservation.startTime)).length,
        completed: booked.some((reservation) => isWeekdaySlow(reservation.startTime)),
      }
    case 'mesa_para_dos':
      return {
        current: booked.filter((reservation) => reservation.pax >= 2).length,
        completed: booked.some((reservation) => reservation.pax >= 2),
      }
    case 'reserva_relampago_logro':
      return {
        current: context.reservations.filter(
          (reservation) =>
            reservation.status !== 'cancelled'
            && isSameDay(reservation.createdAt, reservation.startTime),
        ).length,
        completed: context.reservations.some(
          (reservation) =>
            reservation.status !== 'cancelled'
            && isSameDay(reservation.createdAt, reservation.startTime),
        ),
      }
    case 'club_10_mesas':
      return { current: attended.length, completed: attended.length >= 10 }
    case 'racha_mensual':
      return {
        current: monthReservations.length,
        completed: monthReservations.length >= 3,
      }
    case 'cazador_ofertas': {
      const promoCount = visits.filter(
        (visit) => Boolean(visit.promotionId) || context.promotionCompanyIds.has(visit.companyId),
      ).length
      return { current: promoCount, completed: promoCount >= 3 }
    }
    case 'voz_barrio':
      return { current: state.reviewsCount, completed: state.reviewsCount >= 5 }
    case 'mesa_grande':
      return {
        current: attended.filter((reservation) => reservation.pax >= 5).length,
        completed: attended.some((reservation) => reservation.pax >= 5),
      }
    case 'explorador_zona': {
      const zones = uniqueZones(visits, context.restaurantZones)
      return { current: zones, completed: zones >= 5 }
    }
    case 'reserva_planificada':
      return {
        current: context.reservations.filter(
          (reservation) =>
            reservation.status !== 'cancelled'
            && daysBetween(reservation.createdAt, reservation.startTime) >= 7,
        ).length,
        completed: context.reservations.some(
          (reservation) =>
            reservation.status !== 'cancelled'
            && daysBetween(reservation.createdAt, reservation.startTime) >= 7,
        ),
      }
    case 'socio_veterano':
      return { current: attended.length, completed: attended.length >= 25 }
    case 'embajador_local': {
      const uniqueVenues = new Set(visits.map((visit) => visit.companyId)).size
      return { current: uniqueVenues, completed: uniqueVenues >= 20 }
    }
    case 'maestro_resenas':
      return { current: state.reviewsCount, completed: state.reviewsCount >= 20 }
    case 'coleccionista_premios':
      return { current: state.redemptionsCount, completed: state.redemptionsCount >= 8 }
    case 'maraton_gastro':
      return { current: attended.length, completed: attended.length >= 30 }
    case 'leyenda_restaurante':
      return { current: attended.length, completed: attended.length >= 50 }
    case 'centurion_mesas':
      return { current: attended.length, completed: attended.length >= 100 }
    case 'llama_eterna':
      return { current: attended.length, completed: attended.length >= 75 }
    case 'oraculo_sabores':
      return { current: state.reviewsCount, completed: state.reviewsCount >= 50 }
    case 'corona_gastro': {
      const venues = new Set(visits.map((visit) => visit.companyId)).size
      return { current: venues, completed: venues >= 40 }
    }
    case 'emperador_adelia': {
      const level = getLevelForXp(state.xp).level
      return { current: level, completed: level >= 7 }
    }
    case 'cliente_fiel_meson': {
      const completions = totalLadderCompletions(state.ladderCompletionsByCompany)
      return { current: completions, completed: completions >= 1 }
    }
    case 'primera_opinion':
      return { current: state.reviewsCount, completed: state.reviewsCount >= 1 }
    case 'fotografo_gourmet':
      return {
        current: state.reviewsWithPhotoCount,
        completed: state.reviewsWithPhotoCount >= mission.target,
      }
    case 'critico_destacado':
      return {
        current: state.reviewsWithPhotoCount,
        completed: state.reviewsWithPhotoCount >= mission.target,
      }
    case 'guia_michelin':
      return {
        current: state.helpfulReviewVotes,
        completed: state.helpfulReviewVotes >= 50,
      }
    case 'primer_botin':
      return { current: state.redemptionsCount, completed: state.redemptionsCount >= 1 }
    case 'cazador_tesoros':
      return { current: state.redemptionsCount, completed: state.redemptionsCount >= 5 }
    case 'nomada_digital': {
      const unique = new Set(visits.map((visit) => visit.companyId)).size
      return { current: unique, completed: unique >= 10 }
    }
    case 'ruta_internacional': {
      const cuisines = uniqueInternationalCuisines(visits, context.restaurantCategories)
      return { current: cuisines, completed: cuisines >= mission.target }
    }
    case 'infiltrado_hosteleria':
    case 'titan_hosteleria': {
      const pax = totalPax(attended)
      return {
        current: pax,
        completed: pax >= mission.target,
      }
    }
    default:
      return { current: 0, completed: false }
  }
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

export function rotateWeeklyMissions(date = new Date(), count = 6): MissionDefinition[] {
  const weekKey = getWeekKey(date)
  const seed = hashKey(weekKey)
  const sorted = [...WEEKLY_MISSIONS].sort((left, right) => {
    const leftScore = hashKey(`${seed}-${left.id}`) % 997
    const rightScore = hashKey(`${seed}-${right.id}`) % 997
    return leftScore - rightScore
  })

  const groups = new Set<string>()
  return sorted.filter((mission) => {
    const group = mission.rotationGroup ?? mission.id
    if (groups.has(group)) {
      return false
    }
    groups.add(group)
    return true
  }).slice(0, count)
}

export function rotateMonthlyMissions(date = new Date(), count = 5): MissionDefinition[] {
  const monthKey = getMonthKey(date)
  const seed = hashKey(monthKey)
  const sorted = [...MONTHLY_MISSION_POOL].sort((left, right) => {
    const leftScore = hashKey(`${seed}-${left.id}`) % 997
    const rightScore = hashKey(`${seed}-${right.id}`) % 997
    return leftScore - rightScore
  })

  const groups = new Set<string>()
  return sorted.filter((mission) => {
    const group = mission.rotationGroup ?? mission.id
    if (groups.has(group)) {
      return false
    }
    groups.add(group)
    return true
  }).slice(0, count)
}

export function buildMissionProgressList(
  missions: MissionDefinition[],
  context: GamificationContext,
  state: CustomerGamificationState,
  completedIds: Set<string>,
): MissionProgress[] {
  return missions.map((mission) => {
    const evaluation = evaluateMission(mission, context, state)
    const completed = evaluation.completed || completedIds.has(mission.id)

    return {
      mission,
      current: Math.min(evaluation.current, mission.target),
      completed,
      progress: completed ? 1 : Math.min(1, evaluation.current / mission.target),
    }
  })
}

export function syncGamificationPeriods(
  state: CustomerGamificationState,
  favoriteSlugs: string[] = [],
): CustomerGamificationState {
  const weekKey = getWeekKey()
  const monthKey = getMonthKey()
  const sameWeek = state.weekKey === weekKey
  const sameMonth = state.monthKey === monthKey

  return {
    ...state,
    weekKey,
    monthKey,
    weeklyCompleted: sameWeek ? state.weeklyCompleted : [],
    monthlyCompleted: sameMonth ? state.monthlyCompleted : [],
    favoriteSlugsAtWeekStart: sameWeek ? state.favoriteSlugsAtWeekStart : favoriteSlugs,
    favoritesAddedThisWeek: sameWeek
      ? computeFavoritesAddedThisWeek(favoriteSlugs, state.favoriteSlugsAtWeekStart)
      : 0,
    reviewsWithPhotoCountAtWeekStart: sameWeek
      ? (state.reviewsWithPhotoCountAtWeekStart ?? state.reviewsWithPhotoCount)
      : state.reviewsWithPhotoCount,
    textReviewsCountAtWeekStart: sameWeek
      ? (state.textReviewsCountAtWeekStart ?? state.textReviewsCount)
      : state.textReviewsCount,
    reviewsWithPhotoCountAtMonthStart: sameMonth
      ? (state.reviewsWithPhotoCountAtMonthStart ?? state.reviewsWithPhotoCount)
      : state.reviewsWithPhotoCount,
    redemptionsCountAtMonthStart: sameMonth
      ? (state.redemptionsCountAtMonthStart ?? state.redemptionsCount)
      : state.redemptionsCount,
  }
}

export function deriveVisitedCompanyIds(
  reservations: Reservation[],
  consumptions: CustomerVerifiedConsumption[] = [],
): string[] {
  return [...new Set(
    [
      ...attendedReservations(reservations).map((reservation) => reservation.companyId),
      ...verifiedWalkInConsumptions(consumptions).map((consumption) => consumption.companyId),
    ],
  )]
}

export { buildPendingReservationCounts } from './promotionReservationProgress'

export function computeWeeklyBonusProgress(weeklyProgress: MissionProgress[]): {
  completedCount: number
  bonusEarned: boolean
  bonusXp: number
} {
  const completedCount = weeklyProgress.filter((item) => item.completed).length
  const bonusEarned = completedCount >= WEEKLY_BONUS_TARGET

  return {
    completedCount,
    bonusEarned,
    bonusXp: bonusEarned ? WEEKLY_MISSION_BONUS_XP : 0,
  }
}

const WEEKLY_BONUS_ID = 'weekly_bonus'

export function processGamificationRewards(
  state: CustomerGamificationState,
  weeklyProgress: MissionProgress[],
  monthlyProgress: MissionProgress[],
  historicalProgress: MissionProgress[],
  reservations: Reservation[] = [],
  favoriteSlugs: string[] = [],
  consumptions: CustomerVerifiedConsumption[] = [],
): CustomerGamificationState {
  let next = syncGamificationPeriods(state, favoriteSlugs)
  next = processVisitXp(next, reservations, consumptions)
  next = {
    ...next,
    redemptionsCount: Math.max(next.redemptionsCount, next.claimedPromotions.length),
    visitedCompanyIds: deriveVisitedCompanyIds(reservations, consumptions),
    favoritesAddedThisWeek: computeFavoritesAddedThisWeek(
      favoriteSlugs,
      next.favoriteSlugsAtWeekStart,
    ),
  }
  let xpGain = 0
  const completedHistorical = new Set(next.completedMissions)
  const weeklyDone = new Set(next.weeklyCompleted)
  const monthlyDone = new Set(next.monthlyCompleted)

  for (const item of weeklyProgress) {
    if (item.completed && !weeklyDone.has(item.mission.id)) {
      weeklyDone.add(item.mission.id)
      xpGain += item.mission.xp
    }
  }

  const weeklyWithAwards = weeklyProgress.map((item) => ({
    ...item,
    completed: item.completed || weeklyDone.has(item.mission.id),
  }))
  const bonus = computeWeeklyBonusProgress(weeklyWithAwards)

  if (bonus.bonusEarned && !weeklyDone.has(WEEKLY_BONUS_ID)) {
    weeklyDone.add(WEEKLY_BONUS_ID)
    xpGain += bonus.bonusXp
  }

  for (const item of monthlyProgress) {
    if (item.completed && !monthlyDone.has(item.mission.id)) {
      monthlyDone.add(item.mission.id)
      xpGain += item.mission.xp
    }
  }

  for (const item of historicalProgress) {
    if (item.completed && !completedHistorical.has(item.mission.id)) {
      completedHistorical.add(item.mission.id)
      xpGain += item.mission.xp
    }
  }

  const totalXp = next.xp + xpGain

  return {
    ...next,
    xp: totalXp,
    adelinas: next.adelinas,
    lastCelebratedLevel: next.lastCelebratedLevel,
    completedMissions: [...completedHistorical],
    weeklyCompleted: [...weeklyDone],
    monthlyCompleted: [...monthlyDone],
    awardedReservationXpIds: next.awardedReservationXpIds,
    claimedPromotions: next.claimedPromotions,
    ladderBaselinesByCompany: next.ladderBaselinesByCompany,
    activeLadderPromotionByCompany: next.activeLadderPromotionByCompany,
    ladderCompletionsByCompany: next.ladderCompletionsByCompany,
  }
}
