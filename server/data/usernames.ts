import { FieldValue } from 'firebase-admin/firestore'
import { getBusinessRules } from '../config/businessRules.ts'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'

/**
 * @usuario único de cada cliente. La unicidad la garantiza la colección
 * `usernames/{usuario}` → { uid }, escrita solo por el servidor en una
 * transacción (las reglas no dejan al cliente tocarla ni el campo `username`).
 */
export const USERNAMES = 'usernames'

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/


export function normalizeUsername(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/^@+/, '').toLowerCase()
    : ''
}

/** Mensaje de error en español, o null si el @usuario es válido. */
export function usernameError(username: string): string | null {
  // Largo permitido: en la base de datos (appConfig/businessRules).
  const { usernameMin, usernameMax } = getBusinessRules()
  if (username.length < usernameMin || username.length > usernameMax) {
    return `Tu @usuario debe tener entre ${usernameMin} y ${usernameMax} caracteres.`
  }
  if (!USERNAME_RE.test(username)) {
    return 'Usa solo letras sin tilde, números, punto o guion bajo (sin empezar ni acabar por ellos).'
  }
  if (/[._]{2}/.test(username)) {
    return 'No pongas dos puntos o guiones bajos seguidos.'
  }
  if (getBusinessRules().reservedUsernames.includes(username) || username.startsWith('adelia')) {
    return 'Ese @usuario está reservado. Prueba con otro.'
  }
  return null
}

export function cleanDisplayName(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
    : ''
}

/** Nombre de persona: letras (con tildes), espacios, guiones, apóstrofos y puntos; sin números. */
export function displayNameError(name: string): string | null {
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return 'Escribe tu nombre (al menos 2 letras).'
  if (/\p{N}/u.test(name)) return 'El nombre no puede llevar números.'
  if (!/^[\p{L}\p{M} .'’-]+$/u.test(name)) return 'El nombre solo puede llevar letras, espacios y guiones.'
  return null
}

export async function isUsernameTaken(username: string, uid: string): Promise<boolean> {
  const snap = await adminDb.collection(USERNAMES).doc(username).get()
  return snap.exists && snap.data()?.uid !== uid
}

export class IdentityError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/**
 * Cambia nombre y/o @usuario del cliente. Si el @usuario cambia, libera el
 * anterior y reserva el nuevo en la misma transacción.
 */
export async function updateCustomerIdentity(
  uid: string,
  input: { displayName?: string; username?: string },
): Promise<{ displayName: string; username: string }> {
  const userRef = adminDb.collection(COLLECTIONS.users).doc(uid)

  return adminDb.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef)
    const user = userSnap.data()
    if (!user || user.role !== 'customer') {
      throw new IdentityError(404, 'Perfil no encontrado.')
    }

    const currentUsername = typeof user.username === 'string' ? user.username : ''
    const nextUsername = input.username ?? currentUsername
    const nextName = input.displayName ?? String(user.displayName ?? '')
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }

    if (input.username !== undefined && nextUsername !== currentUsername) {
      const newRef = adminDb.collection(USERNAMES).doc(nextUsername)
      const newSnap = await transaction.get(newRef)
      if (newSnap.exists && newSnap.data()?.uid !== uid) {
        throw new IdentityError(409, `@${nextUsername} ya está cogido. Prueba con otro.`)
      }
      if (currentUsername) {
        transaction.delete(adminDb.collection(USERNAMES).doc(currentUsername))
      }
      transaction.set(newRef, { uid, createdAt: FieldValue.serverTimestamp() })
      update.username = nextUsername
    }

    if (input.displayName !== undefined) {
      update.displayName = nextName
      update.displayNameLower = nextName.toLowerCase()
    }

    transaction.update(userRef, update)
    return { displayName: nextName, username: nextUsername }
  })
}

/** Al borrar la cuenta, el @usuario queda libre. */
export async function releaseUsername(uid: string, username: unknown): Promise<void> {
  const name = normalizeUsername(username)
  if (!name) return
  const ref = adminDb.collection(USERNAMES).doc(name)
  const snap = await ref.get()
  if (snap.exists && snap.data()?.uid === uid) {
    await ref.delete()
  }
}

/** Busca clientes por el principio de su @usuario (sin índices compuestos). */
export async function findUidsByUsernamePrefix(prefix: string, limit = 20): Promise<string[]> {
  const clean = normalizeUsername(prefix).replace(/[^a-z0-9._]/g, '')
  if (clean.length < 2) return []
  const snap = await adminDb.collection(USERNAMES)
    .orderBy('__name__')
    .startAt(clean)
    .endAt(`${clean}`)
    .limit(limit)
    .get()
  return snap.docs.map((doc) => String(doc.data().uid ?? '')).filter(Boolean)
}
