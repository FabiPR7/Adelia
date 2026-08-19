import type { ThreeCardsPublicState } from './threeCards'
import type { OddsEvensPublicState } from './oddsEvens'
import type { StopwatchPublicState } from './stopwatch'
import type { MazePublicState } from './maze'
import type { HotColdPublicState } from './hotCold'

export const CHALLENGE_MINIGAME_IDS = ['three_cards', 'odds_evens', 'stopwatch', 'maze', 'hot_cold'] as const

export type ChallengeMinigameId = (typeof CHALLENGE_MINIGAME_IDS)[number]

export type ReservationChallengeStatus = 'ringing' | 'active' | 'resolved' | 'declined' | 'cancelled'

export interface ReservationChallenge {
  id: string
  reservationId: string
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  startTime: string
  pax: number
  challengerUid: string
  challengerDisplayName: string
  challengerPhotoUrl: string
  challengedUid: string
  challengedDisplayName: string
  challengedPhotoUrl: string
  minigameId: ChallengeMinigameId
  status: ReservationChallengeStatus
  winnerUid: string | null
  resultAckedUids: string[]
  createdAt: string
  updatedAt: string
  threeCards?: ThreeCardsPublicState | null
  oddsEvens?: OddsEvensPublicState | null
  stopwatch?: StopwatchPublicState | null
  maze?: MazePublicState | null
  hotCold?: HotColdPublicState | null
}

export const CHALLENGE_MINIGAME_LABELS: Record<ChallengeMinigameId, string> = {
  three_cards: '3 cartas',
  odds_evens: 'Pares y nones',
  stopwatch: 'Cronómetro',
  maze: 'Laberinto',
  hot_cold: 'Frío y caliente',
}

export function isLiveChallengeStatus(status: ReservationChallengeStatus): boolean {
  return status === 'ringing' || status === 'active' || status === 'resolved'
}
