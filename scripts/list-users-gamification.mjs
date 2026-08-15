import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))),
  })
}

const db = getFirestore(undefined, databaseId)
const usersSnap = await db.collection('users').get()

for (const docSnap of usersSnap.docs) {
  const data = docSnap.data()
  const xp = data.gamification?.xp ?? data.xp ?? 0
  const role = data.role ?? '?'
  const email = data.email ?? '(sin email)'
  const name = data.displayName ?? ''
  if (role === 'customer' || xp > 0) {
    console.log(`${email} | ${role} | ${name} | XP: ${xp}`)
  }
}
