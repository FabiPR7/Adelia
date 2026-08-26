export const COMPANY_VENUE_TYPES = [
  { id: 'restaurant', label: 'Restaurante', icon: 'restaurant' },
  { id: 'bar', label: 'Bar', icon: 'bar' },
  { id: 'cafe', label: 'Cafetería', icon: 'cafe' },
  { id: 'tapas_bar', label: 'Bar de tapas', icon: 'tapas' },
  { id: 'gastrobar', label: 'Gastrobar', icon: 'restaurant' },
  { id: 'bistro', label: 'Bistró', icon: 'restaurant' },
  { id: 'pub', label: 'Pub', icon: 'bar' },
  { id: 'wine_bar', label: 'Wine bar', icon: 'wine' },
  { id: 'cocktail_bar', label: 'Copas', icon: 'cocktail' },
  { id: 'bakery', label: 'Pastelería', icon: 'bakery' },
  { id: 'ice_cream', label: 'Heladería', icon: 'ice_cream' },
  { id: 'food_truck', label: 'Food truck', icon: 'truck' },
  { id: 'cerveceria', label: 'Cervecería', icon: 'bar' },
  { id: 'vermuteria', label: 'Vermutería', icon: 'wine' },
  { id: 'asador', label: 'Asador', icon: 'restaurant' },
  { id: 'hotel', label: 'Hotel / restaurante', icon: 'hotel' },
] as const

export const COMPANY_AMENITIES = [
  { id: 'parking', label: 'Parking', icon: 'parking' },
  { id: 'wifi', label: 'WiFi', icon: 'wifi' },
  { id: 'card', label: 'Tarjeta', icon: 'card' },
  { id: 'cash', label: 'Efectivo', icon: 'cash' },
  { id: 'bizum', label: 'Bizum', icon: 'phone_pay' },
  { id: 'restrooms', label: 'Baños', icon: 'restrooms' },
  { id: 'accessible', label: 'Accesible', icon: 'accessible' },
  { id: 'terrace', label: 'Terraza', icon: 'terrace' },
  { id: 'pet_friendly', label: 'Pet friendly', icon: 'pet' },
  { id: 'air_conditioning', label: 'Aire acondicionado', icon: 'snowflake' },
  { id: 'heating', label: 'Calefacción', icon: 'heat' },
  { id: 'outdoor_heaters', label: 'Estufas en terraza', icon: 'heat' },
  { id: 'kids_friendly', label: 'Niños', icon: 'kids' },
  { id: 'high_chairs', label: 'Tronas', icon: 'chair' },
  { id: 'group_tables', label: 'Grupos', icon: 'groups' },
  { id: 'private_rooms', label: 'Sala privada', icon: 'door' },
  { id: 'live_music', label: 'Música en vivo', icon: 'music' },
  { id: 'tv', label: 'TV / deportes', icon: 'tv' },
  { id: 'takeaway', label: 'Para llevar', icon: 'bag' },
  { id: 'delivery', label: 'Delivery', icon: 'bike' },
  { id: 'bike_parking', label: 'Aparcabicis', icon: 'bike' },
  { id: 'garden', label: 'Jardín', icon: 'plant' },
  { id: 'rooftop', label: 'Azotea', icon: 'rooftop' },
  { id: 'views', label: 'Vistas', icon: 'views' },
  { id: 'charging', label: 'Carga de móviles', icon: 'bolt' },
  { id: 'vegetarian', label: 'Vegetariano', icon: 'leaf' },
  { id: 'vegan', label: 'Vegano', icon: 'leaf' },
  { id: 'gluten_free', label: 'Sin gluten', icon: 'wheat' },
  { id: 'lactose_free', label: 'Sin lactosa', icon: 'wheat' },
  { id: 'halal', label: 'Halal', icon: 'leaf' },
  { id: 'work_friendly', label: 'Para trabajar', icon: 'bolt' },
  { id: 'smoking_area', label: 'Zona fumadores', icon: 'heat' },
] as const

export const COMPANY_PRICE_RANGES = [
  { id: '1', label: '€', hint: 'Económico' },
  { id: '2', label: '€€', hint: 'Moderado' },
  { id: '3', label: '€€€', hint: 'Alto' },
  { id: '4', label: '€€€€', hint: 'Lujo' },
] as const

export type CompanyVenueTypeId = (typeof COMPANY_VENUE_TYPES)[number]['id']
export type CompanyAmenityId = (typeof COMPANY_AMENITIES)[number]['id']
export type CompanyPriceRange = '' | (typeof COMPANY_PRICE_RANGES)[number]['id']
export type CompanyFacilityIcon = (typeof COMPANY_AMENITIES)[number]['icon'] | (typeof COMPANY_VENUE_TYPES)[number]['icon']

export const MAX_COMPANY_VENUE_TYPES = 3

export const COMPANY_VENUE_TYPE_IDS = COMPANY_VENUE_TYPES.map((item) => item.id)
export const COMPANY_AMENITY_IDS = COMPANY_AMENITIES.map((item) => item.id)

const VENUE_TYPE_SET = new Set<string>(COMPANY_VENUE_TYPE_IDS)
const AMENITY_SET = new Set<string>(COMPANY_AMENITY_IDS)
const PRICE_RANGE_SET = new Set<string>(COMPANY_PRICE_RANGES.map((item) => item.id))

const CHARACTERISTIC_TO_AMENITY: Record<string, CompanyAmenityId> = {
  Parking: 'parking',
  Accesible: 'accessible',
  Terraza: 'terrace',
  'Pet friendly': 'pet_friendly',
  Vistas: 'views',
  'Música en vivo': 'live_music',
  'Comida para llevar': 'takeaway',
  Delivery: 'delivery',
  Rooftop: 'rooftop',
  Jardín: 'garden',
  Familiar: 'kids_friendly',
  Grupos: 'group_tables',
  Vegano: 'vegan',
  Vegetariano: 'vegetarian',
  'Sin gluten': 'gluten_free',
}

const CHARACTERISTIC_TO_VENUE: Record<string, CompanyVenueTypeId> = {
  Cafetería: 'cafe',
  Taberna: 'tapas_bar',
  Gastropub: 'gastrobar',
  Gastrobar: 'gastrobar',
  'Wine bar': 'wine_bar',
  'Food truck': 'food_truck',
  Heladería: 'ice_cream',
  Pastelería: 'bakery',
  Churrería: 'bakery',
  Bistró: 'bistro',
  Copas: 'cocktail_bar',
  'Copas y pinchos': 'tapas_bar',
}

export function sanitizeCompanyIdList(
  input: unknown,
  allowed: Set<string>,
  maxItems: number,
): string[] {
  if (!Array.isArray(input)) {
    return []
  }

  return [...new Set(input.filter((item): item is string => typeof item === 'string' && allowed.has(item)))].slice(
    0,
    maxItems,
  )
}

export function sanitizeCompanyVenueTypes(input: unknown): string[] {
  return sanitizeCompanyIdList(input, VENUE_TYPE_SET, MAX_COMPANY_VENUE_TYPES)
}

export function sanitizeCompanyAmenities(input: unknown): string[] {
  return sanitizeCompanyIdList(input, AMENITY_SET, COMPANY_AMENITY_IDS.length)
}

export function sanitizeCompanyPriceRange(input: unknown): CompanyPriceRange {
  return typeof input === 'string' && PRICE_RANGE_SET.has(input) ? (input as CompanyPriceRange) : ''
}

export function migrateAmenitiesFromCharacteristics(characteristics: string[]): string[] {
  return sanitizeCompanyAmenities(
    characteristics.map((item) => CHARACTERISTIC_TO_AMENITY[item]).filter(Boolean),
  )
}

export function migrateVenueTypesFromCharacteristics(characteristics: string[]): string[] {
  return sanitizeCompanyVenueTypes(
    characteristics.map((item) => CHARACTERISTIC_TO_VENUE[item]).filter(Boolean),
  )
}

export function stripMigratedCharacteristics(characteristics: string[]): string[] {
  return characteristics.filter(
    (item) => !CHARACTERISTIC_TO_AMENITY[item] && !CHARACTERISTIC_TO_VENUE[item],
  )
}

export function getVenueTypeLabel(id: string): string {
  return COMPANY_VENUE_TYPES.find((item) => item.id === id)?.label ?? id
}

export type DiscoveryVenueKind = 'bar' | 'restaurant'

const BAR_VENUE_TYPE_IDS = new Set<string>([
  'bar',
  'tapas_bar',
  'pub',
  'wine_bar',
  'cocktail_bar',
  'cerveceria',
  'vermuteria',
])

const RESTAURANT_VENUE_TYPE_IDS = new Set<string>([
  'restaurant',
  'gastrobar',
  'bistro',
  'asador',
  'hotel',
])

export function venueTypesIncludeKind(
  venueTypes: string[],
  kind: DiscoveryVenueKind,
): boolean {
  const allowed = kind === 'bar' ? BAR_VENUE_TYPE_IDS : RESTAURANT_VENUE_TYPE_IDS
  return venueTypes.some((id) => allowed.has(id))
}

export function getAmenityLabel(id: string): string {
  return COMPANY_AMENITIES.find((item) => item.id === id)?.label ?? id
}

export function getAmenityIcon(id: string): CompanyFacilityIcon {
  return COMPANY_AMENITIES.find((item) => item.id === id)?.icon ?? 'parking'
}

const AMENITY_TONES: Record<string, { ink: string; wash: string }> = {
  parking: { ink: '#2563eb', wash: 'rgba(37, 99, 235, 0.16)' },
  wifi: { ink: '#7c3aed', wash: 'rgba(124, 58, 237, 0.15)' },
  card: { ink: '#0f766e', wash: 'rgba(15, 118, 110, 0.14)' },
  cash: { ink: '#15803d', wash: 'rgba(21, 128, 61, 0.14)' },
  bizum: { ink: '#c2410c', wash: 'rgba(194, 65, 12, 0.14)' },
  restrooms: { ink: '#57534e', wash: 'rgba(87, 83, 78, 0.14)' },
  accessible: { ink: '#1d4ed8', wash: 'rgba(29, 78, 216, 0.15)' },
  terrace: { ink: '#b45309', wash: 'rgba(180, 83, 9, 0.15)' },
  pet_friendly: { ink: '#db2777', wash: 'rgba(219, 39, 119, 0.14)' },
  air_conditioning: { ink: '#0891b2', wash: 'rgba(8, 145, 178, 0.15)' },
  heating: { ink: '#ea580c', wash: 'rgba(234, 88, 12, 0.16)' },
  outdoor_heaters: { ink: '#c2410c', wash: 'rgba(194, 65, 12, 0.16)' },
  kids_friendly: { ink: '#d97706', wash: 'rgba(217, 119, 6, 0.16)' },
  high_chairs: { ink: '#ca8a04', wash: 'rgba(202, 138, 4, 0.16)' },
  group_tables: { ink: '#7c3aed', wash: 'rgba(124, 58, 237, 0.14)' },
  private_rooms: { ink: '#7c2d12', wash: 'rgba(124, 45, 18, 0.14)' },
  live_music: { ink: '#c026d3', wash: 'rgba(192, 38, 211, 0.14)' },
  tv: { ink: '#1e3a8a', wash: 'rgba(30, 58, 138, 0.14)' },
  takeaway: { ink: '#c45c3e', wash: 'rgba(196, 92, 62, 0.16)' },
  delivery: { ink: '#16a34a', wash: 'rgba(22, 163, 74, 0.15)' },
  bike_parking: { ink: '#0d9488', wash: 'rgba(13, 148, 136, 0.15)' },
  garden: { ink: '#16a34a', wash: 'rgba(22, 163, 74, 0.16)' },
  rooftop: { ink: '#0284c7', wash: 'rgba(2, 132, 199, 0.15)' },
  views: { ink: '#2563eb', wash: 'rgba(37, 99, 235, 0.14)' },
  charging: { ink: '#ca8a04', wash: 'rgba(202, 138, 4, 0.18)' },
  vegetarian: { ink: '#15803d', wash: 'rgba(21, 128, 61, 0.16)' },
  vegan: { ink: '#166534', wash: 'rgba(22, 101, 52, 0.16)' },
  gluten_free: { ink: '#b45309', wash: 'rgba(180, 83, 9, 0.16)' },
  lactose_free: { ink: '#a16207', wash: 'rgba(161, 98, 7, 0.16)' },
  halal: { ink: '#047857', wash: 'rgba(4, 120, 87, 0.16)' },
  work_friendly: { ink: '#4338ca', wash: 'rgba(67, 56, 202, 0.14)' },
  smoking_area: { ink: '#57534e', wash: 'rgba(87, 83, 78, 0.16)' },
}

const DEFAULT_AMENITY_TONE = { ink: '#6b5344', wash: 'rgba(107, 83, 68, 0.12)' }

export function getAmenityTone(id: string): { ink: string; wash: string } {
  return AMENITY_TONES[id] ?? DEFAULT_AMENITY_TONE
}

export function getPriceRangeSymbol(id: CompanyPriceRange): string {
  if (!id) {
    return ''
  }

  return COMPANY_PRICE_RANGES.find((item) => item.id === id)?.label ?? ''
}

export function getPriceRangeLabel(id: CompanyPriceRange): string {
  if (!id) {
    return ''
  }

  const match = COMPANY_PRICE_RANGES.find((item) => item.id === id)
  return match ? `${match.label} · ${match.hint}` : ''
}

export function companyFacilitySearchTerms(
  venueTypes: string[],
  amenities: string[],
  priceRange: CompanyPriceRange,
): string[] {
  return [
    ...venueTypes.map(getVenueTypeLabel),
    ...amenities.map(getAmenityLabel),
    getPriceRangeLabel(priceRange),
  ].filter(Boolean)
}

export function parseCompanyProfileFacilities(
  data: Record<string, unknown>,
  characteristics: string[],
): {
  venueTypes: string[]
  amenities: string[]
  priceRange: CompanyPriceRange
  characteristics: string[]
} {
  const hasStoredVenueTypes = Array.isArray(data.venueTypes)
  const hasStoredAmenities = Array.isArray(data.amenities)

  return {
    venueTypes: hasStoredVenueTypes
      ? sanitizeCompanyVenueTypes(data.venueTypes)
      : migrateVenueTypesFromCharacteristics(characteristics),
    amenities: hasStoredAmenities
      ? sanitizeCompanyAmenities(data.amenities)
      : migrateAmenitiesFromCharacteristics(characteristics),
    priceRange: sanitizeCompanyPriceRange(data.priceRange),
    characteristics: stripMigratedCharacteristics(characteristics),
  }
}
