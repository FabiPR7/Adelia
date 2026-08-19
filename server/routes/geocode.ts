import { Router } from 'express'

const router = Router()

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
