/**
 * Guarda en la base de datos (appConfig/businessRules) las reglas de negocio que antes
 * estaban fijas en el código. Solo rellena los campos que falten: si ya se cambió alguno
 * en la base, no lo pisa.
 *   npx tsx scripts/seed-business-rules.ts          (simulación)
 *   npx tsx scripts/seed-business-rules.ts --apply  (escribe)
 */
import { adminDb } from '../server/firebase-admin.ts'
import { EMERGENCY_BUSINESS_RULES } from '../server/config/businessRules.ts'

const apply = process.argv.includes('--apply')
const ref = adminDb.collection('appConfig').doc('businessRules')
const current = (await ref.get()).data() ?? {}
const missing = Object.fromEntries(
  Object.entries(EMERGENCY_BUSINESS_RULES).filter(([key]) => !(key in current)),
)
console.log(Object.keys(missing).length === 0 ? 'Ya está todo en la base de datos.' : `Faltan: ${Object.keys(missing).join(', ')}`)
if (apply && Object.keys(missing).length > 0) {
  await ref.set({ ...missing, updatedBy: 'script:seed-business-rules' }, { merge: true })
  console.log('Guardado en appConfig/businessRules.')
}
process.exit(0)
