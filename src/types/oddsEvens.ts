export type OddsEvensPhase = 'choose_side' | 'pick_number' | 'reveal' | 'done'
export type OddsEvensSide = 'even' | 'odd'

export interface OddsEvensPublicState {
  phase: OddsEvensPhase
  round: number
  chooserUid: string
  mySide: OddsEvensSide | null
  rivalSide: OddsEvensSide | null
  myScore: number
  rivalScore: number
  myPick: number | null
  rivalPicked: boolean
  rivalPick: number | null
  pickDeadlineAt: string | null
  chooseDeadlineAt: string | null
  revealUntil: string | null
  lastSum: number | null
  lastParity: OddsEvensSide | null
  lastRoundWinnerUid: string | null
  iWonRound: boolean | null
  iWon: boolean | null
  autoPicked: boolean
  prompt: string
  rounds: OddsEvensRoundPublic[]
}

export interface OddsEvensRoundPublic {
  round: number
  myPick: number
  rivalPick: number
  sum: number
  parity: OddsEvensSide
  iWon: boolean
}

export function oddsEvensSideLabel(side: OddsEvensSide | null): string {
  if (side === 'even') {
    return 'pares'
  }
  if (side === 'odd') {
    return 'nones'
  }
  return ''
}
