/**
 * Copia a Firestore los datos de negocio que hasta ahora vivían en el código:
 * planes y capacidades, ítems, recompensas, penalizaciones y facturación.
 * Es idempotente (merge) y NO borra nada.
 *
 *   npx tsx scripts/seed-remote-catalog.ts            # simulación: solo muestra lo que escribiría
 *   npx tsx scripts/seed-remote-catalog.ts --write    # escribe en Firestore
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import {
  COMPANY_PLANS,
  COMPANY_PLAN_CAPABILITIES,
  COMPANY_PLAN_IDS,
  getCompanyPlan,
} from '../src/data/companyPlans.ts'
import {
  INVENTORY_ITEMS,
  LEVEL_REWARDS,
  LOOT_BANDS,
  LOOT_POOLS,
  REVIEW_BOOST_ADELINAS,
  REVIEW_BOOST_XP,
  WALK_IN_COOLDOWN_HOURS,
} from '../src/data/inventoryItems.ts'
import {
  COMPANY_CONFIRMED_XP,
  COMPANY_HISTORICAL_MISSIONS,
  COMPANY_LEVELS,
  COMPANY_LEVEL_PERKS,
  COMPANY_MONTHLY_MISSIONS,
  COMPANY_MONTHLY_SLOT_COUNT,
  COMPANY_REPLY_XP,
  COMPANY_REVIEW_XP,
  COMPANY_WEEKLY_BONUS_TARGET,
  COMPANY_WEEKLY_BONUS_XP,
  COMPANY_WEEKLY_MISSIONS,
  COMPANY_WEEKLY_SLOT_COUNT,
} from '../src/data/companyGamificationCatalog.ts'
import { CANCELLATION_PENALTY_RATES, PROMO_LOCK_STRIKES } from '../src/data/cancellationPenalties.ts'
import {
  LEMONSQUEEZY_CHECKOUT_URL,
  LEMONSQUEEZY_STORE_ID,
  LEMONSQUEEZY_VARIANT_IDS,
} from '../src/data/lemonSqueezyCheckout.ts'

const write = process.argv.includes('--write')
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ?? path.join(root, 'serviceAccountKey.json')
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

type Doc = { collection: string; id: string; data: Record<string, unknown> }
const docs: Doc[] = []

const planIds = COMPANY_PLAN_IDS
COMPANY_PLAN_IDS.forEach((planId, order) => {
  const plan = getCompanyPlan(planId)
  const caps: Record<string, unknown> = {}
  for (const capability of COMPANY_PLAN_CAPABILITIES) {
    caps[capability.id] = capability.values[planId]
  }
  docs.push({
    collection: 'planCatalog',
    id: planId,
    data: { ...JSON.parse(JSON.stringify(plan)), order, caps },
  })
})

docs.push({
  collection: 'appConfig',
  id: 'planCapabilities',
  data: { items: COMPANY_PLAN_CAPABILITIES.map(({ id, label }) => ({ id, label })) },
})

for (const item of INVENTORY_ITEMS) {
  docs.push({ collection: 'inventoryItems', id: item.id, data: JSON.parse(JSON.stringify(item)) })
}

docs.push({
  collection: 'gameConfig',
  id: 'rewards',
  data: {
    levelRewards: JSON.parse(JSON.stringify(LEVEL_REWARDS)),
    lootPools: JSON.parse(JSON.stringify(LOOT_POOLS)),
    lootBands: JSON.parse(JSON.stringify(LOOT_BANDS)),
    reviewBoostXp: REVIEW_BOOST_XP,
    reviewBoostAdelinas: REVIEW_BOOST_ADELINAS,
    walkInCooldownHours: WALK_IN_COOLDOWN_HOURS,
  },
})

docs.push({
  collection: 'gameConfig',
  id: 'penalties',
  data: { rates: CANCELLATION_PENALTY_RATES, lockStrikes: PROMO_LOCK_STRIKES },
})

for (const level of COMPANY_LEVELS) {
  docs.push({
    collection: 'companyLevelCatalog',
    id: String(level.level),
    data: { ...JSON.parse(JSON.stringify(level)), perk: COMPANY_LEVEL_PERKS[level.level] ?? null },
  })
}

for (const mission of [...COMPANY_WEEKLY_MISSIONS, ...COMPANY_MONTHLY_MISSIONS, ...COMPANY_HISTORICAL_MISSIONS]) {
  docs.push({ collection: 'companyMissionCatalog', id: mission.id, data: JSON.parse(JSON.stringify(mission)) })
}

docs.push({
  collection: 'gameConfig',
  id: 'company',
  data: {
    weeklySlotCount: COMPANY_WEEKLY_SLOT_COUNT,
    monthlySlotCount: COMPANY_MONTHLY_SLOT_COUNT,
    weeklyBonusTarget: COMPANY_WEEKLY_BONUS_TARGET,
    weeklyBonusXp: COMPANY_WEEKLY_BONUS_XP,
    confirmedXp: COMPANY_CONFIRMED_XP,
    reviewXp: COMPANY_REVIEW_XP,
    replyXp: COMPANY_REPLY_XP,
  },
})

const variants: Record<string, { plan: string; period: string }> = {}
for (const [plan, periods] of Object.entries(LEMONSQUEEZY_VARIANT_IDS)) {
  for (const [period, variantId] of Object.entries(periods)) {
    variants[variantId] = { plan, period }
  }
}
docs.push({
  collection: 'appConfig',
  id: 'billing',
  data: { checkoutUrl: LEMONSQUEEZY_CHECKOUT_URL, storeId: LEMONSQUEEZY_STORE_ID, variants },
})

console.log(`${write ? 'ESCRIBIENDO' : 'SIMULACIÓN'} en la base "${databaseId}": ${docs.length} documentos`)
console.log(`  planCatalog: ${planIds.length} (${COMPANY_PLANS.map((plan) => `${plan.name} ${plan.priceMonthly} €`).join(', ')})`)
console.log(`  inventoryItems: ${INVENTORY_ITEMS.length}`)
console.log(`  companyLevelCatalog: ${COMPANY_LEVELS.length}, companyMissionCatalog: ${COMPANY_WEEKLY_MISSIONS.length + COMPANY_MONTHLY_MISSIONS.length + COMPANY_HISTORICAL_MISSIONS.length}`)
console.log('  gameConfig/rewards, gameConfig/company, gameConfig/penalties, appConfig/billing, appConfig/planCapabilities')

if (!write) {
  console.log('\nNo se ha escrito nada. Repite con --write para aplicarlo.')
  process.exit(0)
}

if (!existsSync(serviceAccountPath)) {
  console.error('Falta serviceAccountKey.json')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const db = getFirestore(undefined, databaseId)

for (let start = 0; start < docs.length; start += 400) {
  const batch = db.batch()
  for (const entry of docs.slice(start, start + 400)) {
    batch.set(
      db.collection(entry.collection).doc(entry.id),
      { ...entry.data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  }
  await batch.commit()
}
console.log('Listo.')
