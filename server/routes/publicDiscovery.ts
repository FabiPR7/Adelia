import { Router, type Request, type Response } from 'express'
import { listPublicDiscoveryRestaurants, type DiscoveryQuery } from '../data/restaurantIndex.ts'
import { allowPublicCache } from '../security/httpCache.ts'

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

export default router
