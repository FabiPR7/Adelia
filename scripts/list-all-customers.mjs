import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))),
  })
}

const db = getFirestore(undefined, databaseId)
const auth = getAuth()

const usersSnap = await db.collection('users').get()

console.log('=== Firestore users ===')
for (const docSnap of usersSnap.docs) {
  const data = docSnap.data()
  const xp = data.gamification?.xp ?? data.xp ?? 0
  console.log(JSON.stringify({
    uid: docSnap.id,
    email: data.email ?? null,
    role: data.role ?? null,
    displayName: data.displayName ?? null,
    xp,
    level: data.gamification?.lastCelebratedLevel ?? null,
  }))
}

console.log('\n=== Firebase Auth (customers) ===')
let pageToken
do {
  const result = await auth.listUsers(1000, pageToken)
  for (const user of result.users) {
    const providers = user.providerData.map((p) => p.providerId).join(', ')
    const firestoreSnap = await db.collection('users').doc(user.uid).get()
    const role = firestoreSnap.exists ? firestoreSnap.data()?.role : '(no doc)'
    if (role === 'customer' || providers.includes('google')) {
      console.log(JSON.stringify({
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        providers,
        role,
        xp: firestoreSnap.data()?.gamification?.xp ?? firestoreSnap.data()?.xp ?? 0,
      }))
    }
  }
  pageToken = result.pageToken
} while (pageToken)
