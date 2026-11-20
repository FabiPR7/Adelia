import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { adminDb } from '../server/firebase-admin.ts'
import { syncRestaurantIndex } from '../server/data/restaurantIndex.ts'

/**
 * El índice público de Buscar (restaurantIndex) lo escribe SOLO el servidor: cada vez
 * que cambia un local (datos, reseñas, desactivación…), sus mesas o su carta, se
 * recalcula aquí. Antes lo escribía el propio panel del restaurante desde el navegador.
 */
const base = { database: 'adelia', region: 'europe-southwest1' } as const

async function resyncCompany(companyId: string): Promise<void> {
  if (!companyId) return
  try {
    const snap = await adminDb.collection('companies').doc(companyId).get()
    await syncRestaurantIndex(companyId, snap.exists ? snap.data() ?? null : null)
  } catch (error) {
    console.error(`Restaurant index sync failed for ${companyId}:`, error)
  }
}

export const onCompanyWrittenSyncRestaurantIndex = onDocumentWritten(
  { ...base, document: 'companies/{companyId}' },
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

/** Mesas: decide si el local se puede reservar («Reservar» en las tarjetas de Buscar). */
export const onTableWrittenSyncRestaurantIndex = onDocumentWritten(
  { ...base, document: 'tables/{tableId}' },
  async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data()
    await resyncCompany(typeof data?.companyId === 'string' ? data.companyId : '')
  },
)

/** Carta: los platos entran en la búsqueda («buscar por plato»). */
export const onMenuNodeWrittenSyncRestaurantIndex = onDocumentWritten(
  { ...base, document: 'companies/{companyId}/menuNodes/{nodeId}' },
  async (event) => {
    await resyncCompany(event.params.companyId)
  },
)

export const onMenuBoardWrittenSyncRestaurantIndex = onDocumentWritten(
  { ...base, document: 'companies/{companyId}/menuBoards/{boardId}' },
  async (event) => {
    await resyncCompany(event.params.companyId)
  },
)
