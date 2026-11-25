import type { CompanyLeagueView, LeagueBoardView, LeagueId } from '../../../services/companyGamification'
import { formatNumber } from '../../../utils/formatNumber'

export type ArenaView = 'arena' | 'standings' | 'challenges' | 'showcase'

export type Tone = 'gold' | 'silver' | 'bronze' | 'diamond' | 'plain'

export function prestigeTone(level: number): Tone {
  if (level >= 9) return 'diamond'
  if (level >= 7) return 'gold'
  if (level >= 4) return 'silver'
  return 'bronze'
}

export function placeTone(rank: number): Tone {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'plain'
}

export function initials(name: string): string {
  const words = name.replace(/\(tú\)/, '').trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

export function monthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const label = new Date(year, mon - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function monthName(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString('es-ES', { month: 'long' })
}

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(year, mon - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Tiempo hasta el cierre del mes (medianoche del día 1, hora de Madrid aproximada con la local). */
export function timeLeftInMonth(now = new Date()): { days: number; hours: number; minutes: number } {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0)
  const ms = Math.max(0, end.getTime() - now.getTime())
  const minutesTotal = Math.floor(ms / 60000)
  return {
    days: Math.floor(minutesTotal / 1440),
    hours: Math.floor((minutesTotal % 1440) / 60),
    minutes: minutesTotal % 60,
  }
}

export function formatGap(board: LeagueBoardView, gap: number): string {
  if (board.id === 'rating') return `${gap.toLocaleString('es-ES', { maximumFractionDigits: 2 })} puntos`
  const rounded = Math.ceil(gap)
  const unit = board.id === 'promotions'
    ? (rounded === 1 ? 'premio' : 'premios')
    : (rounded === 1 ? 'asistencia' : 'asistencias')
  return `${formatNumber(rounded)} ${unit}`
}

/** Tu liga estrella: donde mejor puesto tienes (en empate, la de reservas primero). */
export function bestBoard(boards: LeagueBoardView[]): LeagueBoardView | null {
  const order: LeagueId[] = ['reservations', 'promotions', 'rating', 'rising']
  const ranked = boards
    .filter((board) => board.me)
    .sort((a, b) => (a.me!.rank - b.me!.rank) || order.indexOf(a.id) - order.indexOf(b.id))
  return ranked[0] ?? boards.find((board) => board.id === 'reservations') ?? boards[0] ?? null
}

export function trend(board: LeagueBoardView): { text: string; dir: 'up' | 'down' | 'flat' | 'new' } | null {
  if (!board.me) return null
  if (board.previousRank == null) return { text: 'Nuevo', dir: 'new' }
  const diff = board.previousRank - board.me.rank
  if (diff > 0) return { text: `▲ ${diff}`, dir: 'up' }
  if (diff < 0) return { text: `▼ ${Math.abs(diff)}`, dir: 'down' }
  return { text: '=', dir: 'flat' }
}

/** Meses seguidos en el podio de tu ciudad, contando hacia atrás desde el último cerrado. */
export function podiumStreak(data: CompanyLeagueView): number {
  const months = new Set(
    data.trophies.filter((trophy) => trophy.scope === 'city' && trophy.rank <= 3).map((trophy) => trophy.month),
  )
  let streak = 0
  let month = shiftMonth(data.currentMonth, -1)
  while (months.has(month)) {
    streak += 1
    month = shiftMonth(month, -1)
  }
  return streak
}

export const LEAGUE_SHORT: Record<LeagueId, string> = {
  reservations: 'Más reservas',
  promotions: 'Más promos',
  rating: 'Mejor valorado',
  rising: 'Revelación',
}

export const TIERS = [
  { id: 'bronze', label: 'Bronce', levels: [1, 2, 3], perks: ['Apareces en las ligas', 'Nivel visible en tu ficha'] },
  { id: 'silver', label: 'Plata', levels: [4, 5, 6], perks: ['Sello de nivel en Explorar', 'Más arriba en tu ciudad'] },
  { id: 'gold', label: 'Oro', levels: [7, 8], perks: ['Sección «Casas ilustres» de la app', 'Prioridad en las búsquedas'] },
  { id: 'diamond', label: 'Diamante', levels: [9, 10], perks: ['Los primeros de Explorar', 'Lo máximo en prestigio'] },
] as const
