import 'dotenv/config'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
  path.join(__dirname, '..', 'serviceAccountKey.json')

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

const DEMO_COMPANY_IDS = ['comp_taqueria_01', 'comp_rincon_01']
const DEMO_AUTH_EMAILS = ['la-taqueria@adelia.app', 'el-rincon@adelia.app']
const DEMO_LOGIN_SLUGS = ['la-taqueria', 'el-rincon']

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function deleteCompany(db, auth, companyId) {
  const companySnap = await db.collection('companies').doc(companyId).get()

  if (!companySnap.exists) {
    console.log(`  · ${companyId}: no existe, omitido`)
    return
  }

  const companyData = companySnap.data()
  const ownerUid = companyData?.ownerUid
  const loginName = companyData?.name

  const reservations = await db
    .collection('reservations')
    .where('companyId', '==', companyId)
    .get()

  const tables = await db.collection('tables').where('companyId', '==', companyId).get()

  const batch = db.batch()
  reservations.docs.forEach((doc) => batch.delete(doc.ref))
  tables.docs.forEach((doc) => batch.delete(doc.ref))
  batch.delete(db.collection('companies').doc(companyId))
  batch.delete(db.collection('companyCredentials').doc(companyId))
  await batch.commit()

  if (loginName) {
    await db.collection('logins').doc(slugify(loginName)).delete().catch(() => {})
  }

  if (ownerUid) {
    await db.collection('users').doc(ownerUid).delete().catch(() => {})
    try {
      await auth.deleteUser(ownerUid)
    } catch {
      // ya eliminado
    }
  }

  console.log(`  ✓ Eliminada: ${loginName ?? companyId}`)
}

async function deleteAuthByEmail(auth, email) {
  try {
    const user = await auth.getUserByEmail(email)
    await auth.deleteUser(user.uid)
    console.log(`  ✓ Auth eliminado: ${email}`)
  } catch {
    console.log(`  · Auth no encontrado: ${email}`)
  }
}

async function cleanup() {
  if (!existsSync(serviceAccountPath)) {
    throw new Error('Falta serviceAccountKey.json en la raíz del proyecto.')
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) })
  }

  const db = getFirestore(undefined, databaseId)
  const auth = getAuth()

  console.log('\nEliminando empresas de prueba…\n')

  for (const companyId of DEMO_COMPANY_IDS) {
    await deleteCompany(db, auth, companyId)
  }

  for (const email of DEMO_AUTH_EMAILS) {
    await deleteAuthByEmail(auth, email)
  }

  for (const slug of DEMO_LOGIN_SLUGS) {
    await db.collection('logins').doc(slug).delete().catch(() => {})
  }

  console.log('\n✅ Limpieza completada. Solo quedan empresas reales.\n')
}

cleanup().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
