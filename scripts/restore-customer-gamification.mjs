/**
 * Restaura el progreso de un cliente al estado que tenía en un momento anterior.
 *
 * Paso 1, solo lee (hasta 1 hora atrás, la retención de versiones de Firestore):
 *   node scripts/restore-customer-gamification.mjs <email> --before=2026-11-06T19:06:00Z
 *   Enseña las diferencias y guarda una copia en .restore-backups/.
 *
 * Paso 2, escribe (usa esa copia, así que ya no depende de la hora):
 *   node scripts/restore-customer-gamification.mjs --apply=.restore-backups/<archivo>.json
 *   Restaura users y userGamification, y borra los avisos creados después.
 */
import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

const BACKUP_DIR = '.restore-backups'
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

const args = process.argv.slice(2)
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? ''
const email = (args.find((arg) => !arg.startsWith('--')) ?? '').trim().toLowerCase()
const before = option('before')
const applyPath = option('apply')

if (!applyPath && (!email || !before)) {
  console.error('Uso: node scripts/restore-customer-gamification.mjs <email> --before=<fecha ISO>')
  console.error('     node scripts/restore-customer-gamification.mjs --apply=<copia.json>')
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))),
  })
}

const db = getFirestore(undefined, databaseId)

const toJson = (value) => JSON.stringify(value, null, 2)
const fromJson = (text) => JSON.parse(text, (_key, value) => (
  value && typeof value === 'object'
  && Object.keys(value).length === 2
  && typeof value._seconds === 'number'
  && typeof value._nanoseconds === 'number'
    ? new Timestamp(value._seconds, value._nanoseconds)
    : value
))

const list = (value) => (Array.isArray(value) ? value : [])

function printDifferences(past, current) {
  const pastState = past?.state ?? {}
  const currentState = current?.state ?? {}
  console.log(`XP: ${past?.xp} (antes) -> ${current?.xp} (ahora)`)
  console.log(`Adelinas: ${past?.adelinas} -> ${current?.adelinas}`)
  console.log(`Nivel celebrado: ${pastState.lastCelebratedLevel} -> ${currentState.lastCelebratedLevel}`)
  for (const key of ['completedMissions', 'weeklyCompleted', 'monthlyCompleted', 'visitedCompanyIds', 'reviewedReservationIds', 'awardedReservationXpIds', 'grantedItemKeys']) {
    const pastIds = new Set(list(pastState[key]))
    const added = list(currentState[key]).filter((id) => !pastIds.has(id))
    console.log(`${key}: ${pastIds.size} -> ${list(currentState[key]).length} (nuevos: ${added.length})`)
  }
  const pastInventory = pastState.inventory ?? {}
  const currentInventory = currentState.inventory ?? {}
  const changed = [...new Set([...Object.keys(pastInventory), ...Object.keys(currentInventory)])]
    .filter((id) => (pastInventory[id] ?? 0) !== (currentInventory[id] ?? 0))
    .map((id) => `${id}: ${pastInventory[id] ?? 0} -> ${currentInventory[id] ?? 0}`)
  console.log(`Inventario cambiado: ${changed.length ? changed.join(', ') : 'nada'}`)
}

async function readCurrent(uid) {
  const [userSnap, statsSnap, notificationsSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('userGamification').doc(uid).get(),
    db.collection('users').doc(uid).collection('notifications').get(),
  ])
  return {
    user: userSnap.data() ?? null,
    stats: statsSnap.data() ?? null,
    notificationIds: notificationsSnap.docs.map((docSnap) => docSnap.id),
  }
}

function backupFile(label, uid) {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(BACKUP_DIR, `${label}-${uid}-${stamp}.json`)
}

async function snapshot() {
  const readTime = Timestamp.fromDate(new Date(before))
  if (Number.isNaN(new Date(before).getTime())) {
    throw new Error(`Fecha no válida: ${before}`)
  }

  const users = await db.collection('users').where('email', '==', email).limit(2).get()
  if (users.size !== 1) {
    throw new Error(`Se esperaba 1 usuario con ese correo y hay ${users.size}.`)
  }
  const uid = users.docs[0].id
  const userRef = db.collection('users').doc(uid)
  const statsRef = db.collection('userGamification').doc(uid)

  const past = await db.runTransaction(async (transaction) => {
    const [userSnap, statsSnap, notificationsSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(statsRef),
      transaction.get(userRef.collection('notifications')),
    ])
    return {
      user: userSnap.data() ?? null,
      stats: statsSnap.data() ?? null,
      notificationIds: notificationsSnap.docs.map((docSnap) => docSnap.id),
    }
  }, { readOnly: true, readTime })

  if (!past.user || !past.stats) {
    throw new Error('No hay datos del cliente en ese momento: no se ha guardado nada.')
  }

  const current = await readCurrent(uid)
  const file = backupFile('snapshot', uid)
  writeFileSync(file, toJson({ uid, email, before, past, current }))

  printDifferences(past.stats, current.stats)
  const newNotifications = current.notificationIds.filter((id) => !past.notificationIds.includes(id))
  console.log(`Avisos creados después: ${newNotifications.length}`)
  console.log(`\nNo se ha escrito nada en la base de datos. Copia guardada en ${file}`)
  console.log('Para restaurar:')
  console.log(`  node scripts/restore-customer-gamification.mjs --apply=${file}`)
}

async function apply() {
  const { uid, past } = fromJson(readFileSync(applyPath, 'utf8'))
  const current = await readCurrent(uid)

  // Copia de lo que se va a sustituir, por si hubiera que deshacer la restauración.
  const file = backupFile('before-apply', uid)
  writeFileSync(file, toJson({ uid, current }))

  const userRef = db.collection('users').doc(uid)
  const batch = db.batch()
  batch.set(db.collection('userGamification').doc(uid), past.stats)
  batch.set(userRef, {
    xp: past.user.xp ?? FieldValue.delete(),
    adelinas: past.user.adelinas ?? FieldValue.delete(),
    gamification: past.user.gamification ?? FieldValue.delete(),
  }, { merge: true })
  const newNotifications = current.notificationIds.filter((id) => !past.notificationIds.includes(id))
  for (const id of newNotifications) {
    batch.delete(userRef.collection('notifications').doc(id))
  }
  await batch.commit()

  console.log(`Restaurado ${uid}: XP ${current.stats?.xp} -> ${past.stats.xp}`)
  console.log(`Avisos borrados: ${newNotifications.length}`)
  console.log(`Copia del estado anterior a restaurar: ${file}`)
}

await (applyPath ? apply() : snapshot())
process.exit(0)
