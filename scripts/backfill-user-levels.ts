/**
 * Guarda en cada usuario su nivel actual (según `levelCatalog`) junto a su XP,
 * en `userGamification/{uid}` y `users/{uid}`.
 *   npx tsx scripts/backfill-user-levels.ts          (simulación, no escribe)
 *   npx tsx scripts/backfill-user-levels.ts --apply  (escribe)
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(root, 'serviceAccountKey.json')
const apply = process.argv.includes('--apply')

if (!existsSync(serviceAccountPath)) {
  console.error('Falta serviceAccountKey.json')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const db = getFirestore(process.env.VITE_FIREBASE_DATABASE_ID || 'adelia')

const levels = (await db.collection('levelCatalog').get()).docs
  .map((docSnap) => {
    const data = docSnap.data()
    return {
      level: typeof data.level === 'number' ? data.level : Number(docSnap.id),
      minXp: typeof data.minXp === 'number' ? data.minXp : Number(data.points),
    }
  })
  .filter((entry) => Number.isFinite(entry.level) && Number.isFinite(entry.minXp))
  .sort((a, b) => a.level - b.level)

if (levels.length === 0) {
  console.error('levelCatalog está vacío: no se puede calcular el nivel.')
  process.exit(1)
}
const levelForXp = (xp: number) => levels.reduce((current, entry) => (xp >= entry.minXp ? entry.level : current), levels[0].level)

let scanned = 0
let changed = 0
let last: FirebaseFirestore.QueryDocumentSnapshot | null = null
for (;;) {
  let page = db.collection('userGamification').orderBy('__name__').limit(200)
  if (last) page = page.startAfter(last)
  const snap = await page.get()
  if (snap.empty) break
  const batch = db.batch()
  let pageWrites = 0
  for (const docSnap of snap.docs) {
    scanned += 1
    const data = docSnap.data()
    const xp = typeof data.xp === 'number' ? data.xp : 0
    const level = levelForXp(xp)
    if (data.level !== level) {
      changed += 1
      pageWrites += 1
      console.log(`  ${docSnap.id.slice(0, 6)}… ${xp} XP → nivel ${level}${typeof data.level === 'number' ? ` (antes ${data.level})` : ''}`)
      if (apply) {
        batch.set(docSnap.ref, { level }, { merge: true })
        batch.set(db.collection('users').doc(docSnap.id), { level }, { merge: true })
      }
    }
  }
  if (apply && pageWrites > 0) await batch.commit()
  last = snap.docs[snap.docs.length - 1]
}
console.log(`${apply ? 'Aplicado' : 'Simulación'}: ${scanned} usuarios, ${changed} ${apply ? 'actualizados' : 'por actualizar'}.`)
