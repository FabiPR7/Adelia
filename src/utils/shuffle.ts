/**
 * Baraja determinista (Fisher–Yates con PRNG mulberry32). La misma `seed`
 * produce el mismo orden, así el barajado se mantiene estable entre renders
 * pero cambia cuando el usuario pide "volver a empezar" o recarga.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = items.slice()
  let state = seed >>> 0

  const random = () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}
