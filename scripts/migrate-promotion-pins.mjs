/**
 * Migra companies.*.promotionPin → companies/{id}/private/promotionPin
 * y elimina el campo legado del documento público.
 *
 * Uso (con serviceAccountKey.json en la raíz):
 *   node scripts/migrate-promotion-pins.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ?? path.join(root, 'serviceAccountKey.json')
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

if (!existsSync(serviceAccountPath)) {
  console.error('Falta serviceAccountKey.json (o FIREBASE_SERVICE_ACCOUNT_PATH).')
  process.exit(1)
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))),
})

const db = getFirestore(undefined, databaseId)
const snapshot = await db.collection('companies').get()
let migrated = 0
let skipped = 0

for (const docSnap of snapshot.docs) {
  const data = docSnap.data()
  const legacy = data.promotionPin
  const privateRef = docSnap.ref.collection('private').doc('promotionPin')
  const privateSnap = await privateRef.get()

  if (!legacy || typeof legacy !== 'object' || typeof legacy.code !== 'string') {
    skipped += 1
    continue
  }

  if (!privateSnap.exists) {
    await privateRef.set({
      code: String(legacy.code),
      rotation: legacy.rotation ?? 'manual',
      nextRotationAt: legacy.nextRotationAt ?? null,
      lastRotatedAt: legacy.lastRotatedAt ?? null,
      updatedAt: legacy.updatedAt ?? FieldValue.serverTimestamp(),
    })
  }

  await docSnap.ref.update({ promotionPin: FieldValue.delete() })
  migrated += 1
  console.log(`OK ${docSnap.id}`)
}

console.log(`Migrados: ${migrated}. Sin PIN legado: ${skipped}.`)
