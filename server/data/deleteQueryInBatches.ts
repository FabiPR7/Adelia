import type { CollectionReference, Query } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'

const DEFAULT_PAGE = 400

/**
 * Borra todos los documentos de una query en páginas, respetando el límite
 * de 500 operaciones por batch de Firestore.
 */
export async function deleteQueryInBatches(
  query: Query | CollectionReference,
  pageSize = DEFAULT_PAGE,
): Promise<number> {
  let deleted = 0

  for (;;) {
    const snap = await query.limit(pageSize).get()
    if (snap.empty) {
      break
    }

    const batch = adminDb.batch()
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref))
    await batch.commit()
    deleted += snap.size

    if (snap.size < pageSize) {
      break
    }
  }

  return deleted
}
