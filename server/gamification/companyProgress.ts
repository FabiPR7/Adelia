import {
  COMPANY_CONFIRMED_XP,
  COMPANY_MISSIONS,
  COMPANY_MONTHLY_SLOT_COUNT,
  COMPANY_REPLY_XP,
  COMPANY_REVIEW_XP,
  COMPANY_WEEKLY_BONUS_TARGET,
  COMPANY_WEEKLY_BONUS_XP,
  COMPANY_WEEKLY_SLOT_COUNT,
  getCompanyLevelForXp,
  type CompanyMissionDef,
} from './companyCatalog.ts'
import { madridHour, madridWeekday } from '../utils/madridDateTime.ts'

export interface CompanyVisit {
  id: string
  status: string
  startTime: Date
  pax: number
  clientEmail: string
  clientPhone: string
  clientName: string
}

export interface CompanyReviewRow {
  id: string
  rating: number
  hasPhoto: boolean
  createdAt: Date
  replyText: string
  replyAt: Date | null
}

export interface CompanyGamificationState {
  xp: number
  weekKey: string
  monthKey: string
  weeklyCompleted: string[]
  monthlyCompleted: string[]
  completedMissions: string[]
  awardedReservationXpIds: string[]
  awardedReviewXpIds: string[]
  awardedReplyXpIds: string[]
  lastCelebratedLevel: number | null
}

export interface CompanyMissionContext {
  reservations: CompanyVisit[]
  reviews: CompanyReviewRow[]
  activePromotionCount: number
  reviewAdelinas: number
  reviewCount: number
  reviewRatingSum: number
  lifetimeConfirmedCount?: number
  now?: Date
}

export function defaultCompanyGamificationState(): CompanyGamificationState {
  return {
    xp: 0,
    weekKey: '',
    monthKey: '',
    weeklyCompleted: [],
    monthlyCompleted: [],
    completedMissions: [],
    awardedReservationXpIds: [],
    awardedReviewXpIds: [],
    awardedReplyXpIds: [],
    lastCelebratedLevel: null,
  }
}

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

function startOfIsoWeek(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  return start
}

function inRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime()
  return time >= start.getTime() && time < end.getTime()
}

function confirmed(reservations: CompanyVisit[]): CompanyVisit[] {
  return reservations.filter((item) => item.status === 'confirmed')
}

function isWeekday(date: Date): boolean {
  const day = madridWeekday(date)
  return day >= 1 && day <= 4
}

function isWeekend(date: Date): boolean {
  const day = madridWeekday(date)
  return day === 0 || day === 5 || day === 6
}

function guestKey(reservation: CompanyVisit): string {
  const email = reservation.clientEmail.trim().toLowerCase()
  if (email) return `email:${email}`
  const phone = reservation.clientPhone.trim().toLowerCase()
  if (phone) return `phone:${phone}`
  return `name:${reservation.clientName.trim().toLowerCase()}`
}

function firstVisitIds(reservations: CompanyVisit[]): Set<string> {
  const first = new Map<string, string>()
  const ordered = [...confirmed(reservations)].sort(
    (left, right) => left.startTime.getTime() - right.startTime.getTime(),
  )
  for (const reservation of ordered) {
    const key = guestKey(reservation)
    if (!first.has(key)) first.set(key, reservation.id)
  }
  return new Set(first.values())
}

export function rotateWeekly(date = new Date()): CompanyMissionDef[] {
  const seed = hashKey(getWeekKey(date))
  return COMPANY_MISSIONS
    .filter((item) => item.cadence === 'weekly')
    .sort((left, right) => (left.id.charCodeAt(0) + seed) % 97 - (right.id.charCodeAt(0) + seed) % 97)
    .slice(0, COMPANY_WEEKLY_SLOT_COUNT)
}

export function rotateMonthly(date = new Date()): CompanyMissionDef[] {
  const seed = hashKey(getMonthKey(date))
  return COMPANY_MISSIONS
    .filter((item) => item.cadence === 'monthly')
    .sort((left, right) => (left.id.charCodeAt(0) + seed) % 97 - (right.id.charCodeAt(0) + seed) % 97)
    .slice(0, COMPANY_MONTHLY_SLOT_COUNT)
}

function missionCurrent(mission: CompanyMissionDef, context: CompanyMissionContext, level: number): number {
  const now = context.now ?? new Date()
  const weekStart = startOfIsoWeek(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const visits = confirmed(context.reservations)
  const weekVisits = visits.filter((item) => inRange(item.startTime, weekStart, weekEnd))
  const monthVisits = visits.filter((item) => inRange(item.startTime, monthStart, monthEnd))
  const firstIds = firstVisitIds(context.reservations)
  const weekReplies = context.reviews.filter((review) => review.replyAt && inRange(review.replyAt, weekStart, weekEnd))
  const monthReplies = context.reviews.filter((review) => review.replyAt && inRange(review.replyAt, monthStart, monthEnd))
  const monthReviews = context.reviews.filter((review) => inRange(review.createdAt, monthStart, monthEnd))
  const repliesTotal = context.reviews.filter((review) => review.replyText.trim())
  const average = context.reviewCount > 0 ? context.reviewRatingSum / context.reviewCount : 0
  const monthAverage = monthReviews.length >= 2
    ? monthReviews.reduce((sum, review) => sum + review.rating, 0) / monthReviews.length
    : 0

  switch (mission.id) {
    case 'servicio_semana':
    case 'ritmo_semana':
      return weekVisits.length
    case 'valle_semana':
      return weekVisits.filter((item) => isWeekday(item.startTime)).length
    case 'finde_semana':
      return weekVisits.filter((item) => isWeekend(item.startTime)).length
    case 'respuesta_semana':
      return weekReplies.length
    case 'mesa_llena_semana':
      return weekVisits.filter((item) => item.pax >= 4).length
    case 'oferta_viva':
      return context.activePromotionCount > 0 ? 1 : 0
    case 'comida_semana':
      return weekVisits.filter((item) => madridHour(item.startTime) >= 12 && madridHour(item.startTime) < 17).length
    case 'cena_semana':
      return weekVisits.filter((item) => madridHour(item.startTime) >= 19 && madridHour(item.startTime) <= 23).length
    case 'grupo_semana':
      return weekVisits.filter((item) => item.pax >= 8).length
    case 'dias_semana':
      return new Set(weekVisits.map((item) => item.startTime.toDateString())).size
    case 'bienvenida_semana':
      return weekVisits.filter((item) => firstIds.has(item.id)).length
    case 'volumen_mes':
    case 'ritmo_mes':
      return monthVisits.length
    case 'respuestas_mes':
      return monthReplies.length
    case 'valle_mes':
      return monthVisits.filter((item) => isWeekday(item.startTime)).length
    case 'nuevos_mes':
      return monthVisits.filter((item) => firstIds.has(item.id)).length
    case 'nota_casa_mes':
      return monthAverage
    case 'mesas_grandes_mes':
      return monthVisits.filter((item) => item.pax >= 4).length
    case 'finde_mes':
      return monthVisits.filter((item) => isWeekend(item.startTime)).length
    case 'cubiertos_mes':
      return monthVisits.reduce((sum, item) => sum + item.pax, 0)
    case 'fotos_mes':
      return monthReviews.filter((review) => review.hasPhoto).length
    case 'primera_mesa':
    case 'diez_servicios':
    case 'cincuenta_mesas':
    case 'cien_reservas':
    case 'doscientas_mesas':
    case 'veterano_adelia':
      return context.lifetimeConfirmedCount ?? visits.length
    case 'primera_opinion':
    case 'diez_opiniones':
    case 'cincuenta_voces':
      return context.reviewCount
    case 'anfitrion_responde':
    case 'maestro_respuesta':
      return repliesTotal.length
    case 'media_cuatro':
      return context.reviewCount >= 5 && average >= 4 ? 4 : 0
    case 'media_brillante':
      return context.reviewCount >= 10 && average >= 4.5 ? 5 : 0
    case 'adelinas_100':
    case 'adelinas_500':
      return context.reviewAdelinas
    case 'foto_casa':
      return context.reviews.filter((review) => review.hasPhoto).length
    case 'grupo_festejo':
      return visits.some((item) => item.pax >= 10) ? 1 : 0
    case 'casa_del_barrio':
    case 'casa_ilustre':
    case 'emblema_fogon':
      return level
    default:
      return 0
  }
}

function missionCompleted(mission: CompanyMissionDef, current: number, context: CompanyMissionContext, level: number): boolean {
  if (mission.id === 'nota_casa_mes') return current >= 4
  if (mission.id === 'media_cuatro') {
    const average = context.reviewCount > 0 ? context.reviewRatingSum / context.reviewCount : 0
    return context.reviewCount >= 5 && average >= 4
  }
  if (mission.id === 'media_brillante') {
    const average = context.reviewCount > 0 ? context.reviewRatingSum / context.reviewCount : 0
    return context.reviewCount >= 10 && average >= 4.5
  }
  if (mission.id === 'casa_del_barrio' || mission.id === 'casa_ilustre' || mission.id === 'emblema_fogon') {
    return level >= mission.target
  }
  return current >= mission.target
}

function readState(value: Record<string, unknown> | undefined): CompanyGamificationState {
  const fallback = defaultCompanyGamificationState()
  if (!value) return fallback
  const strings = (input: unknown) => Array.isArray(input)
    ? input.filter((item): item is string => typeof item === 'string')
    : []
  return {
    xp: typeof value.xp === 'number' && Number.isFinite(value.xp) ? Math.max(0, Math.trunc(value.xp)) : 0,
    weekKey: typeof value.weekKey === 'string' ? value.weekKey : '',
    monthKey: typeof value.monthKey === 'string' ? value.monthKey : '',
    weeklyCompleted: strings(value.weeklyCompleted),
    monthlyCompleted: strings(value.monthlyCompleted),
    completedMissions: strings(value.completedMissions),
    awardedReservationXpIds: strings(value.awardedReservationXpIds).slice(-400),
    awardedReviewXpIds: strings(value.awardedReviewXpIds).slice(-400),
    awardedReplyXpIds: strings(value.awardedReplyXpIds).slice(-400),
    lastCelebratedLevel: typeof value.lastCelebratedLevel === 'number' ? value.lastCelebratedLevel : null,
  }
}

function awardIds(
  state: CompanyGamificationState,
  ids: string[],
  key: 'awardedReservationXpIds' | 'awardedReviewXpIds' | 'awardedReplyXpIds',
  xpEach: number,
): CompanyGamificationState {
  const awarded = new Set(state[key])
  const next = [...state[key]]
  let gain = 0
  for (const id of ids) {
    if (awarded.has(id)) continue
    awarded.add(id)
    next.push(id)
    gain += xpEach
  }
  if (gain === 0) return state
  return { ...state, xp: state.xp + gain, [key]: next.slice(-400) }
}

export function processCompanyGamification(
  raw: Record<string, unknown> | undefined,
  context: CompanyMissionContext,
): CompanyGamificationState {
  const now = context.now ?? new Date()
  const weekKey = getWeekKey(now)
  const monthKey = getMonthKey(now)
  let next = readState(raw)
  next = {
    ...next,
    weekKey,
    monthKey,
    weeklyCompleted: next.weekKey === weekKey ? next.weeklyCompleted : [],
    monthlyCompleted: next.monthKey === monthKey ? next.monthlyCompleted : [],
  }
  next = awardIds(next, confirmed(context.reservations).map((item) => item.id), 'awardedReservationXpIds', COMPANY_CONFIRMED_XP)
  next = awardIds(next, context.reviews.map((item) => item.id), 'awardedReviewXpIds', COMPANY_REVIEW_XP)
  next = awardIds(
    next,
    context.reviews.filter((item) => item.replyText.trim()).map((item) => item.id),
    'awardedReplyXpIds',
    COMPANY_REPLY_XP,
  )

  const weeklyDone = new Set(next.weeklyCompleted)
  const monthlyDone = new Set(next.monthlyCompleted)
  const historicalDone = new Set(next.completedMissions)
  let xpGain = 0
  const levelNow = () => getCompanyLevelForXp(next.xp).level

  for (const mission of rotateWeekly(now)) {
    const current = missionCurrent(mission, context, levelNow())
    if (missionCompleted(mission, current, context, levelNow()) && !weeklyDone.has(mission.id)) {
      weeklyDone.add(mission.id)
      xpGain += mission.xp
    }
  }
  const weeklyCompleteCount = rotateWeekly(now).filter((mission) => {
    const current = missionCurrent(mission, context, levelNow())
    return weeklyDone.has(mission.id) || missionCompleted(mission, current, context, levelNow())
  }).length
  if (weeklyCompleteCount >= COMPANY_WEEKLY_BONUS_TARGET && !weeklyDone.has('weekly_bonus')) {
    weeklyDone.add('weekly_bonus')
    xpGain += COMPANY_WEEKLY_BONUS_XP
  }
  for (const mission of rotateMonthly(now)) {
    const current = missionCurrent(mission, context, levelNow())
    if (missionCompleted(mission, current, context, levelNow()) && !monthlyDone.has(mission.id)) {
      monthlyDone.add(mission.id)
      xpGain += mission.xp
    }
  }
  next = {
    ...next,
    xp: next.xp + xpGain,
    weeklyCompleted: [...weeklyDone],
    monthlyCompleted: [...monthlyDone],
  }

  let historicalXp = 0
  for (const mission of COMPANY_MISSIONS.filter((item) => item.cadence === 'historical')) {
    const current = missionCurrent(mission, context, getCompanyLevelForXp(next.xp).level)
    if (missionCompleted(mission, current, context, getCompanyLevelForXp(next.xp).level) && !historicalDone.has(mission.id)) {
      historicalDone.add(mission.id)
      historicalXp += mission.xp
    }
  }

  const xp = next.xp + historicalXp
  return {
    ...next,
    xp,
    completedMissions: [...historicalDone],
    lastCelebratedLevel: next.lastCelebratedLevel ?? getCompanyLevelForXp(xp).level,
  }
}

export { readState as readCompanyGamificationState }
