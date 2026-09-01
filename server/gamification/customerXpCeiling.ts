import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'

/**
 * Techo de XP legítima para un cliente, calculado SOLO con datos de confianza
 * del servidor. `/api/customer/gamification/sync` recibe la XP de misiones
 * calculada por el navegador; este techo garantiza que nadie pueda tener más XP
 * de la que lograría un jugador perfecto que completa TODAS las misiones en
 * TODOS los periodos desde que se registró.
 *
 * No es una recomputación exacta de misiones (eso exigiría portar el motor de
 * gamificación con lógica de zona horaria de Madrid). Es una cota superior dura:
 * el navegador puede proponer la XP exacta dentro de este sobre, pero nunca por
 * encima.
 */

// Totales del catálogo local (src/data/gamificationMissions.ts). Se usan como
// fallback si la colección `missionCatalog` está vacía o no se puede leer.
const FALLBACK_WEEKLY_MISSION_XP = 980 // suma de WEEKLY_MISSIONS
const FALLBACK_MONTHLY_MISSION_XP = 2330 // suma de MONTHLY_MISSION_POOL
const FALLBACK_HISTORICAL_MISSION_XP = 30_730 // suma de HISTORICAL_MISSIONS (una vez en la vida)

const DEFAULT_WEEKLY_BONUS_XP = 150
const DEFAULT_CONFIRMED_RESERVATION_XP = 25

// Colchón para redondeos, drift de gameConfig y misiones nuevas.
const CEILING_SLACK_XP = 3000

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

interface MissionXpTotals {
  weekly: number
  monthly: number
  historical: number
}

let totalsCache: { value: MissionXpTotals; at: number } | null = null
const TOTALS_CACHE_MS = 10 * 60 * 1000

async function missionCatalogXpTotals(): Promise<MissionXpTotals> {
  if (totalsCache && Date.now() - totalsCache.at < TOTALS_CACHE_MS) {
    return totalsCache.value
  }

  let value: MissionXpTotals = {
    weekly: FALLBACK_WEEKLY_MISSION_XP,
    monthly: FALLBACK_MONTHLY_MISSION_XP,
    historical: FALLBACK_HISTORICAL_MISSION_XP,
  }

  try {
    const snap = await adminDb.collection(COLLECTIONS.missionCatalog).limit(200).get()
    if (!snap.empty) {
      const totals = { weekly: 0, monthly: 0, historical: 0 }
      for (const doc of snap.docs) {
        const data = doc.data()
        const xp = typeof data.xp === 'number' && Number.isFinite(data.xp) ? Math.max(0, data.xp) : 0
        if (data.cadence === 'weekly') totals.weekly += xp
        else if (data.cadence === 'monthly') totals.monthly += xp
        else if (data.cadence === 'historical') totals.historical += xp
      }
      // Solo confiamos en el catálogo remoto si trae misiones de las tres cadencias.
      if (totals.weekly > 0 && totals.monthly > 0 && totals.historical > 0) {
        value = {
          weekly: Math.max(totals.weekly, FALLBACK_WEEKLY_MISSION_XP),
          monthly: Math.max(totals.monthly, FALLBACK_MONTHLY_MISSION_XP),
          historical: Math.max(totals.historical, FALLBACK_HISTORICAL_MISSION_XP),
        }
      }
    }
  } catch (error) {
    console.error('missionCatalogXpTotals fallback:', error)
  }

  totalsCache = { value, at: Date.now() }
  return value
}

let gameConfigCache: { weeklyBonusXp: number; confirmedReservationXp: number; at: number } | null = null

async function gameConfigXp(): Promise<{ weeklyBonusXp: number; confirmedReservationXp: number }> {
  if (gameConfigCache && Date.now() - gameConfigCache.at < TOTALS_CACHE_MS) {
    return gameConfigCache
  }
  let weeklyBonusXp = DEFAULT_WEEKLY_BONUS_XP
  let confirmedReservationXp = DEFAULT_CONFIRMED_RESERVATION_XP
  try {
    const snap = await adminDb.collection(COLLECTIONS.gameConfig).doc('adelia').get()
    const data = snap.data()
    if (data) {
      if (typeof data.weeklyBonusXp === 'number' && Number.isFinite(data.weeklyBonusXp)) {
        weeklyBonusXp = Math.max(0, data.weeklyBonusXp)
      }
      if (typeof data.confirmedReservationXp === 'number' && Number.isFinite(data.confirmedReservationXp)) {
        confirmedReservationXp = Math.max(0, data.confirmedReservationXp)
      }
    }
  } catch {
    // valores por defecto
  }
  gameConfigCache = { weeklyBonusXp, confirmedReservationXp, at: Date.now() }
  return gameConfigCache
}

/** Cálculo puro del techo (testeable sin Firestore). */
export function xpCeilingFrom(input: {
  visitCount: number
  weeksActive: number
  monthsActive: number
  weeklyMissionXp: number
  monthlyMissionXp: number
  historicalMissionXp: number
  weeklyBonusXp: number
  perVisitXp: number
}): number {
  const weeklyMax = Math.max(0, input.weeklyMissionXp) + Math.max(0, input.weeklyBonusXp)
  const ceiling =
    Math.max(0, input.historicalMissionXp)
    + Math.max(0, input.visitCount) * Math.max(0, input.perVisitXp)
    + Math.max(1, input.weeksActive) * weeklyMax
    + Math.max(1, input.monthsActive) * Math.max(0, input.monthlyMissionXp)
    + CEILING_SLACK_XP
  return Math.max(0, Math.round(ceiling))
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate()
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

async function safeCount(build: () => FirebaseFirestore.Query): Promise<number | null> {
  try {
    const snap = await build().count().get()
    const n = snap.data().count
    return typeof n === 'number' && Number.isFinite(n) ? n : null
  } catch (error) {
    console.error('customerXpCeiling count error:', error)
    return null
  }
}

/**
 * Devuelve el techo de XP para este cliente, o `null` si no se pudo calcular con
 * garantías (en ese caso el llamador NO debe recortar).
 */
export async function computeCustomerXpCeiling(input: {
  uid: string
  email: string
  createdAt: unknown
}): Promise<number | null> {
  if (process.env.GAMIFICATION_XP_CEILING_ENABLED === 'false') {
    return null
  }

  const now = Date.now()
  const created = toDate(input.createdAt)?.getTime() ?? now
  const ageMs = Math.max(0, now - created)
  // +2 de margen en cada periodo por bordes de semana/mes y zona horaria.
  const weeksActive = Math.floor(ageMs / WEEK_MS) + 2
  const monthsActive = Math.floor(ageMs / MONTH_MS) + 2

  const [totals, economy, reservationsByUid, reservationsByEmail, walkIns] = await Promise.all([
    missionCatalogXpTotals(),
    gameConfigXp(),
    safeCount(() => adminDb.collection(COLLECTIONS.reservations).where('customerUid', '==', input.uid)),
    input.email
      ? safeCount(() => adminDb.collection(COLLECTIONS.reservations).where('clientEmail', '==', input.email))
      : Promise.resolve(0),
    safeCount(() =>
      adminDb.collectionGroup('verifiedConsumptions').where('customerUid', '==', input.uid),
    ),
  ])

  // Si falla algún recuento crítico, no recortamos (evita penalizar por un fallo
  // de infraestructura).
  if (reservationsByUid === null || reservationsByEmail === null || walkIns === null) {
    return null
  }

  // Sobreestimamos las visitas (contamos reservas de cualquier estado y sumamos
  // ambas consultas aunque puedan solapar): el techo así solo puede ser generoso.
  const visitCount = reservationsByUid + reservationsByEmail + walkIns

  return xpCeilingFrom({
    visitCount,
    weeksActive,
    monthsActive,
    weeklyMissionXp: totals.weekly,
    monthlyMissionXp: totals.monthly,
    historicalMissionXp: totals.historical,
    weeklyBonusXp: economy.weeklyBonusXp,
    perVisitXp: economy.confirmedReservationXp,
  })
}
