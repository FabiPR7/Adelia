import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))),
  })
}

const adminAuth = getAuth()
const adminDb = getFirestore(undefined, databaseId)

const usersSnap = await adminDb.collection('users').where('role', '==', 'company').get()

if (usersSnap.empty) {
  console.log('No hay empresas que actualizar.')
  process.exit(0)
}

const now = Timestamp.now()
let updated = 0

for (const userDoc of usersSnap.docs) {
  const data = userDoc.data()
  const companyId = data.companyId

  let credMustChange = null

  if (companyId) {
    const credSnap = await adminDb.collection('companyCredentials').doc(companyId).get()
    credMustChange = credSnap.data()?.mustChangePassword ?? null
  }

  const userMustChange = data.mustChangePassword ?? null

  if (userMustChange === false && credMustChange === false) {
    console.log(`Omitida (ya cambió contraseña): ${data.loginName ?? userDoc.id}`)
    continue
  }

  await adminAuth.setCustomUserClaims(userDoc.id, { mustChangePassword: true })

  await userDoc.ref.set({ mustChangePassword: true }, { merge: true })

  if (companyId) {
    await adminDb.collection('companyCredentials').doc(companyId).set(
      {
        mustChangePassword: true,
        updatedAt: now,
      },
      { merge: true },
    )
  }

  console.log(`Marcada para cambio: ${data.loginName ?? userDoc.id}`)
  updated += 1
}

console.log(`\nListo. ${updated} empresa(s) deben cambiar contraseña en el próximo login.`)
