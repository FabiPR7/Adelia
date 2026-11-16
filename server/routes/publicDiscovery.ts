import { Router, type Request, type Response } from 'express'
import { listPublicDiscoveryRestaurants, type DiscoveryQuery } from '../data/restaurantIndex.ts'
import { allowPublicCache } from '../security/httpCache.ts'
import { computeLeague, currentMonthKey, leagueRestaurants, prestigeForLevel, trophiesForCompany, type LeagueEntry } from '../league/monthlyLeague.ts'
import { computeCompanyBadges } from '../league/companyBadges.ts'
import { getCompanyLevelForXp } from '../gamification/companyCatalog.ts'
import { adminDb } from '../firebase-admin.ts'

const router = Router()

const DEFAULT_RADIUS_KM = 25
const MAX_RADIUS_KM = 60

function finite(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * ?lat=&lng=&radiusKm=  → cerca de un punto
 * ?city=                → una ciudad
 * ?cursor=              → siguiente página de los más valorados
 * Las coordenadas se redondean a ~1 km: más aciertos de caché y menos precisión
 * guardada de dónde está el visitante.
 */
export function parseDiscoveryQuery(query: Request['query']): DiscoveryQuery {
  const lat = finite(query.lat)
  const lng = finite(query.lng)
  if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    const radius = finite(query.radiusKm) ?? DEFAULT_RADIUS_KM
    return {
      near: {
        lat: Math.round(lat * 100) / 100,
        lng: Math.round(lng * 100) / 100,
        radiusKm: Math.min(MAX_RADIUS_KM, Math.max(1, radius)),
      },
    }
  }
  if (typeof query.city === 'string' && query.city.trim()) {
    return { city: query.city.trim().slice(0, 80) }
  }
  return typeof query.cursor === 'string' ? { cursor: query.cursor.slice(0, 128) } : {}
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = await listPublicDiscoveryRestaurants(parseDiscoveryQuery(req.query))
    allowPublicCache(res, 60, 120)
    res.json(page)
  } catch (error) {
    console.error('Public discovery error:', error)
    res.status(500).json({ error: 'No se pudo cargar el listado de restaurantes.' })
  }
})


/**
 * «Lo mejor del mes» para los clientes: podio de cada liga en su ciudad (o en
 * España si en su ciudad aún no hay datos), la revelación y las casas ilustres.
 */
router.get('/league', async (req: Request, res: Response) => {
  try {
    const month = currentMonthKey()
    const cityKey = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase().slice(0, 80) : ''
    let boards = cityKey ? await computeLeague(month, cityKey) : null
    let scope: 'city' | 'spain' = 'city'
    if (!boards || boards.every((board) => board.entries.length === 0)) {
      boards = await computeLeague(month, null)
      scope = 'spain'
    }
    const strip = (entry: LeagueEntry) => ({
      companyId: entry.companyId, name: entry.name, slug: entry.slug, municipality: entry.municipality,
      photoUrl: entry.photoUrl, level: entry.level, levelTitle: entry.levelTitle,
      prestige: prestigeForLevel(entry.level), rank: entry.rank, display: entry.display,
    })
    const all = await leagueRestaurants(month, scope === 'city' ? cityKey : null)
    const illustrious = all
      .filter((entry) => entry.level >= 7)
      .sort((a, b) => b.level - a.level)
      .slice(0, 8)
      .map((restaurant) => ({ ...strip({ ...restaurant, rank: 0, score: 0, display: '', noShows: 0 }) }))
    allowPublicCache(res, 300)
    res.json({
      month,
      scope,
      boards: boards.map((board) => ({ id: board.id, name: board.name, unit: board.unit, podium: board.entries.slice(0, 3).map(strip) })),
      illustrious,
    })
  } catch (error) {
    console.error('public league error:', error)
    res.status(500).json({ error: 'No se pudo cargar.' })
  }
})


/** Prestigio de un local para su ficha: nivel, rango, trofeos de la liga e insignias conseguidas. */
router.get('/prestige/:slug', async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug ?? '').toLowerCase()
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
      res.status(400).json({ error: 'Ficha no válida.' })
      return
    }
    const indexSnap = await adminDb.collection('restaurantIndex').where('slug', '==', slug).limit(1).get()
    const companyId = String(indexSnap.docs[0]?.data().companyId ?? indexSnap.docs[0]?.id ?? '')
    if (!companyId) {
      res.status(404).json({ error: 'No encontrado.' })
      return
    }
    const [statsSnap, trophies, badges] = await Promise.all([
      adminDb.collection('companyGamification').doc(companyId).get(),
      trophiesForCompany(companyId).catch(() => []),
      computeCompanyBadges(companyId).catch(() => []),
    ])
    const level = getCompanyLevelForXp(Number(statsSnap.data()?.xp) || 0)
    allowPublicCache(res, 600)
    res.json({
      level: level.level,
      levelTitle: level.title,
      prestige: prestigeForLevel(level.level),
      trophies: trophies.filter((trophy) => trophy.scope === 'city').slice(0, 6),
      badges: badges.filter((badge) => badge.tier).map((badge) => ({ id: badge.id, name: badge.name, tier: badge.tier })),
    })
  } catch (error) {
    console.error('public prestige error:', error)
    res.status(500).json({ error: 'No se pudo cargar.' })
  }
})

export default router
