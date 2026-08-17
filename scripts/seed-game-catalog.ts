/**
 * Publica el catálogo de misiones, niveles y config de XP en Firestore.
 *   npx tsx scripts/seed-game-catalog.ts
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { WEEKLY_MISSIONS, MONTHLY_MISSION_POOL, HISTORICAL_MISSIONS } from '../src/data/gamificationMissions.ts'
import { GAMIFICATION_LEVELS, PROFILE_REWARDS } from '../src/data/gamificationLevels.ts'
import {
  WEEKLY_MISSION_BONUS_XP,
  WEEKLY_BONUS_TARGET,
  CONFIRMED_RESERVATION_XP,
} from '../src/types/gamification.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ?? path.join(root, 'serviceAccountKey.json')
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

if (!existsSync(serviceAccountPath)) {
  console.error('Falta serviceAccountKey.json')
  process.exit(1)
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))),
})

const db = getFirestore(undefined, databaseId)
const now = FieldValue.serverTimestamp()

const missions = [...WEEKLY_MISSIONS, ...MONTHLY_MISSION_POOL, ...HISTORICAL_MISSIONS]
const rewardsByLevel = new Map(PROFILE_REWARDS.map((item) => [item.level, item.reward]))

let missionCount = 0
for (const mission of missions) {
  await db.collection('missionCatalog').doc(mission.id).set({
    id: mission.id,
    name: mission.name,
    description: mission.description,
    xp: mission.xp,
    cadence: mission.cadence,
    category: mission.category ?? null,
    icon: mission.icon,
    target: mission.target,
    updatedAt: now,
  }, { merge: true })
  missionCount += 1
}

let levelCount = 0
for (const level of GAMIFICATION_LEVELS) {
  await db.collection('levelCatalog').doc(String(level.level)).set({
    id: String(level.level),
    level: level.level,
    name: level.title,
    title: level.title,
    minXp: level.minXp,
    points: level.minXp,
    maxXp: level.maxXp,
    colors: level.colors,
    styleClass: level.styleClass,
    reward: rewardsByLevel.get(level.level) ?? null,
    updatedAt: now,
  }, { merge: true })
  levelCount += 1
}

await db.collection('gameConfig').doc('adelia').set({
  weeklyBonusXp: WEEKLY_MISSION_BONUS_XP,
  weeklyBonusTarget: WEEKLY_BONUS_TARGET,
  confirmedReservationXp: CONFIRMED_RESERVATION_XP,
  updatedAt: now,
}, { merge: true })

console.log(`missionCatalog: ${missionCount}`)
console.log(`levelCatalog: ${levelCount}`)
console.log('gameConfig/adelia: ok')
