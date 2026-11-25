import { getDemoMenuBoards, getDemoPromotions } from './companyPanelDemo'

/**
 * Métricas de ejemplo para el panel de demostración («Informes → App» y los
 * contadores de QR). Siempre salen igual para el mismo día: no son aleatorias.
 */

function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function daysOfMonth(month: string): string[] {
  const [year, monthIndex] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate()
  const today = new Date().toISOString().slice(0, 10)
  const days: string[] = []
  for (let day = 1; day <= last; day += 1) {
    const key = `${month}-${String(day).padStart(2, '0')}`
    if (key > today) break
    days.push(key)
  }
  return days
}

export function demoMonthMetricsRaw(month: string): Record<string, unknown> {
  const days = daysOfMonth(month)
  const boards = getDemoMenuBoards()
  const promos = getDemoPromotions()

  // Cada mes un poco más que el anterior, como un local que va a más.
  const [yearNumber, monthNumber] = month.split('-').map(Number)
  const growth = Math.pow(1.25, Math.max(0, (yearNumber - 2026) * 12 + monthNumber - 1)) / 9.3

  const daily: Record<string, { views: number; promoViews: number; claims: number; qrScans: number }> = {}
  let views = 0
  let promoViews = 0
  let claims = 0
  let qrScans = 0
  days.forEach((day, index) => {
    const date = new Date(`${day}T12:00:00Z`)
    const weekend = date.getUTCDay() === 5 || date.getUTCDay() === 6 || date.getUTCDay() === 0
    const base = Number(day.replace(/-/g, ''))
    const entry = {
      views: Math.round(((weekend ? 46 : 28) + seeded(base) * 22 + index * 0.4) * growth),
      promoViews: Math.round((weekend ? 14 : 8) + seeded(base + 1) * 8),
      claims: Math.round(seeded(base + 2) * (weekend ? 4 : 2)),
      qrScans: Math.round(((weekend ? 9 : 4) + seeded(base + 3) * (weekend ? 8 : 5)) * growth),
    }
    daily[day] = entry
    views += entry.views
    promoViews += entry.promoViews
    claims += entry.claims
    qrScans += entry.qrScans
  })

  const qrReservas = Math.round(qrScans * 0.44)
  const qrCarta = Math.round(qrScans * 0.37)
  const qrPromo = qrScans - qrReservas - qrCarta

  const menuBoards: Record<string, number> = {}
  const qrMenuBoards: Record<string, number> = {}
  boards.forEach((board, index) => {
    const share = index === 0 ? 0.7 : 0.3 / Math.max(1, boards.length - 1)
    menuBoards[board.id] = Math.round(views * 0.3 * share)
    qrMenuBoards[board.id] = Math.round(qrCarta * share)
  })

  const promoEntries: Record<string, Record<string, number>> = {}
  promos.forEach((promo, index) => {
    const share = [0.45, 0.3, 0.15, 0.1][index] ?? 0.05
    const promoViewsShare = Math.round(promoViews * share)
    promoEntries[promo.id] = {
      views: promoViewsShare,
      claims: Math.round(claims * share),
      reserveClicks: Math.round(promoViewsShare * 0.22),
      reservations: Math.round(promoViewsShare * 0.09),
      qrScans: Math.round(qrPromo * share),
    }
  })

  return {
    month,
    views: {
      profile: views,
      menuZone: Math.round(views * 0.18),
      menuBoardOpens: Math.round(views * 0.3),
      promoZone: Math.round(promoViews * 0.6),
    },
    promo: { views: promoViews, claims, reserveClicks: Math.round(promoViews * 0.22) },
    search: { impressions: views * 5, clicks: Math.round(views * 0.62) },
    favorites: { add: Math.round(days.length * 1.4), remove: Math.round(days.length * 0.2) },
    reservations: {
      fromPromo: Math.round(promoViews * 0.09),
      fromProfile: Math.round(views * 0.08),
      fromQr: Math.round(qrScans * 0.12),
    },
    qr: { total: qrScans, reservas: qrReservas, carta: qrCarta, promo: qrPromo },
    menuBoards,
    qrMenuBoards,
    promos: promoEntries,
    daily,
    uniquesByDay: Object.fromEntries(days.map((day) => [day, Math.round(daily[day].views * 0.7)])),
  }
}
