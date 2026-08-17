import { MONTHLY_MISSION_POOL, WEEKLY_MISSIONS } from '../data/gamificationMissions'
import { GAMIFICATION_LEVELS } from '../data/gamificationLevels'
import type {
  CustomerGamificationState,
  GamificationLevel,
  MissionDefinition,
  MissionProgress,
} from '../types/gamification'
import type { Reservation } from '../types'
import { WEEKLY_BONUS_TARGET, WEEKLY_MISSION_BONUS_XP, CONFIRMED_RESERVATION_XP } from '../types/gamification'
import { countsForPromotionProgress } from './reservationPromotionEligibility'

export interface GamificationContext {
  reservations: Reservation[]
  favoriteSlugs: string[]
  promotionCompanyIds: Set<string>
  restaurantZones: Map<string, string>
  restaurantCategories: Map<string, string[]>
  weeklyFeaturedCategory: string
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

function firstVisitsThisWeek(attended: Reservation[]): Reservation[] {
  const weekStart = getWeekStart()
  const weekReservations = reservationsThisWeek(attended)

  return weekReservations.filter((reservation) => {
    const hadPriorVisit = attended.some(
      (entry) =>
        entry.companyId === reservation.companyId
        && entry.startTime < weekStart,
    )
    return !hadPriorVisit
  })
}

function firstVisitsThisMonth(attended: Reservation[]): Reservation[] {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthReservations = reservationsThisMonth(attended)

  return monthReservations.filter((reservation) => {
    const hadPriorVisit = attended.some(
      (entry) =>
        entry.companyId === reservation.companyId
        && entry.startTime < monthStart,
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
  reservations: Reservation[],
  categories: Map<string, string[]>,
): number {
  const seen = new Set<string>()

  for (const reservation of reservations) {
    for (const characteristic of categories.get(reservation.companyId) ?? []) {
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

function processReservationXp(
  state: CustomerGamificationState,
  reservations: Reservation[],
): CustomerGamificationState {
  const awarded = new Set(state.awardedReservationXpIds)
  let xpGain = 0
  const nextAwarded = [...state.awardedReservationXpIds]

  for (const reservation of attendedReservations(reservations)) {
    if (awarded.has(reservation.id)) {
      continue
    }

    xpGain += CONFIRMED_RESERVATION_XP
    nextAwarded.push(reservation.id)
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

function uniqueZones(reservations: Reservation[], zones: Map<string, string>): number {
  const seen = new Set<string>()

  for (const reservation of reservations) {
    const zone = zones.get(reservation.companyId)
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
  const weekReservations = reservationsThisWeek(attended)
  const monthReservations = reservationsThisMonth(attended)
  const weekBookings = reservationsCreatedThisWeek(context.reservations)
  const favoritesAddedThisWeek = computeFavoritesAddedThisWeek(
    context.favoriteSlugs,
    state.favoriteSlugsAtWeekStart,
  )
  const firstVisits = firstVisitsThisWeek(attended)

  switch (mission.id) {
    case 'plan_fin_semana':
      return {
        current: weekReservations.filter((reservation) => isWeekend(reservation.startTime)).length,
        completed: weekReservations.some((reservation) => isWeekend(reservation.startTime)),
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
      const uniqueWeek = new Set(weekReservations.map((reservation) => reservation.companyId)).size
      return { current: uniqueWeek, completed: uniqueWeek >= 2 }
    }
    case 'descubrimiento_semanal':
      return {
        current: firstVisits.length,
        completed: firstVisits.length >= 1,
      }
    case 'en_busca_ofertas': {
      const promoReservations = weekReservations.filter(
        (reservation) => context.promotionCompanyIds.has(reservation.companyId),
      )
      return {
        current: promoReservations.length,
        completed: promoReservations.length >= 1,
      }
    }
    case 'fiel_seguidor':
      return {
        current: favoritesAddedThisWeek,
        completed: favoritesAddedThisWeek >= 3,
      }
    case 'critico_foto':
      return {
        current: state.reviewsWithPhotoCount,
        completed: state.reviewsWithPhotoCount >= mission.target,
      }
    case 'voz_experiencia':
      return {
        current: state.textReviewsCount,
        completed: state.textReviewsCount >= mission.target,
      }
    case 'critico_consistente':
      return {
        current: state.reviewsWithPhotoCount,
        completed: state.reviewsWithPhotoCount >= mission.target,
      }
    case 'ruta_especialidades': {
      const matches = weekReservations.filter((reservation) =>
        restaurantHasCharacteristic(
          reservation.companyId,
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
        current: weekReservations.filter((reservation) => isWeekdaySlow(reservation.startTime)).length,
        completed: weekReservations.some((reservation) => isWeekdaySlow(reservation.startTime)),
      }
    case 'ruta_gastronomica':
      return {
        current: monthReservations.length,
        completed: monthReservations.length >= 4,
      }
    case 'cazador_adelinas':
      return {
        current: state.redemptionsCount,
        completed: state.redemptionsCount >= 1,
      }
    case 'explorador_ciudad':
      return {
        current: uniqueZones(monthReservations, context.restaurantZones),
        completed: uniqueZones(monthReservations, context.restaurantZones) >= 3,
      }
    case 'menu_completo': {
      const lunch = monthReservations.some((reservation) => isLunchHour(reservation.startTime))
      const dinner = monthReservations.some((reservation) => isDinnerHour(reservation.startTime))
      const current = Number(lunch) + Number(dinner)
      return { current, completed: lunch && dinner }
    }
    case 'maraton_mensual':
      return {
        current: monthReservations.length,
        completed: monthReservations.length >= 6,
      }
    case 'grupo_grande_mes':
      return {
        current: monthReservations.filter((reservation) => reservation.pax >= 4).length,
        completed: monthReservations.some((reservation) => reservation.pax >= 4),
      }
    case 'promo_doble_mes': {
      const promoCount = monthReservations.filter(
        (reservation) => context.promotionCompanyIds.has(reservation.companyId),
      ).length
      return { current: promoCount, completed: promoCount >= 2 }
    }
    case 'finde_gourmet_mes':
      return {
        current: monthReservations.filter((reservation) => isWeekend(reservation.startTime)).length,
        completed: monthReservations.filter((reservation) => isWeekend(reservation.startTime)).length >= 2,
      }
    case 'valle_laboral_mes':
      return {
        current: monthReservations.filter((reservation) => isWeekdaySlow(reservation.startTime)).length,
        completed: monthReservations.filter((reservation) => isWeekdaySlow(reservation.startTime)).length >= 2,
      }
    case 'descubridor_mes':
      return {
        current: firstVisitsThisMonth(attended).length,
        completed: firstVisitsThisMonth(attended).length >= 2,
      }
    case 'debut_gastronomico':
      return { current: attended.length, completed: attended.length >= 1 }
    case 'corazon_favorito':
      return {
        current: context.favoriteSlugs.length,
        completed: context.favoriteSlugs.length >= 1,
      }
    case 'almuerzo_sol':
      return {
        current: attended.filter((reservation) => isLunchHour(reservation.startTime)).length,
        completed: attended.some((reservation) => isLunchHour(reservation.startTime)),
      }
    case 'cena_especial':
      return {
        current: attended.filter((reservation) => isDinnerHour(reservation.startTime)).length,
        completed: attended.some((reservation) => isDinnerHour(reservation.startTime)),
      }
    case 'martes_valiente':
      return {
        current: attended.filter((reservation) => isWeekdaySlow(reservation.startTime)).length,
        completed: attended.some((reservation) => isWeekdaySlow(reservation.startTime)),
      }
    case 'mesa_para_dos':
      return {
        current: attended.filter((reservation) => reservation.pax >= 2).length,
        completed: attended.some((reservation) => reservation.pax >= 2),
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
      const promoCount = attended.filter(
        (reservation) => context.promotionCompanyIds.has(reservation.companyId),
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
      const zones = uniqueZones(attended, context.restaurantZones)
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
      const uniqueVenues = new Set(attended.map((reservation) => reservation.companyId)).size
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
      const venues = new Set(attended.map((reservation) => reservation.companyId)).size
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
      const unique = new Set(attended.map((reservation) => reservation.companyId)).size
      return { current: unique, completed: unique >= 10 }
    }
    case 'ruta_internacional': {
      const cuisines = uniqueInternationalCuisines(attended, context.restaurantCategories)
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
    const leftScore = (left.id.charCodeAt(0) + seed) % 97
    const rightScore = (right.id.charCodeAt(0) + seed) % 97
    return leftScore - rightScore
  })

  return sorted.slice(0, count)
}

export function rotateMonthlyMissions(date = new Date(), count = 5): MissionDefinition[] {
  const monthKey = getMonthKey(date)
  const seed = hashKey(monthKey)
  const sorted = [...MONTHLY_MISSION_POOL].sort((left, right) => {
    const leftScore = (left.id.charCodeAt(0) + seed) % 97
    const rightScore = (right.id.charCodeAt(0) + seed) % 97
    return leftScore - rightScore
  })

  return sorted.slice(0, count)
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

  return {
    ...state,
    weekKey,
    monthKey,
    weeklyCompleted: sameWeek ? state.weeklyCompleted : [],
    monthlyCompleted: state.monthKey === monthKey ? state.monthlyCompleted : [],
    favoriteSlugsAtWeekStart: sameWeek ? state.favoriteSlugsAtWeekStart : favoriteSlugs,
    favoritesAddedThisWeek: sameWeek
      ? computeFavoritesAddedThisWeek(favoriteSlugs, state.favoriteSlugsAtWeekStart)
      : 0,
  }
}

export function deriveVisitedCompanyIds(reservations: Reservation[]): string[] {
  return [...new Set(
    attendedReservations(reservations).map((reservation) => reservation.companyId),
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
): CustomerGamificationState {
  let next = syncGamificationPeriods(state, favoriteSlugs)
  next = processReservationXp(next, reservations)
  next = {
    ...next,
    redemptionsCount: Math.max(next.redemptionsCount, next.claimedPromotions.length),
    visitedCompanyIds: deriveVisitedCompanyIds(reservations),
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
