export interface AppendOnlyMerge {
  ids: string[]
  /** Válidas, pero superan el tope de esta llamada: entran en la siguiente. */
  deferred: string[]
  /** No están en el catálogo: se ignoran. */
  unknown: string[]
}

/**
 * Añade misiones nuevas sin quitar ninguna. Nunca rechaza la llamada: el
 * navegador reenvía siempre la misma lista, así que un error aquí dejaría a la
 * persona sin guardar progreso para siempre.
 */
export function mergeAppendOnlyIds(
  currentIds: string[],
  proposedIds: string[],
  allowedNew: Set<string>,
  maxNew: number,
): AppendOnlyMerge {
  const current = new Set(currentIds)
  const additions = proposedIds.filter((id) => !current.has(id))
  const valid = additions.filter((id) => allowedNew.has(id))

  return {
    ids: [...new Set([...currentIds, ...valid.slice(0, maxNew)])],
    deferred: valid.slice(maxNew),
    unknown: additions.filter((id) => !allowedNew.has(id)),
  }
}

/** Listas de progreso que solo crecen: lo que falte en el navegador no se pierde. */
export function mergeMonotonicIds(currentIds: string[], proposedIds: string[], max = 200): string[] {
  return [...new Set([...currentIds, ...proposedIds])].slice(0, max)
}
