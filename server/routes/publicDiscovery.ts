import { Router, type Request, type Response } from 'express'
import { listPublicDiscoveryRestaurants, PUBLIC_DISCOVERY_LIMIT } from '../data/restaurantIndex.ts'
import { allowPublicCache } from '../security/httpCache.ts'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const restaurants = await listPublicDiscoveryRestaurants(PUBLIC_DISCOVERY_LIMIT)
    allowPublicCache(res, 60, 120)
    res.json({ restaurants })
  } catch (error) {
    console.error('Public discovery error:', error)
    res.status(500).json({ error: 'No se pudo cargar el listado de restaurantes.' })
  }
})

export default router
