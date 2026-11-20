import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { syncRestaurantIndex } from '../server/data/restaurantIndex.ts'

/**
 * El índice público de Buscar (restaurantIndex) lo escribe SOLO el servidor: cada vez
 * que cambia un local (datos, reseñas, desactivación…) se recalcula aquí. Antes lo
 * escribía el propio panel del restaurante desde el navegador.
 */
export const onCompanyWrittenSyncRestaurantIndex = onDocumentWritten(
  {
    document: 'companies/{companyId}',
    database: 'adelia',
    region: 'europe-southwest1',
  },
  async (event) => {
    const companyId = event.params.companyId
    const after = event.data?.after.data() ?? null
    try {
      await syncRestaurantIndex(companyId, after)
    } catch (error) {
      console.error(`Restaurant index sync failed for ${companyId}:`, error)
    }
  },
)
