export type HotColdPhase = 'pick_secret' | 'probe' | 'guess' | 'done'
export type HotColdTemperature = 'boiling' | 'hot' | 'warm' | 'cold' | 'freezing'
export type HotColdDirection = 'higher' | 'lower' | 'exact'
export type HotColdGuessOutcome = 'tie' | 'both_miss'

export interface HotColdClue {
  round: number
  pick: number
  temperature: HotColdTemperature
  direction: HotColdDirection
  distance: number
}

export interface HotColdPublicState {
  phase: HotColdPhase
  round: number
  options: number[]
  mySecret: number | null
  myPick: number | null
  rivalReady: boolean
  rivalPicked: boolean
  rivalHasSecret: boolean
  clues: HotColdClue[]
  lastTemperature: HotColdTemperature | null
  lastDirection: HotColdDirection | null
  guessStartAt: string | null
  canPick: boolean
  guessAttempt: number
  lastGuessOutcome: HotColdGuessOutcome | null
  iWon: boolean | null
  winnerUid: string | null
  rivalSecret: number | null
  myGuess: number | null
  rivalGuess: number | null
  prompt: string
}

export const HOT_COLD_TEMPERATURE_LABELS: Record<HotColdTemperature, string> = {
  boiling: 'Muy caliente',
  hot: 'Caliente',
  warm: 'Tibio',
  cold: 'Frío',
  freezing: 'Muy frío',
}

export const HOT_COLD_DIRECTION_LABELS: Record<HotColdDirection, string> = {
  higher: 'Más alto',
  lower: 'Más bajo',
  exact: 'Clavado',
}

export const HOT_COLD_HEAT_RANK: Record<HotColdTemperature, number> = {
  freezing: 1,
  cold: 2,
  warm: 3,
  hot: 4,
  boiling: 5,
}

export function hotColdCountdownLabel(startAt: string | null | undefined, now: number): string | null {
  if (!startAt) {
    return null
  }
  const remain = Date.parse(startAt) - now
  if (!Number.isFinite(remain)) {
    return null
  }
  if (remain > 0) {
    return String(Math.max(1, Math.ceil(remain / 1000)))
  }
  if (remain > -520) {
    return '¡Ya!'
  }
  return null
}

export function hotColdRaceOpen(startAt: string | null | undefined, now: number): boolean {
  if (!startAt) {
    return true
  }
  const at = Date.parse(startAt)
  return Number.isFinite(at) && now >= at
}
