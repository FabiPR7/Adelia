/**
 * Prepara restaurantIndex para el listado escalable: añade geohash, ciudad
 * normalizada y reviewCount 0 donde falten.
 *   npx tsx scripts/backfill-discovery-index.ts          (simulación, no escribe)
 *   npx tsx scripts/backfill-discovery-index.ts --apply  (escribe)
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { cityKey, encodeGeohash } from '../server/utils/geohash.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(root, 'serviceAccountKey.json')
const apply = process.argv.includes('--apply')

if (!existsSync(serviceAccountPath)) {
  console.error('Falta serviceAccountKey.json')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const db = getFirestore(process.env.VITE_FIREBASE_DATABASE_ID || 'adelia')

let scanned = 0
let changed = 0
let last: FirebaseFirestore.QueryDocumentSnapshot | null = null

for (;;) {
  let page = db.collection('restaurantIndex').orderBy('__name__').limit(300)
  if (last) page = page.startAfter(last)
  const snap = await page.get()
  if (snap.empty) break

  const batch = db.batch()
  let writes = 0
  for (const docSnap of snap.docs) {
    scanned += 1
    const data = docSnap.data()
    const patch: Record<string, unknown> = {}
    const lat = typeof data.latitude === 'number' ? data.latitude : null
    const lng = typeof data.longitude === 'number' ? data.longitude : null
    if (lat != null && lng != null) {
      const hash = encodeGeohash(lat, lng)
      if (data.geohash !== hash) patch.geohash = hash
    }
    const key = cityKey(typeof data.municipality === 'string' ? data.municipality : '')
    if (data.municipalityKey !== key) patch.municipalityKey = key
    if (typeof data.reviewCount !== 'number') patch.reviewCount = 0
    if (Object.keys(patch).length > 0) {
      changed += 1
      writes += 1
      if (apply) batch.set(docSnap.ref, patch, { merge: true })
    }
  }
  if (apply && writes > 0) await batch.commit()
  last = snap.docs[snap.docs.length - 1]
}

console.log(`${apply ? 'Aplicado' : 'Simulación'}: ${scanned} restaurantes revisados, ${changed} ${apply ? 'actualizados' : 'por actualizar'}.`)
