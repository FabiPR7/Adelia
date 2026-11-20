import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import { readGamificationFromDocs, userGamificationRef, writeGamification } from '../data/userGamification.ts'
import { addInventoryGrants, numberRecord } from '../gamification/inventory.ts'
import { createCustomerNotification } from '../notifications/service.ts'
import { cityKey } from '../utils/geohash.ts'
import {
  cityTier,
  countryTiers,
  normalizeCountry,
  parseCollectionBadges,
  tierReached,
  tierTarget,
  type CollectionBadge,
  type CollectionTier,
} from '../gamification/restaurantCollection.ts'

const router = Router()

interface IndexEntry {
  id: string
  slug: string
  cityKey: string
  city: string
  countryKey: string
  country: string
}

// Todos los restaurantes publicados (pocos campos), 10 min en memoria.
const INDEX_CACHE_MS = 10 * 60_000
let indexCache: { entries: IndexEntry[]; at: number } | null = null

async function loadIndex(): Promise<IndexEntry[]> {
  if (indexCache && Date.now() - indexCache.at < INDEX_CACHE_MS) return indexCache.entries
  const snapshot = await adminDb.collection(COLLECTIONS.restaurantIndex)
    .select('slug', 'municipality', 'municipalityKey', 'country', 'hasProfile', 'deactivated', 'name')
    .limit(5000)
    .get()
  const entries: IndexEntry[] = []
  for (const doc of snapshot.docs) {
    const data = doc.data()
    if (data.hasProfile === false || data.deactivated === true) continue
    const slug = typeof data.slug === 'string' ? data.slug.trim() : ''
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    if (!slug || !name) continue
    const city = typeof data.municipality === 'string' ? data.municipality.trim() : ''
    const country = typeof data.country === 'string' ? data.country.trim() : ''
    entries.push({
      id: doc.id,
      slug,
      city,
      cityKey: typeof data.municipalityKey === 'string' && data.municipalityKey ? data.municipalityKey : cityKey(city),
      country,
      countryKey: normalizeCountry(country),
    })
  }
  indexCache = { entries, at: Date.now() }
  return entries
}

/** Restaurantes donde el cliente ha estado de verdad y cuántas veces. */
async function loadVisits(customer: { uid: string; email: string; emailVerified: boolean }): Promise<Map<string, number>> {
  const reservations = adminDb.collection('reservations').where('status', '==', 'confirmed')
  const [byUid, byEmail, consumptions] = await Promise.all([
    reservations.where('customerUid', '==', customer.uid).select('companyId').limit(2000).get(),
    customer.emailVerified && customer.email
      ? reservations.where('clientEmail', '==', customer.email).select('companyId').limit(2000).get()
      : Promise.resolve(null),
    adminDb.collectionGroup('verifiedConsumptions')
      .where('customerUid', '==', customer.uid)
      .orderBy('verifiedAt', 'desc')
      .limit(1000)
      .get(),
  ])

  const visits = new Map<string, number>()
  const add = (companyId: unknown) => {
    if (typeof companyId !== 'string' || !companyId) return
    visits.set(companyId, (visits.get(companyId) ?? 0) + 1)
  }
  const seenReservations = new Set<string>()
  for (const doc of [...byUid.docs, ...(byEmail?.docs ?? [])]) {
    if (seenReservations.has(doc.id)) continue
    seenReservations.add(doc.id)
    add(doc.get('companyId'))
  }
  for (const doc of consumptions.docs) {
    add(doc.get('companyId') ?? doc.ref.parent.parent?.id)
  }
  return visits
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

const ITEM_NAMES: Record<string, string> = {
  llave_maestra: 'Llave maestra',
  triple_sello: 'Triple sello',
  salvoconducto: 'Salvoconducto de depósito',
  escudo_mesa: 'Escudo de Mesa',
}

function rewardLabel(tier: CollectionTier): string {
  return tier.rewards
    .map((reward) => {
      const name = ITEM_NAMES[reward.itemId] ?? reward.itemId
      return reward.quantity > 1 ? `${reward.quantity} × ${name}` : name
    })
    .join(' + ')
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const [entries, visits, userSnap] = await Promise.all([
      loadIndex(),
      loadVisits(customer),
      adminDb.collection('users').doc(customer.uid).get(),
    ])
    const profile = userSnap.data() ?? {}

    // Ciudad: la que se pida (la que mira en Buscar) o la de su perfil.
    // Si una no tiene restaurantes (p. ej. pusiste la provincia), se prueba la
    // siguiente y, al final, la ciudad donde más has estado.
    const requestedCity = typeof req.query.city === 'string' ? req.query.city.trim().slice(0, 80) : ''
    const visitedCityKey = mostCommon(entries.filter((entry) => visits.has(entry.id)).map((entry) => entry.cityKey))
    const candidates = [requestedCity, String(profile.homeMunicipality || ''), String(profile.homeCity || '')]
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => cityKey(value))
    if (visitedCityKey) candidates.push(visitedCityKey)
    const wantedCityKey = candidates.find((key) => entries.some((entry) => entry.cityKey === key)) ?? ''
    const cityEntries = wantedCityKey ? entries.filter((entry) => entry.cityKey === wantedCityKey) : []
    const cityLabel = cityEntries[0]?.city || requestedCity

    // País: el del perfil, el de su ciudad o el que más restaurantes tiene.
    const countryKeyValue = normalizeCountry(String(profile.homeCountry || ''))
      || cityEntries[0]?.countryKey
      || mostCommon(entries.map((entry) => entry.countryKey))
    const countryEntries = entries.filter((entry) => entry.countryKey === countryKeyValue)
    const countryLabel = countryEntries[0]?.country || 'tu país'

    const visitedIn = (list: IndexEntry[]) => list.filter((entry) => visits.has(entry.id)).length
    const cityVisited = visitedIn(cityEntries)
    const countryVisited = visitedIn(countryEntries)

    const tiers: Array<{ tier: CollectionTier; visited: number; total: number }> = [
      ...(wantedCityKey ? [{ tier: cityTier(wantedCityKey, cityLabel), visited: cityVisited, total: cityEntries.length }] : []),
      ...countryTiers(countryKeyValue || 'pais', countryLabel).map((tier) => ({
        tier,
        visited: countryVisited,
        total: countryEntries.length,
      })),
    ]

    // Premios conseguidos: se conceden una sola vez (clave en grantedItemKeys).
    const reached = tiers.filter(({ tier, visited, total }) => tierReached(tier, visited, total))
    let badges: CollectionBadge[] = []
    let newlyEarned: CollectionBadge[] = []
    const statsRef = userGamificationRef(customer.uid)
    const userRef = adminDb.collection('users').doc(customer.uid)

    if (reached.length > 0) {
      const result = await adminDb.runTransaction(async (transaction) => {
        const [statsSnap, freshUser] = await Promise.all([transaction.get(statsRef), transaction.get(userRef)])
        const state = readGamificationFromDocs(statsSnap.data(), freshUser.data())
        const granted = new Set(Array.isArray(state.grantedItemKeys) ? (state.grantedItemKeys as string[]) : [])
        const current = parseCollectionBadges(state.collectionBadges)
        const fresh: CollectionBadge[] = []
        let inventory = numberRecord(state.inventory)
        const grantedKeys = [...granted]
        for (const { tier } of reached) {
          if (granted.has(tier.key)) continue
          inventory = addInventoryGrants(inventory, tier.rewards)
          grantedKeys.push(tier.key)
          if (!current.some((badge) => badge.id === tier.badgeId)) {
            fresh.push({
              id: tier.badgeId,
              name: tier.badgeName,
              description: tier.badgeDescription,
              scope: tier.scope,
              earnedAt: new Date().toISOString(),
            })
          }
        }
        if (grantedKeys.length === granted.size) {
          return { badges: current, fresh: [] as CollectionBadge[] }
        }
        const nextBadges = [...current, ...fresh]
        writeGamification(transaction, customer.uid, {
          ...state,
          inventory,
          grantedItemKeys: grantedKeys,
          collectionBadges: nextBadges,
        })
        return { badges: nextBadges, fresh }
      })
      badges = result.badges
      newlyEarned = result.fresh
    } else {
      const statsSnap = await statsRef.get()
      badges = parseCollectionBadges(readGamificationFromDocs(statsSnap.data(), profile).collectionBadges)
    }

    for (const badge of newlyEarned) {
      const tier = reached.find((entry) => entry.tier.badgeId === badge.id)?.tier
      void createCustomerNotification(customer.uid, {
        type: 'badge_unlocked',
        title: `Insignia única: ${badge.name}`,
        body: `${badge.description} Premio: ${tier ? rewardLabel(tier) : 'ítems especiales'}.`,
        icon: '🏆',
        actionUrl: '/app/explorar',
        actionLabel: 'Ver mi mapa',
        dedupeKey: `badge_unlocked:${badge.id}`,
        data: { badgeId: badge.id, collection: true },
      }).catch(() => undefined)
    }

    const visitedSlugs: Record<string, number> = {}
    for (const entry of entries) {
      const count = visits.get(entry.id)
      if (count) visitedSlugs[entry.slug] = count
    }

    res.json({
      city: wantedCityKey ? { name: cityLabel, key: wantedCityKey, total: cityEntries.length, visited: cityVisited } : null,
      country: { name: countryLabel, total: countryEntries.length, visited: countryVisited },
      visits: visitedSlugs,
      badges,
      newlyEarned,
      tiers: tiers.map(({ tier, visited, total }) => ({
        key: tier.key,
        scope: tier.scope,
        badgeId: tier.badgeId,
        badgeName: tier.badgeName,
        badgeDescription: tier.badgeDescription,
        percent: tier.percent,
        target: tierTarget(tier, total),
        visited,
        total,
        reward: rewardLabel(tier),
        earned: badges.some((badge) => badge.id === tier.badgeId),
        // Con pocos restaurantes algunos tramos aún no se pueden conseguir.
        available: tierTarget(tier, total) > 0 && tierTarget(tier, total) <= total,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar tu mapa.'
    const status = /sesión|autoriz|Perfil no encontrado|cliente/i.test(message) ? 401 : 500
    if (status === 500) console.error('collection:', error)
    res.status(status).json({ error: status === 401 ? message : 'No se pudo cargar tu mapa.' })
  }
})

export default router
