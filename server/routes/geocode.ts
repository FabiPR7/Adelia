import { Router } from 'express'
import { createRateLimit } from '../middleware/rateLimit.ts'
import { allowPublicCache } from '../security/httpCache.ts'
import { parseAddressSuggestions, type PhotonAddressFeature } from '../utils/addressSuggestions.ts'

const router = Router()

const MAX_SUGGESTIONS = 5
// Centro de España: Photon prioriza resultados cercanos sin excluir el resto.
const BIAS_LAT = '40.4168'
const BIAS_LNG = '-3.7038'
// Se pide al teclear: margen amplio, pero que nadie use la ruta para saturar Photon.
const suggestRateLimit = createRateLimit(60, 60_000)

router.get('/suggest', suggestRateLimit, async (req, res) => {
  try {
    const query = String(req.query.q ?? '').trim().slice(0, 80)

    if (query.length < 3) {
      res.json({ suggestions: [] })
      return
    }

    // La web manda el centro de sus restaurantes; si no llega o no es válido, el de España.
    const biasLat = Number(req.query.lat)
    const biasLng = Number(req.query.lng)
    const hasBias = Number.isFinite(biasLat) && Number.isFinite(biasLng)
      && Math.abs(biasLat) <= 90 && Math.abs(biasLng) <= 180

    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', String(MAX_SUGGESTIONS * 2))
    url.searchParams.set('lat', hasBias ? biasLat.toFixed(4) : BIAS_LAT)
    url.searchParams.set('lon', hasBias ? biasLng.toFixed(4) : BIAS_LNG)

    const response = await fetch(url.toString())

    if (!response.ok) {
      res.status(502).json({ error: 'No se pudieron cargar direcciones.' })
      return
    }

    const payload = (await response.json()) as { features?: PhotonAddressFeature[] }
    allowPublicCache(res, 3600)
    res.json({ suggestions: parseAddressSuggestions(payload.features, MAX_SUGGESTIONS) })
  } catch (error) {
    console.error('Address suggest error:', error)
    res.status(502).json({ error: 'No se pudieron cargar direcciones.' })
  }
})

interface PhotonFeature {
  geometry?: {
    coordinates?: [number, number]
  }
}

router.get('/', async (req, res) => {
  try {
    const query = String(req.query.q ?? '').trim().slice(0, 80)

    if (query.length < 2) {
      res.status(400).json({ error: 'Indica una dirección o ciudad.' })
      return
    }

    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '1')

    const response = await fetch(url.toString())

    if (!response.ok) {
      res.status(502).json({ error: 'No se pudo geolocalizar la dirección.' })
      return
    }

    const payload = (await response.json()) as { features?: PhotonFeature[] }
    const coordinates = payload.features?.[0]?.geometry?.coordinates

    if (!coordinates || coordinates.length < 2) {
      res.json({ lat: null, lng: null })
      return
    }

    const [lng, lat] = coordinates

    res.json({ lat, lng })
  } catch (error) {
    console.error('Geocode error:', error)
    res.status(502).json({ error: 'No se pudo geolocalizar la dirección.' })
  }
})

export default router
