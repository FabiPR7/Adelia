import type { Reservation } from '../types'
import type { CompanyReview } from '../types/review'
import type { MissionDefinition, MissionProgress } from '../types/gamification'
import type { CompanyGamificationState } from '../types/companyGamification'
import { defaultCompanyGamificationState } from '../types/companyGamification'
import {
  COMPANY_CONFIRMED_XP,
  COMPANY_HISTORICAL_MISSIONS,
  COMPANY_MONTHLY_MISSIONS,
  COMPANY_MONTHLY_SLOT_COUNT,
  COMPANY_REPLY_XP,
  COMPANY_REVIEW_XP,
  COMPANY_WEEKLY_BONUS_TARGET,
  COMPANY_WEEKLY_BONUS_XP,
  COMPANY_WEEKLY_MISSIONS,
  COMPANY_WEEKLY_SLOT_COUNT,
  getCompanyLevelForXp,
} from '../data/companyGamificationCatalog'
import { getWeekKey } from './gamificationProgress'
import { madridHour, madridWeekday } from './madridDateTime'

export interface CompanyMissionContext {
  reservations: Reservation[]
  reviews: CompanyReview[]
  activePromotionCount: number
  reviewAdelinas: number
  reviewCount: number
  reviewRatingSum: number
  now?: Date
}

function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function hashKey(key: string): number {
  return key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function startOfIsoWeek(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  return start
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function inRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime()
  return time >= start.getTime() && time < end.getTime()
}

function visitDate(reservation: Reservation): Date {
  return reservation.startTime instanceof Date
    ? reservation.startTime
    : new Date(reservation.startTime)
}

function confirmedReservations(reservations: Reservation[]): Reservation[] {
  return reservations.filter((reservation) => reservation.status === 'confirmed')
}

function isWeekday(date: Date): boolean {
  const day = madridWeekday(date)
  return day >= 1 && day <= 4
}

function isWeekend(date: Date): boolean {
  const day = madridWeekday(date)
  return day === 0 || day === 5 || day === 6
}

function isLunch(date: Date): boolean {
  const hour = madridHour(date)
  return hour >= 12 && hour < 17
}

function isDinner(date: Date): boolean {
  const hour = madridHour(date)
  return hour >= 19 && hour <= 23
}

function guestKey(reservation: Reservation): string {
  const email = reservation.clientEmail.trim().toLowerCase()
  if (email) {
    return `email:${email}`
  }
  const phone = reservation.clientPhone.trim().toLowerCase()
  if (phone) {
    return `phone:${phone}`
  }
  return `name:${reservation.clientName.trim().toLowerCase()}`
}

function firstVisitKeys(reservations: Reservation[]): Set<string> {
  const first = new Map<string, string>()
  const ordered = [...confirmedReservations(reservations)].sort(
    (left, right) => visitDate(left).getTime() - visitDate(right).getTime(),
  )
  for (const reservation of ordered) {
    const key = guestKey(reservation)
    if (!first.has(key)) {
      first.set(key, reservation.id)
    }
  }
  return new Set(first.values())
}

function replyDate(review: CompanyReview): Date | null {
  const reply = review.ownerReply
  if (!reply?.text.trim()) {
    return null
  }
  return reply.updatedAt ?? reply.createdAt
}

export function rotateCompanyWeeklyMissions(date = new Date()): MissionDefinition[] {
  const seed = hashKey(getWeekKey(date))
  return [...COMPANY_WEEKLY_MISSIONS]
    .sort((left, right) => (
      (left.id.charCodeAt(0) + seed) % 97 - (right.id.charCodeAt(0) + seed) % 97
    ))
    .slice(0, COMPANY_WEEKLY_SLOT_COUNT)
}

export function rotateCompanyMonthlyMissions(date = new Date()): MissionDefinition[] {
  const seed = hashKey(getMonthKey(date))
  return [...COMPANY_MONTHLY_MISSIONS]
    .sort((left, right) => (
      (left.id.charCodeAt(0) + seed) % 97 - (right.id.charCodeAt(0) + seed) % 97
    ))
    .slice(0, COMPANY_MONTHLY_SLOT_COUNT)
}

function evaluateCompanyMission(
  mission: MissionDefinition,
  context: CompanyMissionContext,
): { current: number; completed: boolean } {
  const now = context.now ?? new Date()
  const weekStart = startOfIsoWeek(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const monthStart = startOfMonth(now)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const confirmed = confirmedReservations(context.reservations)
  const weekVisits = confirmed.filter((item) => inRange(visitDate(item), weekStart, weekEnd))
  const monthVisits = confirmed.filter((item) => inRange(visitDate(item), monthStart, monthEnd))
  const firstVisits = firstVisitKeys(context.reservations)
  const weekReplies = context.reviews.filter((review) => {
    const date = replyDate(review)
    return date ? inRange(date, weekStart, weekEnd) : false
  })
  const monthReplies = context.reviews.filter((review) => {
    const date = replyDate(review)
    return date ? inRange(date, monthStart, monthEnd) : false
  })
  const monthReviews = context.reviews.filter((review) => inRange(review.createdAt, monthStart, monthEnd))
  const photoReviews = context.reviews.filter((review) => review.hasPhoto)
  const repliesTotal = context.reviews.filter((review) => Boolean(review.ownerReply?.text.trim()))
  const average = context.reviewCount > 0 ? context.reviewRatingSum / context.reviewCount : 0

  const countById: Record<string, number> = {
    servicio_semana: weekVisits.length,
    valle_semana: weekVisits.filter((item) => isWeekday(visitDate(item))).length,
    finde_semana: weekVisits.filter((item) => isWeekend(visitDate(item))).length,
    respuesta_semana: weekReplies.length,
    mesa_llena_semana: weekVisits.filter((item) => item.pax >= 4).length,
    ritmo_semana: weekVisits.length,
    oferta_viva: context.activePromotionCount > 0 ? 1 : 0,
    comida_semana: weekVisits.filter((item) => isLunch(visitDate(item))).length,
    cena_semana: weekVisits.filter((item) => isDinner(visitDate(item))).length,
    grupo_semana: weekVisits.filter((item) => item.pax >= 8).length,
    dias_semana: new Set(weekVisits.map((item) => visitDate(item).toDateString())).size,
    bienvenida_semana: weekVisits.filter((item) => firstVisits.has(item.id)).length,
    volumen_mes: monthVisits.length,
    respuestas_mes: monthReplies.length,
    valle_mes: monthVisits.filter((item) => isWeekday(visitDate(item))).length,
    nuevos_mes: monthVisits.filter((item) => firstVisits.has(item.id)).length,
    nota_casa_mes: monthReviews.length >= 2
      ? monthReviews.reduce((sum, review) => sum + review.rating, 0) / monthReviews.length
      : 0,
    mesas_grandes_mes: monthVisits.filter((item) => item.pax >= 4).length,
    ritmo_mes: monthVisits.length,
    finde_mes: monthVisits.filter((item) => isWeekend(visitDate(item))).length,
    cubiertos_mes: monthVisits.reduce((sum, item) => sum + item.pax, 0),
    fotos_mes: monthReviews.filter((review) => review.hasPhoto).length,
    primera_mesa: confirmed.length,
    diez_servicios: confirmed.length,
    cincuenta_mesas: confirmed.length,
    cien_reservas: confirmed.length,
    doscientas_mesas: confirmed.length,
    veterano_adelia: confirmed.length,
    primera_opinion: context.reviewCount,
    diez_opiniones: context.reviewCount,
    cincuenta_voces: context.reviewCount,
    anfitrion_responde: repliesTotal.length,
    maestro_respuesta: repliesTotal.length,
    media_cuatro: context.reviewCount >= 5 && average >= 4 ? 4 : Math.min(4, average),
    media_brillante: context.reviewCount >= 10 && average >= 4.5 ? 5 : 0,
    adelinas_100: context.reviewAdelinas,
    adelinas_500: context.reviewAdelinas,
    foto_casa: photoReviews.length,
    grupo_festejo: confirmed.some((item) => item.pax >= 10) ? 1 : 0,
    casa_del_barrio: 0,
    casa_ilustre: 0,
    emblema_fogon: 0,
  }

  const current = countById[mission.id] ?? 0
  if (mission.id === 'nota_casa_mes') {
    return { current: Math.min(mission.target, current), completed: current >= 4 }
  }
  if (mission.id === 'media_cuatro') {
    return { current: Math.min(mission.target, current), completed: context.reviewCount >= 5 && average >= 4 }
  }
  if (mission.id === 'media_brillante') {
    return { current: context.reviewCount >= 10 && average >= 4.5 ? 5 : 0, completed: context.reviewCount >= 10 && average >= 4.5 }
  }

  return {
    current: Math.min(mission.target, current),
    completed: current >= mission.target,
  }
}

export function buildCompanyMissionProgress(
  missions: MissionDefinition[],
  context: CompanyMissionContext,
  completedIds: Set<string>,
  xp = 0,
): MissionProgress[] {
  const level = getCompanyLevelForXp(xp)
  return missions.map((mission) => {
    if (mission.id === 'casa_del_barrio' || mission.id === 'casa_ilustre' || mission.id === 'emblema_fogon') {
      const reached = level.level >= mission.target
      return {
        mission,
        current: Math.min(mission.target, level.level),
        completed: reached || completedIds.has(mission.id),
        progress: reached || completedIds.has(mission.id) ? 1 : Math.min(1, level.level / mission.target),
      }
    }

    const evaluation = evaluateCompanyMission(mission, context)
    const completed = evaluation.completed || completedIds.has(mission.id)
    return {
      mission,
      current: evaluation.current,
      completed,
      progress: completed ? 1 : Math.min(1, evaluation.current / mission.target),
    }
  })
}

export function syncCompanyGamificationPeriods(
  state: CompanyGamificationState,
  now = new Date(),
): CompanyGamificationState {
  const weekKey = getWeekKey(now)
  const monthKey = getMonthKey(now)
  return {
    ...state,
    weekKey,
    monthKey,
    weeklyCompleted: state.weekKey === weekKey ? state.weeklyCompleted : [],
    monthlyCompleted: state.monthKey === monthKey ? state.monthlyCompleted : [],
  }
}

function awardUniqueXp(
  state: CompanyGamificationState,
  ids: string[],
  awardedKey: 'awardedReservationXpIds' | 'awardedReviewXpIds' | 'awardedReplyXpIds',
  xpEach: number,
): CompanyGamificationState {
  const awarded = new Set(state[awardedKey])
  const nextAwarded = [...state[awardedKey]]
  let xpGain = 0
  for (const id of ids) {
    if (awarded.has(id)) {
      continue
    }
    awarded.add(id)
    nextAwarded.push(id)
    xpGain += xpEach
  }
  if (xpGain === 0) {
    return state
  }
  return {
    ...state,
    xp: state.xp + xpGain,
    [awardedKey]: nextAwarded.slice(-400),
  }
}

export function processCompanyGamification(
  rawState: CompanyGamificationState | null | undefined,
  context: CompanyMissionContext,
): {
  state: CompanyGamificationState
  weeklyProgress: MissionProgress[]
  monthlyProgress: MissionProgress[]
  historicalProgress: MissionProgress[]
  weeklyBonus: { completedCount: number; bonusEarned: boolean; bonusXp: number }
} {
  const now = context.now ?? new Date()
  let next = syncCompanyGamificationPeriods(rawState ?? defaultCompanyGamificationState(), now)
  next = awardUniqueXp(
    next,
    confirmedReservations(context.reservations).map((item) => item.id),
    'awardedReservationXpIds',
    COMPANY_CONFIRMED_XP,
  )
  next = awardUniqueXp(
    next,
    context.reviews.map((item) => item.id),
    'awardedReviewXpIds',
    COMPANY_REVIEW_XP,
  )
  next = awardUniqueXp(
    next,
    context.reviews.filter((item) => Boolean(item.ownerReply?.text.trim())).map((item) => item.id),
    'awardedReplyXpIds',
    COMPANY_REPLY_XP,
  )

  const weeklyMissions = rotateCompanyWeeklyMissions(now)
  const monthlyMissions = rotateCompanyMonthlyMissions(now)
  const weeklyDone = new Set(next.weeklyCompleted)
  const monthlyDone = new Set(next.monthlyCompleted)
  const historicalDone = new Set(next.completedMissions)

  const weeklyProgress = buildCompanyMissionProgress(weeklyMissions, context, weeklyDone, next.xp)
  const monthlyProgress = buildCompanyMissionProgress(monthlyMissions, context, monthlyDone, next.xp)

  let xpGain = 0
  for (const item of weeklyProgress) {
    if (item.completed && !weeklyDone.has(item.mission.id)) {
      weeklyDone.add(item.mission.id)
      xpGain += item.mission.xp
    }
  }
  const weeklyCompletedCount = weeklyProgress.filter((item) => item.completed || weeklyDone.has(item.mission.id)).length
  const bonusEarned = weeklyCompletedCount >= COMPANY_WEEKLY_BONUS_TARGET
  if (bonusEarned && !weeklyDone.has('weekly_bonus')) {
    weeklyDone.add('weekly_bonus')
    xpGain += COMPANY_WEEKLY_BONUS_XP
  }
  for (const item of monthlyProgress) {
    if (item.completed && !monthlyDone.has(item.mission.id)) {
      monthlyDone.add(item.mission.id)
      xpGain += item.mission.xp
    }
  }

  next = {
    ...next,
    xp: next.xp + xpGain,
    weeklyCompleted: [...weeklyDone],
    monthlyCompleted: [...monthlyDone],
  }

  const historicalProgress = buildCompanyMissionProgress(
    COMPANY_HISTORICAL_MISSIONS,
    context,
    historicalDone,
    next.xp,
  )
  let historicalXp = 0
  for (const item of historicalProgress) {
    if (item.completed && !historicalDone.has(item.mission.id)) {
      historicalDone.add(item.mission.id)
      historicalXp += item.mission.xp
    }
  }
  next = {
    ...next,
    xp: next.xp + historicalXp,
    completedMissions: [...historicalDone],
    lastCelebratedLevel: next.lastCelebratedLevel ?? getCompanyLevelForXp(next.xp).level,
  }

  const weeklyFinal = buildCompanyMissionProgress(weeklyMissions, context, new Set(next.weeklyCompleted), next.xp)
  const monthlyFinal = buildCompanyMissionProgress(monthlyMissions, context, new Set(next.monthlyCompleted), next.xp)
  const historicalFinal = buildCompanyMissionProgress(
    COMPANY_HISTORICAL_MISSIONS,
    context,
    new Set(next.completedMissions),
    next.xp,
  )

  return {
    state: next,
    weeklyProgress: weeklyFinal,
    monthlyProgress: monthlyFinal,
    historicalProgress: historicalFinal,
    weeklyBonus: {
      completedCount: weeklyFinal.filter((item) => item.completed).length,
      bonusEarned: weeklyFinal.filter((item) => item.completed).length >= COMPANY_WEEKLY_BONUS_TARGET,
      bonusXp: COMPANY_WEEKLY_BONUS_XP,
    },
  }
}
