import { Router } from 'express'
import { allowPublicCache } from '../security/httpCache.ts'

const router = Router()

interface PhotonFeature {
  properties?: {
    name?: string
    city?: string
    state?: string
    country?: string
    countrycode?: string
    osm_id?: number
    osm_type?: string
  }
}

function buildCityLabel(name: string, region: string, country: string): string {
  const parts = [name]

  if (region && region !== name) {
    parts.push(region)
  }

  if (country) {
    parts.push(country)
  }

  return parts.join(', ')
}

function parsePhotonFeatures(features: PhotonFeature[] | undefined) {
  const seen = new Set<string>()
  const suggestions: Array<{
    id: string
    name: string
    region: string
    country: string
    label: string
  }> = []

  for (const feature of features ?? []) {
    const properties = feature.properties ?? {}
    const name = (properties.name ?? properties.city ?? '').trim()
    const region = (properties.state ?? '').trim()
    const country = (properties.country ?? '').trim()
    const countryCode = (properties.countrycode ?? '').trim().toUpperCase()

    if (!name) {
      continue
    }

    const dedupeKey = `${name.toLowerCase()}|${countryCode || country.toLowerCase()}`

    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)

    suggestions.push({
      id: `${properties.osm_type ?? 'place'}-${properties.osm_id ?? dedupeKey}`,
      name,
      region,
      country,
      label: buildCityLabel(name, region, country),
    })
  }

  return suggestions
}

router.get('/search', async (req, res) => {
  try {
    const query = String(req.query.q ?? '').trim().slice(0, 80)

    if (query.length < 2) {
      res.json({ suggestions: [] })
      return
    }

    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '10')
    url.searchParams.set('layer', 'city')

    const response = await fetch(url.toString())

    if (!response.ok) {
      res.status(502).json({ error: 'No se pudieron cargar ciudades.' })
      return
    }

    const payload = (await response.json()) as { features?: PhotonFeature[] }
    // Resultados de geocodificación de ciudades: prácticamente estáticos.
    allowPublicCache(res, 3600)
    res.json({ suggestions: parsePhotonFeatures(payload.features) })
  } catch (error) {
    console.error('City search error:', error)
    res.status(502).json({ error: 'No se pudieron cargar ciudades.' })
  }
})

export default router
