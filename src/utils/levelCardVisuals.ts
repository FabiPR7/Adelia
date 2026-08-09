export interface LevelCardVisualTheme {
  emblem: string
  pillIcon: string
  dividerIcon: string
}

export const LEVEL_CARD_VISUALS: Record<number, LevelCardVisualTheme> = {
  1: { emblem: '👨‍🍳', pillIcon: '👨‍🍳', dividerIcon: '🍃' },
  2: { emblem: '🧭', pillIcon: '🧭', dividerIcon: '🌿' },
  3: { emblem: '🏪', pillIcon: '🏪', dividerIcon: '⚜️' },
  4: { emblem: '🛡️', pillIcon: '🍴', dividerIcon: '⚜️' },
  5: { emblem: '🏷️', pillIcon: '🏷️', dividerIcon: '✦' },
  6: { emblem: '🔔', pillIcon: '🔔', dividerIcon: '⚜️' },
  7: { emblem: '👑', pillIcon: '🍴', dividerIcon: '⚜️' },
  8: { emblem: '👑', pillIcon: '👑', dividerIcon: '💎' },
  9: { emblem: '⭐', pillIcon: '⭐', dividerIcon: '✦' },
  10: { emblem: '🔥', pillIcon: '🔥', dividerIcon: '✦' },
  11: { emblem: '💫', pillIcon: '💫', dividerIcon: '✦' },
  12: { emblem: '🔥', pillIcon: '👨‍🍳', dividerIcon: '👑' },
}

export function getLevelCardVisuals(level: number): LevelCardVisualTheme {
  return LEVEL_CARD_VISUALS[level] ?? LEVEL_CARD_VISUALS[1]
}
