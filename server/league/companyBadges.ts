/**
 * Insignias de prestigio de los restaurantes, cada una con bronce, plata y oro.
 * Se calculan con su historial real (no se guardan): así nunca se desincronizan.
 */
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { currentMonthKey, closedMonthResults } from './monthlyLeague.ts'

export type BadgeTier = 'bronze' | 'silver' | 'gold'

export interface CompanyBadge {
  id: string
  name: string
  description: string
  /** Lo que se mide: «asistencias en un mes», «reseñas seguidas»… */
  unit: string
  thresholds: [number, number, number]
  value: number
  tier: BadgeTier | null
  /** Siguiente meta (null si ya tiene oro). */
  next: number | null
}

const DEFS: Array<Omit<CompanyBadge, 'value' | 'tier' | 'next'>> = [
  { id: 'centenario', name: 'Centenario', description: 'Asistencias en un solo mes', unit: 'asistencias en un mes', thresholds: [50, 100, 200] },
  { id: 'impecable', name: 'Impecable', description: 'Reseñas seguidas de 4★ o más', unit: 'reseñas seguidas', thresholds: [10, 30, 60] },
  { id: 'iman', name: 'Imán de clientes', description: 'Clientes nuevos en un solo mes', unit: 'clientes nuevos en un mes', thresholds: [20, 50, 100] },
  { id: 'sin_faltas', name: 'Sin faltas', description: 'Meses seguidos sin ningún «no vino» (con 10 asistencias o más)', unit: 'meses seguidos', thresholds: [3, 6, 12] },
  { id: 'podio', name: 'Rey del podio', description: 'Meses seguidos en el Top 3 de tu ciudad', unit: 'meses seguidos', thresholds: [2, 3, 6] },
  { id: 'leyenda', name: 'Leyenda local', description: 'Veces 1.º de tu ciudad en una liga', unit: 'victorias', thresholds: [1, 3, 6] },
  { id: 'respuesta', name: 'Respuesta rápida', description: 'Reseñas respondidas en menos de 48 h', unit: 'respuestas rápidas', thresholds: [10, 50, 150] },
  { id: 'favorito', name: 'Favorito', description: 'Clientes que te guardan en favoritos', unit: 'clientes', thresholds: [25, 100, 300] },
]

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis()
  if (value && typeof value === 'object' && 'toMillis' in value) return (value as { toMillis: () => number }).toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime()
    return Number.isNaN(ms) ? 0 : ms
  }
  return 0
}

function monthOf(ms: number): string {
  return currentMonthKey(new Date(ms))
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function tierFor(value: number, thresholds: [number, number, number]): { tier: BadgeTier | null; next: number | null } {
  if (value >= thresholds[2]) return { tier: 'gold', next: null }
  if (value >= thresholds[1]) return { tier: 'silver', next: thresholds[2] }
  if (value >= thresholds[0]) return { tier: 'bronze', next: thresholds[1] }
  return { tier: null, next: thresholds[0] }
}

export async function computeCompanyBadges(companyId: string): Promise<CompanyBadge[]> {
  const since = Timestamp.fromMillis(Date.now() - 400 * 24 * 60 * 60 * 1000)
  const companyRef = adminDb.collection('companies').doc(companyId)
  const [reservationsSnap, reviewsSnap, companySnap] = await Promise.all([
    adminDb.collection('reservations').where('companyId', '==', companyId).limit(8000).get(),
    companyRef.collection('reviews').limit(2000).get(),
    companyRef.get(),
  ])
  const slug = String(companySnap.data()?.slug ?? '')

  // Asistencias y faltas por mes, y clientes nuevos (primera visita) por mes.
  const visitsByMonth = new Map<string, number>()
  const noShowsByMonth = new Map<string, number>()
  const firstVisit = new Map<string, number>()
  for (const doc of reservationsSnap.docs) {
    const data = doc.data()
    const ms = toMillis(data.startTime)
    if (!ms) continue
    const month = monthOf(ms)
    if (data.noShow === true) {
      noShowsByMonth.set(month, (noShowsByMonth.get(month) ?? 0) + 1)
      continue
    }
    if (data.status !== 'confirmed') continue
    visitsByMonth.set(month, (visitsByMonth.get(month) ?? 0) + 1)
    const who = String(data.customerUid || data.clientEmail || '').toLowerCase()
    if (who && (!firstVisit.has(who) || ms < (firstVisit.get(who) ?? Infinity))) firstVisit.set(who, ms)
  }
  const newByMonth = new Map<string, number>()
  for (const ms of firstVisit.values()) {
    if (ms < since.toMillis()) continue
    const month = monthOf(ms)
    newByMonth.set(month, (newByMonth.get(month) ?? 0) + 1)
  }

  // Meses cerrados seguidos sin faltas (con actividad mínima), del más reciente hacia atrás.
  const current = currentMonthKey()
  let cleanStreak = 0
  for (let i = 1; i <= 24; i += 1) {
    const month = shiftMonth(current, -i)
    if ((visitsByMonth.get(month) ?? 0) < 10 || (noShowsByMonth.get(month) ?? 0) > 0) break
    cleanStreak += 1
  }

  // Reseñas: racha actual de 4★ o más y respuestas en menos de 48 h.
  const reviews = reviewsSnap.docs
    .map((doc) => doc.data())
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
  let goodStreak = 0
  for (const review of reviews) {
    if (Number(review.rating) >= 4) goodStreak += 1
    else break
  }
  const fastReplies = reviews.filter((review) => {
    const reply = review.ownerReply as Record<string, unknown> | undefined
    if (!reply) return false
    const delay = toMillis(reply.createdAt) - toMillis(review.createdAt)
    return delay >= 0 && delay <= 48 * 60 * 60 * 1000
  }).length

  // Trofeos de la liga en su ciudad (meses cerrados guardados).
  let podiumStreak = 0
  let streakOpen = true
  let wins = 0
  for (let i = 1; i <= 12; i += 1) {
    const result = await closedMonthResults(shiftMonth(current, -i)).catch(() => null)
    const byCity = (result?.byCity ?? {}) as Record<string, Record<string, Array<{ companyId: string; rank: number }>>>
    let onPodium = false
    for (const leagues of Object.values(byCity)) {
      for (const rows of Object.values(leagues)) {
        for (const row of rows) {
          if (row.companyId !== companyId) continue
          onPodium = true
          if (row.rank === 1) wins += 1
        }
      }
    }
    if (streakOpen && onPodium) podiumStreak += 1
    else streakOpen = false
  }

  const favorites = slug
    ? (await adminDb.collection('users').where('favoriteSlugs', 'array-contains', slug).count().get()).data().count
    : 0

  const values: Record<string, number> = {
    centenario: Math.max(0, ...visitsByMonth.values()),
    impecable: goodStreak,
    iman: Math.max(0, ...newByMonth.values()),
    sin_faltas: cleanStreak,
    podio: podiumStreak,
    leyenda: wins,
    respuesta: fastReplies,
    favorito: favorites,
  }

  return DEFS.map((def) => {
    const value = values[def.id] ?? 0
    return { ...def, value, ...tierFor(value, def.thresholds) }
  })
}
