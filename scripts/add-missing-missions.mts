/**
 * Añade a `missionCatalog` las misiones que existen en el código y faltan en la
 * base. No toca las que ya están (pueden tener XP cambiado desde el admin).
 * Sin esto el servidor no reconoce la misión y congela el XP del cliente.
 *
 *   npx tsx scripts/add-missing-missions.mts           # solo enseña lo que falta
 *   npx tsx scripts/add-missing-missions.mts --write   # las crea
 */
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../server/firebase-admin.ts'
import { allMissionDefinitions } from '../src/data/gamificationMissions.ts'

const write = process.argv.includes('--write')
const snap = await adminDb.collection('missionCatalog').get()
const existing = new Set(snap.docs.map((doc) => doc.id))
const missing = allMissionDefinitions().filter((mission) => !existing.has(mission.id))
console.log(`En la base: ${existing.size} · faltan: ${missing.length}`)
for (const mission of missing) console.log(`  ${mission.id} (${mission.cadence ?? 'historical'}, ${mission.xp} XP)`)
if (!write) {
  console.log('Simulación. Con --write se crean.')
  process.exit(0)
}
for (const mission of missing) {
  await adminDb.collection('missionCatalog').doc(mission.id).create({
    id: mission.id,
    name: mission.name,
    description: mission.description,
    xp: mission.xp,
    cadence: mission.cadence ?? 'historical',
    category: (mission as { category?: string }).category ?? null,
    icon: mission.icon,
    target: mission.target,
    updatedAt: FieldValue.serverTimestamp(),
  })
}
console.log('Hecho.')
process.exit(0)
