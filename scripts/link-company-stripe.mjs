/**
 * Vincula una cuenta Stripe Connect existente (modo test) a un restaurante por slug.
 *
 * Uso:
 *   node scripts/link-company-stripe.mjs
 *   node scripts/link-company-stripe.mjs carol acct_xxx
 *
 * Requiere: STRIPE_SECRET_KEY, serviceAccountKey.json, VITE_FIREBASE_DATABASE_ID
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'
const companySlug = process.argv[2] || process.env.SEED_COMPANY_SLUG || 'carol'
const stripeAccountId = process.argv[3]
  || process.env.TEST_RESTAURANTE_STRIPE_ID
  || process.env.CAROL_STRIPE_ACCOUNT_ID

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()

if (!stripeSecretKey) {
  console.error('Falta STRIPE_SECRET_KEY en .env')
  process.exit(1)
}

if (!stripeAccountId) {
  console.error('Indica la cuenta Connect: TEST_RESTAURANTE_STRIPE_ID en .env o como segundo argumento.')
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))),
  })
}

const db = getFirestore(undefined, databaseId)
const stripe = new Stripe(stripeSecretKey)

const companiesSnap = await db
  .collection('companies')
  .where('slug', '==', companySlug)
  .limit(1)
  .get()

if (companiesSnap.empty) {
  console.error(`No se encontró empresa con slug "${companySlug}".`)
  process.exit(1)
}

const companyRef = companiesSnap.docs[0].ref
const companyName = companiesSnap.docs[0].data().name

const account = await stripe.accounts.retrieve(stripeAccountId)

await companyRef.set(
  {
    stripeAccountId: account.id,
    stripeChargesEnabled: account.charges_enabled === true,
    stripePayoutsEnabled: account.payouts_enabled === true,
    stripeDetailsSubmitted: account.details_submitted === true,
    updatedAt: Timestamp.now(),
  },
  { merge: true },
)

console.log(`Stripe Connect vinculado a ${companyName} (${companySlug})`)
console.log(`  Cuenta: ${account.id}`)
console.log(`  Cobros activos: ${account.charges_enabled ? 'sí' : 'no'}`)
console.log(`  Onboarding completo: ${account.details_submitted ? 'sí' : 'no'}`)

if (!account.charges_enabled) {
  console.log('\nLa cuenta aún no puede cobrar. Completa el onboarding en Stripe Dashboard o usa el botón del panel.')
}
