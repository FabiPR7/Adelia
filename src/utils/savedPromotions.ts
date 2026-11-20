/**
 * Promos que el usuario ha "guardado" desde el modo Descubrir. Se guarda solo en
 * el navegador (localStorage), por usuario. No hay backend: es una lista de
 * marcadores para volver a ellas, no un canje.
 */

function storageKey(userKey: string): string {
  return `adelia_saved_promos_${userKey}`
}

export function readSavedPromotionIds(userKey: string): Set<string> {
  if (!userKey.trim() || typeof localStorage === 'undefined') {
    return new Set()
  }

  try {
    const raw = localStorage.getItem(storageKey(userKey))
    if (!raw) {
      return new Set()
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return new Set()
    }

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

/** Añade o quita el id y devuelve el nuevo conjunto (para setState). */
export function toggleSavedPromotionId(userKey: string, promotionId: string): Set<string> {
  const next = readSavedPromotionIds(userKey)

  if (next.has(promotionId)) {
    next.delete(promotionId)
  } else {
    next.add(promotionId)
  }

  if (userKey.trim() && promotionId.trim() && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKey(userKey), JSON.stringify([...next]))
    } catch {
      // Sin persistencia (modo privado, cuota llena): seguimos con el set en memoria.
    }
  }

  return next
}

/** Une las guardadas en el servidor con las que quedaran en este navegador. */
export function mergeSavedPromotionIds(remote: string[] | undefined, local: Set<string>): Set<string> {
  return new Set([...(remote ?? []), ...local])
}

/** Guarda la lista en el perfil (por la API), para verla igual en la web y en la app. */
export async function persistSavedPromotionIds(uid: string, ids: Set<string>): Promise<void> {
  if (!uid.trim()) {
    return
  }
  const { updateCustomerProfileViaApi } = await import('../services/customerFavoritesApi')
  await updateCustomerProfileViaApi({ savedPromotionIds: [...ids].slice(0, 200) })
}

/** Sustituye la copia del navegador por la lista completa. */
export function writeLocalSavedPromotionIds(userKey: string, ids: Set<string>): void {
  if (!userKey.trim() || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(storageKey(userKey), JSON.stringify([...ids]))
  } catch {
    // Sin persistencia local: el servidor sigue teniendo la lista.
  }
}

function migratedKey(userKey: string): string {
  return `adelia_saved_promos_migrated_${userKey}`
}

/** Indica si las guardadas de este navegador ya se subieron al perfil. */
export function isSavedPromotionsMigrated(userKey: string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(migratedKey(userKey)) === '1'
  } catch {
    return false
  }
}

export function markSavedPromotionsMigrated(userKey: string): void {
  try {
    localStorage.setItem(migratedKey(userKey), '1')
  } catch {
    // Sin almacenamiento: se volverá a intentar, sin daño.
  }
}
