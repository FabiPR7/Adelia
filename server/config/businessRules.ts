// Reglas de negocio: viven en la base de datos (`appConfig/businessRules`) y se editan
// ahí (o desde el admin), no en el código. El servidor las lee con caché de 5 minutos.
// Los valores de abajo son solo la COPIA DE EMERGENCIA si la base no responde o falta
// un campo; la fuente es la base de datos (scripts/seed-business-rules.ts la rellena).
import { adminDb } from '../firebase-admin.ts'

export interface CollectionRewardRule {
  itemId: string
  quantity: number
}

/** Nivel del país en el mapa gastronómico (la insignia se nombra con el país y el porcentaje). */
export interface CollectionTierRule {
  percent: number
  minVisited: number
  badgeName: string
  rewards: CollectionRewardRule[]
}

export interface BusinessRules {
  /** Cancelar con al menos estas horas es gratis (sin XP perdida ni aviso). */
  freeCancelHours: number
  /** Con fianza, solo se puede reservar con hasta estos días de antelación. */
  depositMaxDaysAhead: number
  /** Largo permitido del @usuario. */
  usernameMin: number
  usernameMax: number
  /** @usuarios que nadie puede coger (además de los que empiezan por «adelia»). */
  reservedUsernames: string[]
  /** XP máxima que da usar una carta. */
  maxItemUseXp: number
  /** Misiones de cliente que salen cada semana y cada mes. */
  weeklyMissionSlots: number
  monthlyMissionSlots: number
  /** Mapa gastronómico: ciudad (completarla entera) y país (por porcentaje). */
  collectionCityMinRestaurants: number
  collectionCityRewards: CollectionRewardRule[]
  collectionCountryTiers: CollectionTierRule[]
  /** «Comer ahora»: minutos de margen si la hora ya empezó (llegar un poco tarde). */
  nowGraceMinutes: number
  /** «Comer ahora»: hasta cuántos minutos desde ya se buscan mesas. */
  nowWindowMinutes: number
  /** «Comer ahora»: radio de búsqueda alrededor de ti (km). */
  nowRadiusKm: number
  /** «Comer ahora»: cuántos locales cercanos se miran como mucho. */
  nowMaxRestaurants: number
}

export const EMERGENCY_BUSINESS_RULES: BusinessRules = {
  freeCancelHours: 24,
  depositMaxDaysAhead: 6,
  usernameMin: 3,
  usernameMax: 20,
  reservedUsernames: [
    'adelia', 'adeliareservas', 'admin', 'administrador', 'soporte', 'support', 'ayuda', 'help',
    'contacto', 'info', 'oficial', 'official', 'staff', 'moderador', 'mod', 'root', 'sistema',
    'system', 'null', 'undefined', 'usuario', 'user', 'anonimo', 'restaurante', 'empresa',
  ],
  maxItemUseXp: 80,
  weeklyMissionSlots: 6,
  monthlyMissionSlots: 5,
  collectionCityMinRestaurants: 5,
  collectionCityRewards: [
    { itemId: 'llave_maestra', quantity: 1 },
    { itemId: 'triple_sello', quantity: 1 },
  ],
  collectionCountryTiers: [
    { percent: 10, minVisited: 5, badgeName: 'Explorador nacional', rewards: [{ itemId: 'triple_sello', quantity: 1 }] },
    { percent: 25, minVisited: 12, badgeName: 'Trotamundos gastronómico', rewards: [{ itemId: 'llave_maestra', quantity: 1 }] },
    { percent: 50, minVisited: 25, badgeName: 'Gran ruta de Adelia', rewards: [{ itemId: 'llave_maestra', quantity: 1 }, { itemId: 'salvoconducto', quantity: 1 }] },
    { percent: 100, minVisited: 40, badgeName: 'Leyenda nacional', rewards: [{ itemId: 'llave_maestra', quantity: 3 }, { itemId: 'escudo_mesa', quantity: 2 }] },
  ],
  nowGraceMinutes: 5,
  nowWindowMinutes: 30,
  nowRadiusKm: 5,
  nowMaxRestaurants: 20,
}

const CACHE_MS = 5 * 60 * 1000
let current: BusinessRules = EMERGENCY_BUSINESS_RULES
let loadedAt = 0
let inflight: Promise<void> | null = null

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function nonNegativeInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function rewards(value: unknown): CollectionRewardRule[] | null {
  if (!Array.isArray(value)) return null
  const list = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const quantity = positiveInt(row.quantity)
    return typeof row.itemId === 'string' && row.itemId && quantity ? [{ itemId: row.itemId, quantity }] : []
  })
  return list.length > 0 ? list : null
}

function tiers(value: unknown): CollectionTierRule[] | null {
  if (!Array.isArray(value)) return null
  const list = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const percent = positiveInt(row.percent)
    const minVisited = positiveInt(row.minVisited)
    const tierRewards = rewards(row.rewards)
    if (!percent || percent > 100 || !minVisited || !tierRewards) return []
    if (typeof row.badgeName !== 'string' || !row.badgeName.trim()) return []
    return [{ percent, minVisited, badgeName: row.badgeName.trim(), rewards: tierRewards }]
  })
  return list.length > 0 ? list.sort((left, right) => left.percent - right.percent) : null
}

/** Lo guardado en la base, campo a campo; lo que falte o sea raro sale de la copia de emergencia. */
export function parseBusinessRules(data: Record<string, unknown> | undefined): BusinessRules {
  const d = data ?? {}
  const base = EMERGENCY_BUSINESS_RULES
  return {
    freeCancelHours: positiveInt(d.freeCancelHours) ?? base.freeCancelHours,
    depositMaxDaysAhead: positiveInt(d.depositMaxDaysAhead) ?? base.depositMaxDaysAhead,
    usernameMin: positiveInt(d.usernameMin) ?? base.usernameMin,
    usernameMax: positiveInt(d.usernameMax) ?? base.usernameMax,
    reservedUsernames: Array.isArray(d.reservedUsernames) && d.reservedUsernames.length > 0
      ? d.reservedUsernames.filter((item): item is string => typeof item === 'string').map((item) => item.trim().toLowerCase())
      : base.reservedUsernames,
    maxItemUseXp: positiveInt(d.maxItemUseXp) ?? base.maxItemUseXp,
    weeklyMissionSlots: positiveInt(d.weeklyMissionSlots) ?? base.weeklyMissionSlots,
    monthlyMissionSlots: positiveInt(d.monthlyMissionSlots) ?? base.monthlyMissionSlots,
    collectionCityMinRestaurants: positiveInt(d.collectionCityMinRestaurants) ?? base.collectionCityMinRestaurants,
    collectionCityRewards: rewards(d.collectionCityRewards) ?? base.collectionCityRewards,
    collectionCountryTiers: tiers(d.collectionCountryTiers) ?? base.collectionCountryTiers,
    nowGraceMinutes: Math.min(30, nonNegativeInt(d.nowGraceMinutes) ?? base.nowGraceMinutes),
    nowWindowMinutes: Math.min(120, positiveInt(d.nowWindowMinutes) ?? base.nowWindowMinutes),
    nowRadiusKm: Math.min(30, positiveInt(d.nowRadiusKm) ?? base.nowRadiusKm),
    nowMaxRestaurants: Math.min(40, positiveInt(d.nowMaxRestaurants) ?? base.nowMaxRestaurants),
  }
}

/** Refresca la caché si está caducada. Nunca lanza: ante un fallo sigue con lo último leído. */
export function ensureBusinessRules(): Promise<void> {
  if (Date.now() - loadedAt < CACHE_MS) return Promise.resolve()
  if (!inflight) {
    // Promise.resolve().then: si la lectura falla al empezar, también se recoge abajo.
    inflight = Promise.resolve()
      .then(() => adminDb.collection('appConfig').doc('businessRules').get())
      .then((snap) => {
        current = parseBusinessRules(snap.data())
        loadedAt = Date.now()
      })
      .catch((error) => {
        console.error('businessRules: no se pudo leer, se usa lo último válido.', error)
        loadedAt = Date.now() - CACHE_MS + 30_000
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function getBusinessRules(): BusinessRules {
  return current
}

/** Solo para tests. */
export function setBusinessRulesForTests(next: Partial<BusinessRules> | null): void {
  current = { ...EMERGENCY_BUSINESS_RULES, ...(next ?? {}) }
  loadedAt = next ? Date.now() + CACHE_MS : 0
}
