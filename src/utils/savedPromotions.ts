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
