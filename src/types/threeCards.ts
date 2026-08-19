export type ThreeCardsPhase =
  | 'pick_deck'
  | 'remove'
  | 'reveal'
  | 'showdown'
  | 'tie'
  | 'final_pick'
  | 'done'

export interface PublicThreeCardsCard {
  id: string
  rank: number | null
  removed: boolean
}

export interface PublicThreeCardsDeck {
  id: string
  takenBy: string | null
}

export interface PublicThreeCardsFinalCard {
  id: string
  rank: number | null
  takenBy: string | null
}

export interface ThreeCardsPublicState {
  phase: ThreeCardsPhase
  round: number
  tieCount: number
  turnUid: string | null
  turnDeadlineAt: string | null
  myDeckId: string | null
  rivalPicked: boolean
  decks: PublicThreeCardsDeck[]
  myCards: PublicThreeCardsCard[]
  rivalCards: PublicThreeCardsCard[]
  lastRemoved: { cardId: string; rank: number; fromUid: string; byUid: string } | null
  showdown: { myRank: number; rivalRank: number } | null
  finalCards: PublicThreeCardsFinalCard[]
  prompt: string
  iWon: boolean | null
}

export function cardRankLabel(rank: number): string {
  if (rank === 1) return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}
