import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'
const emailFilter = (process.argv[2] || '').trim().toLowerCase()

if (!emailFilter) {
  console.error('Uso: node scripts/reset-customer-gamification.mjs <email>')
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))),
  })
}

const db = getFirestore(undefined, databaseId)

const defaultGamification = {
  xp: 0,
  adelinas: 0,
  completedMissions: [],
  visitedCompanyIds: [],
  weekKey: '',
  weeklyCompleted: [],
  monthKey: '',
  monthlyCompleted: [],
  reviewsCount: 0,
  reviewsWithPhotoCount: 0,
  textReviewsCount: 0,
  reviewedReservationIds: [],
  redemptionsCount: 0,
  helpfulReviewVotes: 0,
  favoritesAddedThisWeek: 0,
  favoriteSlugsAtWeekStart: [],
  awardedReservationXpIds: [],
  claimedPromotions: [],
  ladderBaselinesByCompany: {},
  activeLadderPromotionByCompany: {},
  ladderCompletionsByCompany: {},
  lastCelebratedLevel: 1,
}

const usersSnap = await db.collection('users').get()
const matches = usersSnap.docs.filter((docSnap) => {
  const email = typeof docSnap.data().email === 'string' ? docSnap.data().email.trim().toLowerCase() : ''
  return email === emailFilter
})

if (matches.length === 0) {
  console.error(`No se encontró usuario con email "${emailFilter}".`)
  console.log('Usuarios disponibles:')
  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data()
    console.log(`- ${data.email ?? '(sin email)'} [${data.role ?? '?'}]`)
  }
  process.exit(1)
}

const userDoc = matches[0]
const data = userDoc.data()
const previousXp = data.gamification?.xp ?? data.xp ?? 0
const previousLevel = data.gamification?.lastCelebratedLevel ?? '?'

await userDoc.ref.update({
  xp: 0,
  adelinas: 0,
  gamification: defaultGamification,
})

console.log(`Reset gamificación para ${data.email} (${userDoc.id})`)
console.log(`XP anterior: ${previousXp} → 0 (nivel 1)`)
console.log(`lastCelebratedLevel anterior: ${previousLevel} → 1`)
