import {
  CHALLENGE_MINIGAME_IDS,
  CHALLENGE_MINIGAME_LABELS,
  type ChallengeMinigameId,
} from '../types/reservationChallenges'

export { CHALLENGE_MINIGAME_IDS, CHALLENGE_MINIGAME_LABELS }

export function pickRandomChallengeMinigame(): ChallengeMinigameId {
  const index = Math.floor(Math.random() * CHALLENGE_MINIGAME_IDS.length)
  return CHALLENGE_MINIGAME_IDS[index] ?? 'three_cards'
}

export function challengeMinigameLabel(id: ChallengeMinigameId): string {
  return CHALLENGE_MINIGAME_LABELS[id]
}
