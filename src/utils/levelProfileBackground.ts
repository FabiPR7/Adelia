import { getStripBackground } from './levelRankingStripAssets'
import { GAMIFICATION_LEVELS } from '../data/gamificationLevels'

/** Fondos de perfil por nivel (assets de ranking strip). */
export function getLevelProfileBackground(level: number): string {
  const clamped = Math.min(12, Math.max(1, level))
  return getStripBackground(clamped)
}

export function getLevelProfileAccent(level: number): string {
  const clamped = Math.min(12, Math.max(1, level))
  const defined = GAMIFICATION_LEVELS.find((entry) => entry.level === clamped)
  return defined?.colors[0] ?? '#7c3aed'
}
