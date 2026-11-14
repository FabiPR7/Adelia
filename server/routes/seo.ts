import { Router, type Request, type Response } from 'express'
import { adminDb } from '../firebase-admin.ts'
import { APP_URL } from '../email/config.ts'
import { PRODUCTION_CSP } from '../security/csp.ts'

/**
 * SEO de las fichas: la web se monta en el navegador, así que Google y quien
 * comparte un enlace por WhatsApp veían la misma cabecera en todas. Aquí se
 * sirve el mismo index.html con título, descripción, imagen, canónica y datos
 * estructurados (schema.org/Restaurant) de cada local. El resto de la página
 * no cambia: la web arranca igual que siempre.
 */
const router = Router()

const TEMPLATE_CACHE_MS = 10 * 60_000
let templateCache: { html: string; at: number } | null = null

async function loadTemplate(): Promise<string> {
  if (templateCache && Date.now() - templateCache.at < TEMPLATE_CACHE_MS) {
    return templateCache.html
  }
  const response = await fetch(`${APP_URL}/index.html`, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(6000) })
  if (!response.ok) {
    throw new Error(`index.html respondió ${response.status}`)
  }
  const html = await response.text()
  templateCache = { html, at: Date.now() }
  return html
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface SeoRestaurant {
  name: string
  slug: string
  location: string
  municipality: string
  country: string
  postalCode: string
  photoUrl: string
  latitude: number | null
  longitude: number | null
  priceRange: string
  venueTypes: string[]
  characteristics: string[]
  reviewCount: number
  reviewRatingSum: number
}

function readRestaurant(data: FirebaseFirestore.DocumentData): SeoRestaurant {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  return {
    name: text(data.name),
    slug: text(data.slug),
    location: text(data.location),
    municipality: text(data.municipality),
    country: text(data.country),
    postalCode: text(data.postalCode),
    photoUrl: text(data.photoUrl).replace(/^http:\/\//, 'https://'),
    latitude: num(data.latitude),
    longitude: num(data.longitude),
    priceRange: text(data.priceRange),
    venueTypes: list(data.venueTypes),
    characteristics: list(data.characteristics),
    reviewCount: num(data.reviewCount) ?? 0,
    reviewRatingSum: num(data.reviewRatingSum) ?? 0,
  }
}

/** Cabecera de una ficha (o de su carta) con los datos del restaurante. */
export function buildRestaurantHead(restaurant: SeoRestaurant, kind: 'ficha' | 'carta'): {
  title: string
  description: string
  url: string
  image: string
  jsonLd: Record<string, unknown>
} {
  const place = [restaurant.municipality, restaurant.country].filter(Boolean).join(', ')
  const kinds = [...restaurant.venueTypes, ...restaurant.characteristics].slice(0, 3).join(', ')
  const rating = restaurant.reviewCount > 0 ? restaurant.reviewRatingSum / restaurant.reviewCount : null
  const url = `${APP_URL}/reservar/${encodeURIComponent(restaurant.slug)}${kind === 'carta' ? '/carta' : ''}`
  const title = kind === 'carta'
    ? `Carta de ${restaurant.name}${place ? ` (${restaurant.municipality})` : ''} · Adelia Reservas`
    : `${restaurant.name}${restaurant.municipality ? ` en ${restaurant.municipality}` : ''} · Reserva mesa · Adelia`
  const description = (
    kind === 'carta'
      ? `Mira la carta de ${restaurant.name}${place ? ` en ${place}` : ''} y reserva mesa con Adelia.`
      : `Reserva mesa en ${restaurant.name}${place ? `, ${place}` : ''}.${kinds ? ` ${kinds}.` : ''}${
        rating ? ` Valoración ${rating.toFixed(1)}/5 (${restaurant.reviewCount} opiniones).` : ''
      } Promociones y premios por ir.`
  ).slice(0, 300)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    url: `${APP_URL}/reservar/${encodeURIComponent(restaurant.slug)}`,
    ...(restaurant.photoUrl ? { image: restaurant.photoUrl } : {}),
    ...(restaurant.priceRange ? { priceRange: restaurant.priceRange } : {}),
    ...(restaurant.venueTypes.length ? { servesCuisine: restaurant.venueTypes.slice(0, 5) } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(restaurant.location ? { streetAddress: restaurant.location } : {}),
      ...(restaurant.municipality ? { addressLocality: restaurant.municipality } : {}),
      ...(restaurant.postalCode ? { postalCode: restaurant.postalCode } : {}),
      addressCountry: restaurant.country || 'ES',
    },
    ...(restaurant.latitude != null && restaurant.longitude != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: restaurant.latitude, longitude: restaurant.longitude } }
      : {}),
    ...(rating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(rating.toFixed(1)),
            reviewCount: restaurant.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    acceptsReservations: true,
  }

  return {
    title,
    description,
    url,
    image: restaurant.photoUrl || `${APP_URL}/adelia-logo.png`,
    jsonLd,
  }
}

/** Sustituye la cabecera genérica del index.html por la del restaurante. */
export function injectHead(template: string, head: ReturnType<typeof buildRestaurantHead>): string {
  const title = escapeHtml(head.title)
  const description = escapeHtml(head.description)
  const url = escapeHtml(head.url)
  const image = escapeHtml(head.image)
  // `<` escapado: el JSON va dentro de un <script> y no puede cerrarlo.
  const jsonLd = JSON.stringify(head.jsonLd).replace(/</g, '\\u003c')
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${image}$2`)
  const extra = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n    ')
  html = html.replace('</head>', `    ${extra}\n  </head>`)
  return html
}

async function findRestaurantBySlug(slug: string): Promise<SeoRestaurant | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return null
  }
  const snap = await adminDb.collection('restaurantIndex').where('slug', '==', slug).limit(1).get()
  const data = snap.docs[0]?.data()
  if (!data || data.deactivated === true) {
    return null
  }
  const restaurant = readRestaurant(data)
  return restaurant.name ? restaurant : null
}

async function serveRestaurantPage(req: Request, res: Response, kind: 'ficha' | 'carta') {
  try {
    const template = await loadTemplate()
    const restaurant = await findRestaurantBySlug(String(req.params.slug ?? '').toLowerCase())
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // Es una página de la web, no de la API: con la CSP de la API (default-src 'none')
    // el navegador bloqueaba scripts y estilos y la ficha salía en blanco.
    res.setHeader('Content-Security-Policy', PRODUCTION_CSP)
    if (!restaurant) {
      // La web enseña su propio "no encontrado"; a Google le decimos 404.
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
      res.status(404).send(template)
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600')
    res.send(injectHead(template, buildRestaurantHead(restaurant, kind)))
  } catch (error) {
    console.error('SEO page error:', error)
    res.redirect(302, `/?r=${encodeURIComponent(String(req.params.slug ?? ''))}`)
  }
}

router.get('/reservar/:slug', (req, res) => void serveRestaurantPage(req, res, 'ficha'))
router.get('/reservar/:slug/carta', (req, res) => void serveRestaurantPage(req, res, 'carta'))

/** Mapa del sitio con todas las fichas (las páginas fijas están en /sitemap.xml). */
router.get('/sitemap-restaurantes.xml', async (_req: Request, res: Response) => {
  try {
    const snap = await adminDb
      .collection('restaurantIndex')
      .where('hasProfile', '==', true)
      .select('slug', 'updatedAt', 'deactivated')
      .limit(5000)
      .get()
    const urls = snap.docs
      .map((docSnap) => docSnap.data())
      .filter((data) => typeof data.slug === 'string' && data.slug && data.deactivated !== true)
      .map((data) => {
        const lastmod = typeof data.updatedAt?.toDate === 'function'
          ? `<lastmod>${data.updatedAt.toDate().toISOString().slice(0, 10)}</lastmod>`
          : ''
        const loc = `${APP_URL}/reservar/${encodeURIComponent(data.slug as string)}`
        return `  <url><loc>${escapeHtml(loc)}</loc>${lastmod}</url>\n  <url><loc>${escapeHtml(`${loc}/carta`)}</loc></url>`
      })
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
  } catch (error) {
    console.error('Sitemap error:', error)
    res.status(500).send('')
  }
})

export default router
