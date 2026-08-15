import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'
const mode = process.argv[2] || 'trigger-animation'
const emailFilter = (process.argv[3] || '').trim().toLowerCase()

function getLevelForXp(xp) {
  const levels = [
    { level: 7, minXp: 10000 },
    { level: 6, minXp: 6000 },
    { level: 5, minXp: 3200 },
    { level: 4, minXp: 1600 },
    { level: 3, minXp: 800 },
    { level: 2, minXp: 300 },
    { level: 1, minXp: 0 },
  ]

  return levels.find((entry) => xp >= entry.minXp) ?? levels[levels.length - 1]
}

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

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))),
  })
}

const db = getFirestore(undefined, databaseId)
const auth = getAuth()

async function resolveTargets() {
  if (emailFilter) {
    const usersSnap = await db.collection('users').get()
    const match = usersSnap.docs.find((docSnap) => {
      const email = typeof docSnap.data().email === 'string' ? docSnap.data().email.trim().toLowerCase() : ''
      return email === emailFilter
    })

    if (!match) {
      throw new Error(`No se encontró usuario con email ${emailFilter}`)
    }

    return [match]
  }

  if (mode === 'trigger-google') {
    const targets = []
    let pageToken

    do {
      const result = await auth.listUsers(1000, pageToken)
      for (const user of result.users) {
        const usesGoogle = user.providerData.some((provider) => provider.providerId === 'google.com')
        if (!usesGoogle) {
          continue
        }

        const docSnap = await db.collection('users').doc(user.uid).get()
        if (docSnap.exists && docSnap.data()?.role === 'customer') {
          targets.push(docSnap)
        }
      }
      pageToken = result.pageToken
    } while (pageToken)

    return targets
  }

  throw new Error('Indica un email o usa trigger-google')
}

const targets = await resolveTargets()

for (const userDoc of targets) {
  const data = userDoc.data()
  const email = data.email ?? userDoc.id
  const gamification = data.gamification ?? {}
  const xp = typeof gamification.xp === 'number' ? gamification.xp : (typeof data.xp === 'number' ? data.xp : 0)
  const currentLevel = getLevelForXp(xp).level

  if (mode === 'reset-level-1') {
    await userDoc.ref.update({
      xp: 0,
      adelinas: 0,
      gamification: defaultGamification,
    })
    console.log(`Reset nivel 1: ${email} (antes ${xp} XP, nivel ${currentLevel})`)
    continue
  }

  const lastCelebratedLevel = Math.max(1, currentLevel - 1)
  const nextGamification = {
    ...gamification,
    lastCelebratedLevel,
  }

  await userDoc.ref.update({
    gamification: nextGamification,
  })

  console.log(
    `Animación pendiente: ${email} (${currentLevel - 1} → ${currentLevel}). Abre la app para verla.`,
  )
}
