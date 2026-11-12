/**
 * Sube el tope de promociones del plan Local (premium) a 10 de cada tipo
 * en planCatalog/premium. Solo toca esos campos.
 *
 *   npx tsx scripts/set-local-promos.ts           # muestra lo que hay
 *   npx tsx scripts/set-local-promos.ts --write   # escribe
 */
import { readFileSync } from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const MAX = 10
const write = process.argv.includes('--write')
const key = JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? 'serviceAccountKey.json', 'utf8'))
const db = getFirestore(initializeApp({ credential: cert(key) }), process.env.VITE_FIREBASE_DATABASE_ID || 'adelia')
const ref = db.collection('planCatalog').doc('premium')
const data = (await ref.get()).data() ?? {}
console.log('caps ahora:', { offer: data.caps?.promos_offer, limited: data.caps?.promos_limited, attendance: data.caps?.promos_attendance })
console.log('specs ahora:', JSON.stringify(data.specs))
console.log('features ahora:', JSON.stringify(data.features))

const specs = Array.isArray(data.specs)
  ? data.specs.map((s: { label: string; value: string }) => s.label === 'Promos' ? { ...s, value: `${MAX} de cada tipo` } : s)
  : undefined
const features = Array.isArray(data.features)
  ? data.features.map((f: string) => f.replace(/^Hasta \d+ promociones de cada tipo/, `Hasta ${MAX} promociones de cada tipo`))
  : undefined

if (!write) {
  console.log('Simulación. Con --write quedaría:', { specs, features })
  process.exit(0)
}
await ref.update({
  'caps.promos_offer': MAX,
  'caps.promos_limited': MAX,
  'caps.promos_attendance': MAX,
  ...(specs ? { specs } : {}),
  ...(features ? { features } : {}),
})
console.log('Hecho.')
