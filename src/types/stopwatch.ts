export type StopwatchPhase = 'idle' | 'running' | 'done'

export interface StopwatchPublicState {
  phase: StopwatchPhase
  round: number
  turnIndex: number
  targetHundredths: number
  roundTargets: number[]
  myTimes: number[]
  rivalTimes: number[]
  myError: number
  rivalError: number
  myTurn: boolean
  canStart: boolean
  canStop: boolean
  running: boolean
  rivalRunning: boolean
  startedAt: string | null
  iWon: boolean | null
  prompt: string
}

export function formatStopwatch(hundredths: number): string {
  const safe = Math.max(0, hundredths) / 100
  return safe.toFixed(2).replace('.', ',')
}

export function errorForStopwatch(timeHundredths: number, targetHundredths: number): number {
  return Math.abs(timeHundredths - targetHundredths)
}
