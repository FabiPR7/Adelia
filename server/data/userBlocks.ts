import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'

/**
 * Bloqueos entre clientes: `userBlocks/{bloqueador}_{bloqueado}`. Solo los usa el
 * servidor (las reglas no dejan leerlos ni escribirlos desde la web o la app), así
 * nadie puede ver a quién ha bloqueado otra persona.
 */
export const MAX_BLOCKS_PER_USER = 200

export function userBlockId(blockerUid: string, blockedUid: string): string {
  return `${blockerUid}_${blockedUid}`
}

/** ¿Alguno de los dos ha bloqueado al otro? (2 lecturas) */
export async function isBlockedEitherWay(uidA: string, uidB: string): Promise<boolean> {
  const [ab, ba] = await adminDb.getAll(
    adminDb.collection(COLLECTIONS.userBlocks).doc(userBlockId(uidA, uidB)),
    adminDb.collection(COLLECTIONS.userBlocks).doc(userBlockId(uidB, uidA)),
  )
  return ab.exists || ba.exists
}

/** A quién has bloqueado tú (para la lista y para ocultar sus reseñas). */
export async function listBlockedByMe(uid: string): Promise<string[]> {
  const snap = await adminDb.collection(COLLECTIONS.userBlocks)
    .where('blockerUid', '==', uid)
    .limit(MAX_BLOCKS_PER_USER)
    .get()
  return snap.docs.map((docSnap) => String(docSnap.data().blockedUid ?? '')).filter(Boolean)
}

/** Todos con los que no hay trato: los que bloqueaste y los que te bloquearon. */
export async function listBlockedEitherWay(uid: string): Promise<Set<string>> {
  const [mine, theirs] = await Promise.all([
    listBlockedByMe(uid),
    adminDb.collection(COLLECTIONS.userBlocks)
      .where('blockedUid', '==', uid)
      .limit(MAX_BLOCKS_PER_USER)
      .get()
      .then((snap) => snap.docs.map((docSnap) => String(docSnap.data().blockerUid ?? ''))),
  ])
  return new Set([...mine, ...theirs].filter(Boolean))
}
