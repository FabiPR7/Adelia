export type LevelBadgeOrnament =
  | 'rustic'
  | 'vine'
  | 'wave'
  | 'crystal'
  | 'arcane'
  | 'flame'
  | 'royal'
  | 'nebula'
  | 'mystic'
  | 'titan'
  | 'legend'
  | 'divine'

export interface LevelProfileBadgeTheme {
  tagline: string
  ornament: LevelBadgeOrnament
  /** Gradiente del marco exterior */
  frameGradient: string
  /** Fondo interior del badge */
  innerBg: string
  /** Resplandor detrás del emblema */
  emblemGlow: string
  /** Animación decorativa (null = ninguna) */
  animation: 'shimmer' | 'pulse' | 'holo' | 'flame' | 'divine' | null
}

export const LEVEL_PROFILE_BADGE_THEMES: Record<number, LevelProfileBadgeTheme> = {
  1: {
    tagline: 'Donde empieza la aventura',
    ornament: 'rustic',
    frameGradient: 'linear-gradient(135deg, #c4956a, #8b6914, #c4956a)',
    innerBg: 'linear-gradient(165deg, rgba(255, 248, 239, 0.94), rgba(232, 220, 200, 0.88))',
    emblemGlow: 'radial-gradient(circle, rgba(212, 165, 116, 0.55), transparent 70%)',
    animation: 'shimmer',
  },
  2: {
    tagline: 'Cada mesa, un descubrimiento',
    ornament: 'vine',
    frameGradient: 'linear-gradient(135deg, #4ade80, #059669, #7ecf98)',
    innerBg: 'linear-gradient(165deg, rgba(6, 78, 59, 0.82), rgba(4, 47, 46, 0.72))',
    emblemGlow: 'radial-gradient(circle, rgba(74, 222, 128, 0.45), transparent 70%)',
    animation: 'shimmer',
  },
  3: {
    tagline: 'El barrio entero te conoce',
    ornament: 'wave',
    frameGradient: 'linear-gradient(135deg, #2dd4bf, #0d9488, #5eead4)',
    innerBg: 'linear-gradient(165deg, rgba(15, 118, 110, 0.84), rgba(8, 51, 68, 0.76))',
    emblemGlow: 'radial-gradient(circle, rgba(45, 212, 191, 0.42), transparent 70%)',
    animation: 'shimmer',
  },
  4: {
    tagline: 'Tu paladar manda',
    ornament: 'crystal',
    frameGradient: 'linear-gradient(135deg, #60a5fa, #2563eb, #93c5fd)',
    innerBg: 'linear-gradient(165deg, rgba(30, 58, 138, 0.86), rgba(15, 23, 42, 0.78))',
    emblemGlow: 'radial-gradient(circle, rgba(96, 165, 250, 0.48), transparent 70%)',
    animation: 'shimmer',
  },
  5: {
    tagline: 'La mesa es tu escenario',
    ornament: 'arcane',
    frameGradient: 'linear-gradient(135deg, #d8b4fe, #7c3aed, #c084fc)',
    innerBg: 'linear-gradient(165deg, rgba(76, 29, 149, 0.88), rgba(46, 16, 72, 0.8))',
    emblemGlow: 'radial-gradient(circle, rgba(216, 180, 254, 0.5), transparent 70%)',
    animation: 'flame',
  },
  6: {
    tagline: 'Historias en cada plato',
    ornament: 'flame',
    frameGradient: 'linear-gradient(135deg, #fbbf24, #b45309, #fde68a)',
    innerBg: 'linear-gradient(165deg, rgba(74, 7, 24, 0.9), rgba(58, 8, 24, 0.82))',
    emblemGlow: 'radial-gradient(circle, rgba(251, 191, 36, 0.55), transparent 70%)',
    animation: 'flame',
  },
  7: {
    tagline: 'Oro puro en cada bocado',
    ornament: 'royal',
    frameGradient: 'linear-gradient(135deg, #ffd700, #b8860b, #d4af37)',
    innerBg: 'linear-gradient(165deg, rgba(66, 32, 6, 0.92), rgba(26, 16, 6, 0.84))',
    emblemGlow: 'radial-gradient(circle, rgba(255, 215, 0, 0.55), transparent 70%)',
    animation: 'holo',
  },
  8: {
    tagline: 'Sabores sin fronteras',
    ornament: 'nebula',
    frameGradient: 'linear-gradient(135deg, #c4b5fd, #6366f1, #a78bfa)',
    innerBg: 'linear-gradient(165deg, rgba(49, 46, 129, 0.88), rgba(20, 16, 48, 0.8))',
    emblemGlow: 'radial-gradient(circle, rgba(167, 139, 250, 0.48), transparent 70%)',
    animation: 'holo',
  },
  9: {
    tagline: 'Llevas el sabor a todas partes',
    ornament: 'mystic',
    frameGradient: 'linear-gradient(135deg, #e879f9, #a21caf, #f0abfc)',
    innerBg: 'linear-gradient(165deg, rgba(88, 28, 135, 0.9), rgba(58, 12, 88, 0.82))',
    emblemGlow: 'radial-gradient(circle, rgba(232, 121, 249, 0.5), transparent 70%)',
    animation: 'pulse',
  },
  10: {
    tagline: 'Nada se te escapa del menú',
    ornament: 'titan',
    frameGradient: 'linear-gradient(135deg, #7dd3fc, #0284c7, #38bdf8)',
    innerBg: 'linear-gradient(165deg, rgba(12, 74, 110, 0.9), rgba(8, 40, 62, 0.82))',
    emblemGlow: 'radial-gradient(circle, rgba(125, 211, 252, 0.48), transparent 70%)',
    animation: 'pulse',
  },
  11: {
    tagline: 'Un nombre en la historia',
    ornament: 'legend',
    frameGradient: 'linear-gradient(135deg, #e879f9, #c026d3, #f0abfc, #d946ef)',
    innerBg: 'linear-gradient(165deg, rgba(112, 26, 117, 0.92), rgba(74, 4, 78, 0.84))',
    emblemGlow: 'radial-gradient(circle, rgba(232, 121, 249, 0.55), transparent 70%)',
    animation: 'pulse',
  },
  12: {
    tagline: 'La cúspide del paladar',
    ornament: 'divine',
    frameGradient: 'linear-gradient(135deg, #fde68a, #d4af37, #ffd700, #b8860b, #fde68a)',
    innerBg: 'linear-gradient(165deg, rgba(28, 25, 23, 0.95), rgba(12, 10, 9, 0.92))',
    emblemGlow: 'radial-gradient(circle, rgba(255, 215, 0, 0.65), rgba(212, 175, 55, 0.25) 45%, transparent 72%)',
    animation: 'divine',
  },
}

export function getLevelProfileBadgeTheme(level: number): LevelProfileBadgeTheme {
  const clamped = Math.min(12, Math.max(1, level))
  return LEVEL_PROFILE_BADGE_THEMES[clamped] ?? LEVEL_PROFILE_BADGE_THEMES[1]
}
