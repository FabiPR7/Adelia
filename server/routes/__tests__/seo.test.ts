import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase-admin.ts', () => ({ adminDb: {} }))
vi.mock('../../email/config.ts', () => ({ APP_URL: 'https://adeliareservas.com' }))

import { buildRestaurantHead, injectHead, type SeoRestaurant } from '../seo.ts'

const TEMPLATE = `<html><head>
    <meta name="description" content="genérica" />
    <meta property="og:title" content="Adelia Reservas" />
    <meta property="og:description" content="genérica" />
    <meta property="og:image" content="https://adeliareservas.com/adelia-logo.png" />
    <title>Adelia Reservas</title>
  </head><body><div id="root"></div></body></html>`

const restaurant: SeoRestaurant = {
  name: 'Bar La Estación',
  slug: 'bar-la-estacion',
  location: 'Calle Mayor 1',
  municipality: 'Logroño',
  country: 'España',
  postalCode: '26001',
  photoUrl: 'https://res.cloudinary.com/x/foto.jpg',
  latitude: 42.46,
  longitude: -2.44,
  priceRange: '€€',
  venueTypes: ['Tapas'],
  characteristics: [],
  reviewCount: 4,
  reviewRatingSum: 18,
}

describe('cabecera SEO de una ficha', () => {
  it('pone nombre, ciudad, canónica y datos estructurados', () => {
    const html = injectHead(TEMPLATE, buildRestaurantHead(restaurant, 'ficha'))
    expect(html).toContain('<title>Bar La Estación en Logroño · Reserva mesa · Adelia</title>')
    expect(html).toContain('<link rel="canonical" href="https://adeliareservas.com/reservar/bar-la-estacion" />')
    expect(html).toContain('"@type":"Restaurant"')
    expect(html).toContain('"ratingValue":4.5')
    expect(html).toContain('content="https://res.cloudinary.com/x/foto.jpg"')
    expect(html).not.toContain('content="genérica"')
  })

  it('la carta tiene su propia canónica y título', () => {
    const html = injectHead(TEMPLATE, buildRestaurantHead(restaurant, 'carta'))
    expect(html).toContain('/reservar/bar-la-estacion/carta"')
    expect(html).toContain('<title>Carta de Bar La Estación (Logroño) · Adelia Reservas</title>')
  })

  it('sin opiniones no inventa valoración', () => {
    const head = buildRestaurantHead({ ...restaurant, reviewCount: 0, reviewRatingSum: 0 }, 'ficha')
    expect(head.jsonLd.aggregateRating).toBeUndefined()
  })

  it('un nombre malicioso no puede inyectar código', () => {
    const evil = { ...restaurant, name: '</script><script>alert(1)</script>"><img src=x onerror=alert(1)>' }
    const html = injectHead(TEMPLATE, buildRestaurantHead(evil, 'ficha'))
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img src=x')
    expect(html.match(/<script/g)?.length).toBe(1)
  })
})
