/**
 * «Tu mapa gastronómico»: cuántos restaurantes de tu ciudad y de tu país has
 * visitado de verdad (reserva a la que fuiste o consumo validado con PIN) y los
 * premios por completarlo. Lógica pura: la ruta pone los datos.
 */

export type CollectionScope = 'city' | 'country'

export interface CollectionRewardItem {
  itemId: string
  quantity: number
}

export interface CollectionTier {
  /** Clave estable del premio (también la del ítem concedido). */
  key: string
  scope: CollectionScope
  badgeId: string
  badgeName: string
  badgeDescription: string
  /** Porcentaje del total que hay que visitar (100 = todos). */
  percent: number
  /** Mínimo de restaurantes visitados, para que no sea trivial con pocos locales. */
  minVisited: number
  rewards: CollectionRewardItem[]
}

export interface CollectionBadge {
  id: string
  name: string
  description: string
  scope: CollectionScope
  earnedAt: string
}

/** Una ciudad cuenta para la insignia solo si tiene al menos estos restaurantes. */
export const CITY_MIN_RESTAURANTS = 5

export function cityTier(cityKeyValue: string, cityName: string): CollectionTier {
  return {
    key: `collection:city:${cityKeyValue}`,
    scope: 'city',
    badgeId: `leyenda_ciudad:${cityKeyValue}`,
    badgeName: `Leyenda de ${cityName}`,
    badgeDescription: `Has estado en todos los restaurantes de Adelia en ${cityName}.`,
    percent: 100,
    minVisited: CITY_MIN_RESTAURANTS,
    rewards: [{ itemId: 'llave_maestra', quantity: 1 }, { itemId: 'triple_sello', quantity: 1 }],
  }
}

export function countryTiers(countryKeyValue: string, countryName: string): CollectionTier[] {
  const base = (percent: number, minVisited: number, badgeName: string, rewards: CollectionRewardItem[]) => ({
    key: `collection:country:${countryKeyValue}:${percent}`,
    scope: 'country' as const,
    badgeId: `ruta_pais:${countryKeyValue}:${percent}`,
    badgeName,
    badgeDescription: percent === 100
      ? `Has estado en todos los restaurantes de Adelia en ${countryName}.`
      : `Has estado en el ${percent} % de los restaurantes de Adelia en ${countryName}.`,
    percent,
    minVisited,
    rewards,
  })
  return [
    base(10, 5, 'Explorador nacional', [{ itemId: 'triple_sello', quantity: 1 }]),
    base(25, 12, 'Trotamundos gastronómico', [{ itemId: 'llave_maestra', quantity: 1 }]),
    base(50, 25, 'Gran ruta de Adelia', [
      { itemId: 'llave_maestra', quantity: 1 },
      { itemId: 'salvoconducto', quantity: 1 },
    ]),
    base(100, 40, 'Leyenda nacional', [
      { itemId: 'llave_maestra', quantity: 3 },
      { itemId: 'escudo_mesa', quantity: 2 },
    ]),
  ]
}

/** Restaurantes que hay que visitar para conseguir el premio (0 si no aplica). */
export function tierTarget(tier: CollectionTier, total: number): number {
  if (total <= 0) return 0
  if (tier.scope === 'city' && total < CITY_MIN_RESTAURANTS) return 0
  return Math.max(tier.minVisited, Math.ceil((total * tier.percent) / 100))
}

export function tierReached(tier: CollectionTier, visited: number, total: number): boolean {
  const target = tierTarget(tier, total)
  return target > 0 && target <= total && visited >= target
}

export function normalizeCountry(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseCollectionBadges(value: unknown): CollectionBadge[] {
  if (!Array.isArray(value)) return []
  return value.filter((badge): badge is CollectionBadge => (
    Boolean(badge)
    && typeof badge === 'object'
    && typeof (badge as CollectionBadge).id === 'string'
    && typeof (badge as CollectionBadge).name === 'string'
  ))
}
