import { adminDb } from '../firebase-admin.ts'
import { parseStoredPlanId, planMaxTables } from '../company/planLimits.ts'

/** Cuántas mesas puede ofrecer el local para reservar (respetando el máximo de su plan). */
export async function countBookableTables(companyId: string, planIdRaw: unknown): Promise<number> {
  // Consulta ligera (sin leer campos): un local tiene pocas mesas.
  const snapshot = await adminDb.collection('tables').where('companyId', '==', companyId).select().limit(200).get()
  const total = snapshot.size
  const max = planMaxTables(parseStoredPlanId(planIdRaw))
  return max == null ? total : Math.min(total, max)
}
