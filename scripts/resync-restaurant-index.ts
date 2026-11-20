/**
 * Vuelve a calcular el índice público de Buscar (restaurantIndex) de todos los locales
 * con el código del servidor: si se puede reservar (mesas) y los platos de la carta.
 * A partir de ahora lo hacen solos los disparadores; esto es para los locales que ya existían.
 *   npx tsx scripts/resync-restaurant-index.ts          (simulación, no escribe)
 *   npx tsx scripts/resync-restaurant-index.ts --apply  (escribe)
 */
import { adminDb } from '../server/firebase-admin.ts'
import { buildRestaurantIndexPayload, loadRestaurantIndexExtras, syncRestaurantIndex } from '../server/data/restaurantIndex.ts'

const apply = process.argv.includes('--apply')
const snapshot = await adminDb.collection('companies').limit(2000).get()
let done = 0

for (const doc of snapshot.docs) {
  const data = doc.data()
  if (apply) {
    await syncRestaurantIndex(doc.id, data)
  } else {
    const extras = await loadRestaurantIndexExtras(doc.id, data)
    const payload = buildRestaurantIndexPayload(doc.id, data, extras)
    console.log(`${String(data.slug ?? doc.id).padEnd(24)} reservar=${payload.canReserve} platos=${extras.dishNames.length}`)
  }
  done += 1
}

console.log(apply ? `\nÍndice recalculado en ${done} locales.` : `\nSimulación: ${done} locales. Nada escrito (usa --apply).`)
process.exit(0)
