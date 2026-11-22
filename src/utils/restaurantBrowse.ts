// Pasar de una ficha de restaurante a la siguiente deslizando (igual en web y app).
// La lista de «vecinos» depende de dónde se abrió la ficha: el carrusel en su orden,
// el mapa del más cercano al tocado al más lejano, un tipo de comida, etc.

/** Como mucho se llevan tantos vecinos (alrededor del que se abre). */
export const BROWSE_MAX = 40

interface BrowseItem {
  slug: string
}

interface GeoBrowseItem extends BrowseItem {
  latitude: number | null
  longitude: number | null
}

function normalize(slug: string): string {
  return slug.trim().toLowerCase()
}

/** Lista en el orden de la sección, sin repetidos y recortada alrededor del abierto. */
export function browseListFrom(list: readonly BrowseItem[], openedSlug: string): string[] {
  const seen = new Set<string>()
  const slugs: string[] = []
  for (const item of list) {
    const slug = normalize(item.slug)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    slugs.push(slug)
  }
  const index = slugs.indexOf(normalize(openedSlug))
  if (slugs.length <= BROWSE_MAX || index < 0) return slugs.slice(0, BROWSE_MAX)
  const start = Math.min(Math.max(0, index - Math.floor(BROWSE_MAX / 2)), slugs.length - BROWSE_MAX)
  return slugs.slice(start, start + BROWSE_MAX)
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/** Mapa: el tocado primero y luego del más cercano a él al más lejano. */
export function nearestBrowseList(list: readonly GeoBrowseItem[], opened: GeoBrowseItem): string[] {
  if (opened.latitude == null || opened.longitude == null) return browseListFrom(list, opened.slug)
  const origin = { lat: opened.latitude, lng: opened.longitude }
  const sorted = list
    .filter((item) => item.latitude != null && item.longitude != null)
    .map((item) => ({ item, km: distanceKm(origin, { lat: item.latitude as number, lng: item.longitude as number }) }))
    .sort((a, b) => a.km - b.km)
    .map(({ item }) => item)
  return browseListFrom([opened, ...sorted], opened.slug)
}

export interface BrowseNeighbors {
  prev: string | null
  next: string | null
  /** Posición (empieza en 1) y total, para «3 de 12». */
  position: number
  total: number
}

/** Anterior y siguiente del restaurante abierto dentro de su lista. */
export function browseNeighbors(browse: readonly string[] | null | undefined, slug: string): BrowseNeighbors | null {
  if (!browse || browse.length < 2) return null
  const index = browse.indexOf(normalize(slug))
  if (index < 0) return null
  return {
    prev: index > 0 ? browse[index - 1] : null,
    next: index < browse.length - 1 ? browse[index + 1] : null,
    position: index + 1,
    total: browse.length,
  }
}

/** Solo se aceptan listas razonables (vienen de la navegación). */
export function sanitizeBrowse(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const list = value
    .filter((item): item is string => typeof item === 'string' && /^[a-z0-9-]{1,80}$/.test(item))
    .slice(0, BROWSE_MAX)
  return list.length >= 2 ? list : undefined
}
