import { adminDb } from '../firebase-admin.ts'

/**
 * Reglas de los minijuegos de las reservas (tiempos, tamaños, rangos). Salen de la
 * base de datos (`gameConfig/minigames`) para poder ajustarlas sin publicar; si no
 * hay documento o un valor no es válido, se usan estos valores por defecto.
 */
export interface MinigameRules {
  hotCold: { min: number; max: number; guessCountdownMs: number; tieMs: number }
  maze: { size: number; countdownMs: number }
  oddsEvens: { turnMs: number; revealMs: number }
  stopwatch: { maxRunMs: number; minTarget: number; maxTarget: number }
  threeCards: { turnMs: number; revealMs: number; showdownMs: number; tieMs: number }
}

export const DEFAULT_MINIGAME_RULES: MinigameRules = {
  hotCold: { min: 1, max: 99, guessCountdownMs: 3_000, tieMs: 80 },
  maze: { size: 15, countdownMs: 5_000 },
  oddsEvens: { turnMs: 15_000, revealMs: 3_400 },
  stopwatch: { maxRunMs: 20_000, minTarget: 300, maxTarget: 1_000 },
  threeCards: { turnMs: 15_000, revealMs: 2_800, showdownMs: 4_500, tieMs: 3_200 },
}

/** Límites de cordura: aunque alguien ponga un valor raro, el juego no se rompe. */
const BOUNDS: { [G in keyof MinigameRules]: { [K in keyof MinigameRules[G]]: [number, number] } } = {
  hotCold: { min: [1, 50], max: [10, 1_000], guessCountdownMs: [500, 15_000], tieMs: [0, 1_000] },
  maze: { size: [7, 17], countdownMs: [1_000, 15_000] },
  oddsEvens: { turnMs: [5_000, 60_000], revealMs: [1_000, 10_000] },
  stopwatch: { maxRunMs: [5_000, 60_000], minTarget: [100, 5_000], maxTarget: [200, 10_000] },
  threeCards: { turnMs: [5_000, 60_000], revealMs: [1_000, 10_000], showdownMs: [1_000, 15_000], tieMs: [1_000, 10_000] },
}

const CACHE_MS = 5 * 60_000
let current: MinigameRules = DEFAULT_MINIGAME_RULES
let loadedAt = 0
let inFlight: Promise<void> | null = null

function parse(raw: Record<string, unknown> | undefined): MinigameRules {
  const next = structuredClone(DEFAULT_MINIGAME_RULES) as unknown as Record<string, Record<string, number>>
  for (const [game, fields] of Object.entries(BOUNDS) as Array<[string, Record<string, [number, number]>]>) {
    const source = raw?.[game]
    if (!source || typeof source !== 'object') continue
    for (const [field, [low, high]] of Object.entries(fields)) {
      const value = Number((source as Record<string, unknown>)[field])
      if (Number.isFinite(value) && value >= low && value <= high) next[game][field] = Math.round(value)
    }
  }
  const rules = next as unknown as MinigameRules
  if (rules.hotCold.max <= rules.hotCold.min) rules.hotCold = { ...DEFAULT_MINIGAME_RULES.hotCold }
  if (rules.stopwatch.maxTarget <= rules.stopwatch.minTarget) rules.stopwatch = { ...DEFAULT_MINIGAME_RULES.stopwatch }
  // El laberinto necesita un tamaño impar.
  if (rules.maze.size % 2 === 0) rules.maze.size += 1
  return rules
}

/** Carga (o refresca cada 5 minutos) las reglas. Si falla, sigue con las últimas buenas. */
export async function ensureMinigameRules(): Promise<void> {
  if (loadedAt > 0 && Date.now() - loadedAt < CACHE_MS) return
  if (!inFlight) {
    inFlight = adminDb.collection('gameConfig').doc('minigames').get()
      .then((snap) => {
        current = parse(snap.data())
        loadedAt = Date.now()
      })
      .catch((error) => {
        console.error('Minigame rules load error:', error)
        loadedAt = Date.now()
      })
      .finally(() => {
        inFlight = null
      })
  }
  await inFlight
}

export function getMinigameRules(): MinigameRules {
  return current
}

/** Solo para pruebas. */
export function setMinigameRulesForTests(raw: Record<string, unknown> | undefined): void {
  current = parse(raw)
  loadedAt = Date.now()
}
