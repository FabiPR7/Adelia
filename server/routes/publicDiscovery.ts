import { Router, type Request, type Response } from 'express'
import { listPublicDiscoveryRestaurants, mapRestaurantIndexDoc, type DiscoveryQuery } from '../data/restaurantIndex.ts'
import { allowPublicCache } from '../security/httpCache.ts'
import { computeLeague, currentMonthKey, leagueRestaurants, prestigeForLevel, previousMonthKey, trophiesForCompany, type LeagueEntry } from '../league/monthlyLeague.ts'
import { computeCompanyBadges } from '../league/companyBadges.ts'
import { getCompanyLevelForXp } from '../gamification/companyCatalog.ts'
import { adminDb } from '../firebase-admin.ts'
import { mapPublicReview } from './public.ts'
import { pickHighestRatedReview, type FeaturedReviewLike } from '../../src/utils/featuredReviewHighlight.ts'

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

/** ?slugs=a,b — restaurantes por su dirección (los favoritos se guardan así). Máximo 30. */
router.get('/by-slugs', async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.slugs === 'string' ? req.query.slugs : ''
    const slugs = [...new Set(raw.split(',').map((slug) => slug.trim().toLowerCase()).filter((slug) => /^[a-z0-9-]{1,80}$/.test(slug)))].slice(0, 30)
    if (slugs.length === 0) {
      res.json({ restaurants: [] })
      return
    }
    const chunks: string[][] = []
    for (let index = 0; index < slugs.length; index += 10) chunks.push(slugs.slice(index, index + 10))
    const snaps = await Promise.all(chunks.map((chunk) => adminDb.collection('restaurantIndex').where('slug', 'in', chunk).get()))
    const restaurants = snaps
      .flatMap((snap) => snap.docs)
      .map((docSnap) => mapRestaurantIndexDoc(docSnap.id, docSnap.data()))
      .filter((item) => item !== null)
    allowPublicCache(res, 60, 120)
    res.json({ restaurants })
  } catch (error) {
    console.error('discovery by slugs error:', error)
    res.status(500).json({ error: 'No se pudo cargar.' })
  }
})

/**
 * «Últimas valoraciones»: la mejor reseña reciente de unos pocos locales, en UNA
 * llamada. Antes la pantalla pedía las reseñas de cada restaurante por separado
 * (hasta 24 locales × 80 reseñas). Ahora: máximo 8 locales × 6 reseñas, y la
 * respuesta se guarda 10 minutos en memoria y en la CDN.
 */
const FEATURED_REVIEWS_MAX_RESTAURANTS = 8
const FEATURED_REVIEWS_PER_RESTAURANT = 6
const FEATURED_REVIEWS_CACHE_MS = 10 * 60_000
const featuredReviewsCache = new Map<string, { at: number; items: unknown[] }>()

router.get('/featured-reviews', async (req: Request, res: Response) => {
  try {
    const raw = typeof req.query.slugs === 'string' ? req.query.slugs : ''
    const slugs = [...new Set(raw.split(',').map((slug) => slug.trim().toLowerCase()).filter((slug) => /^[a-z0-9-]{1,80}$/.test(slug)))]
      .slice(0, FEATURED_REVIEWS_MAX_RESTAURANTS)
      .sort()
    if (slugs.length === 0) {
      res.json({ items: [] })
      return
    }
    const key = slugs.join(',')
    const hit = featuredReviewsCache.get(key)
    if (hit && Date.now() - hit.at < FEATURED_REVIEWS_CACHE_MS) {
      allowPublicCache(res, 300, 600)
      res.json({ items: hit.items })
      return
    }

    const indexSnap = await adminDb.collection('restaurantIndex').where('slug', 'in', slugs).get()
    const items = (await Promise.all(indexSnap.docs.map(async (docSnap) => {
      const data = docSnap.data()
      const companyId = String(data.companyId ?? docSnap.id)
      if (!companyId || Number(data.reviewCount ?? 0) <= 0) return null
      const reviewsSnap = await adminDb
        .collection('companies')
        .doc(companyId)
        .collection('reviews')
        .orderBy('createdAt', 'desc')
        .limit(FEATURED_REVIEWS_PER_RESTAURANT)
        .get()
      const reviews = reviewsSnap.docs
        .map((reviewDoc) => mapPublicReview(reviewDoc.id, reviewDoc.data()))
        .filter((review): review is NonNullable<typeof review> => review !== null)
      const review = pickHighestRatedReview(reviews as Array<(typeof reviews)[number] & FeaturedReviewLike>)
      return review ? { slug: String(data.slug ?? ''), review } : null
    }))).filter((item) => item !== null)

    featuredReviewsCache.set(key, { at: Date.now(), items })
    if (featuredReviewsCache.size > 200) featuredReviewsCache.delete(featuredReviewsCache.keys().next().value as string)
    allowPublicCache(res, 300, 600)
    res.json({ items })
  } catch (error) {
    console.error('featured reviews error:', error)
    res.status(500).json({ error: 'No se pudo cargar.' })
  }
})

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
const FIRST_WEEK_DAYS = 7

function dayOfMonthInMadrid(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/Madrid' }).format(now))
}

router.get('/league', async (req: Request, res: Response) => {
  try {
    const cityKey = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase().slice(0, 80) : ''
    const load = async (key: string) => {
      const cityBoards = cityKey ? await computeLeague(key, cityKey) : null
      if (cityBoards && cityBoards.some((board) => board.entries.length > 0)) return { boards: cityBoards, scope: 'city' as const }
      return { boards: await computeLeague(key, null), scope: 'spain' as const }
    }
    // La primera semana del mes casi nadie ha puntuado: se enseña el mes anterior, ya cerrado.
    let month = currentMonthKey()
    let inPlay = true
    let { boards, scope } = await load(month)
    if (dayOfMonthInMadrid() <= FIRST_WEEK_DAYS) {
      const previous = previousMonthKey(month)
      const closed = await load(previous)
      if (closed.boards.some((board) => board.entries.length > 0)) {
        month = previous
        inPlay = false
        ;({ boards, scope } = closed)
      }
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
    // «Mejor restaurante del mes»: suma de puntos en las cuatro ligas (1.º = 10 … 10.º = 1).
    const points = new Map<string, { entry: LeagueEntry; points: number; podiums: string[] }>()
    for (const board of boards) {
      for (const entry of board.entries.slice(0, 10)) {
        const current = points.get(entry.companyId) ?? { entry, points: 0, podiums: [] }
        current.points += 11 - entry.rank
        if (entry.rank <= 3) current.podiums.push(entry.rank + '.º en ' + board.name.toLowerCase())
        points.set(entry.companyId, current)
      }
    }
    const best = [...points.values()]
      .sort((a, b) => b.points - a.points || a.entry.name.localeCompare(b.entry.name, 'es'))
      .slice(0, 3)
      .map((item, index) => ({ ...strip(item.entry), rank: index + 1, points: item.points, podiums: item.podiums }))
    allowPublicCache(res, 300)
    res.json({
      month,
      inPlay,
      scope,
      best,
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
