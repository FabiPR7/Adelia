/**
 * Completa `levelCatalog` con los niveles que falten (sin cambiar nombres ni XP
 * de los que ya hay) y arregla los topes: el de cada nivel es el inicio del
 * siguiente menos 1, y solo el último queda sin tope.
 *   npx tsx scripts/sync-level-catalog.ts          (simulación, no escribe)
 *   npx tsx scripts/sync-level-catalog.ts --apply  (escribe)
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { GAMIFICATION_LEVELS, PROFILE_REWARDS } from '../src/data/gamificationLevels.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(root, 'serviceAccountKey.json')
const apply = process.argv.includes('--apply')

if (!existsSync(serviceAccountPath)) {
  console.error('Falta serviceAccountKey.json')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) })
const db = getFirestore(process.env.VITE_FIREBASE_DATABASE_ID || 'adelia')

const snap = await db.collection('levelCatalog').get()
const existing = new Map<number, { minXp: number; maxXp: number | null; name: string }>()
for (const docSnap of snap.docs) {
  const data = docSnap.data()
  const level = typeof data.level === 'number' ? data.level : Number(docSnap.id)
  const minXp = typeof data.minXp === 'number' ? data.minXp : Number(data.points)
  if (Number.isFinite(level) && Number.isFinite(minXp)) {
    existing.set(level, { minXp, maxXp: data.maxXp ?? null, name: String(data.name ?? data.title ?? '') })
  }
}

const rewards = new Map(PROFILE_REWARDS.map((item) => [item.level, item.reward]))
const toCreate = GAMIFICATION_LEVELS.filter((entry) => !existing.has(entry.level))
const allMin = new Map<number, number>()
for (const [level, entry] of existing) allMin.set(level, entry.minXp)
for (const entry of toCreate) allMin.set(entry.level, entry.minXp)
const ordered = [...allMin.entries()].sort((a, b) => a[0] - b[0])

const batch = db.batch()
const lines: string[] = []
for (const entry of toCreate) {
  lines.push(`+ nivel ${entry.level} «${entry.title}» desde ${entry.minXp} XP`)
  batch.set(db.collection('levelCatalog').doc(String(entry.level)), {
    id: String(entry.level),
    level: entry.level,
    name: entry.title,
    title: entry.title,
    minXp: entry.minXp,
    points: entry.minXp,
    colors: entry.colors,
    styleClass: entry.styleClass,
    reward: rewards.get(entry.level) ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}
ordered.forEach(([level, minXp], index) => {
  const next = ordered[index + 1]
  const maxXp = next ? next[1] - 1 : null
  const current = existing.get(level)
  if (!current || current.maxXp !== maxXp) {
    if (current) lines.push(`~ nivel ${level} «${current.name}»: tope ${current.maxXp ?? 'sin tope'} → ${maxXp ?? 'sin tope'}`)
    batch.set(db.collection('levelCatalog').doc(String(level)), { maxXp, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  }
  if (next && next[1] <= minXp) lines.push(`! nivel ${next[0]} empieza en ${next[1]} XP, no por encima del ${level} (${minXp})`)
})

console.log(`En la base: ${existing.size} niveles.`)
console.log(lines.length ? lines.join('\n') : 'Nada que cambiar.')
if (apply && lines.length) {
  await batch.commit()
  console.log('Aplicado.')
} else if (lines.length) {
  console.log('Simulación: añade --apply para escribir.')
}
