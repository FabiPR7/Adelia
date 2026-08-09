/** Tipografía y overlay por nivel — fondos y emblemas en levelRankingStripAssets. */
export interface LevelRankingStripTheme {
  overlay: string
  cardBorder: string
  nameColor: string
  titleColor: string
  nameShadow: string
  xpTrack: string
  xpFill: string
  xpLabelColor: string
  avatarBorder: string
}

export const LEVEL_RANKING_STRIP_THEMES: Record<number, LevelRankingStripTheme> = {
  1: {
    overlay: 'linear-gradient(90deg, rgba(74, 47, 32, 0.72) 0%, rgba(74, 47, 32, 0.45) 55%, rgba(74, 47, 32, 0.2) 100%)',
    cardBorder: '#c4a574',
    nameColor: '#fff8ef',
    titleColor: '#f5e6c8',
    nameShadow: '0 1px 4px rgba(58, 35, 20, 0.55)',
    xpTrack: 'rgba(58, 35, 20, 0.35)',
    xpFill: 'linear-gradient(90deg, #8b6914, #e8c547)',
    xpLabelColor: '#fff8ef',
    avatarBorder: '#d4af37',
  },
  2: {
    overlay: 'linear-gradient(90deg, rgba(6, 40, 25, 0.82) 0%, rgba(6, 40, 25, 0.5) 55%, rgba(6, 40, 25, 0.25) 100%)',
    cardBorder: '#7ecf98',
    nameColor: '#ffffff',
    titleColor: '#a7f3d0',
    nameShadow: '0 1px 4px rgba(0, 0, 0, 0.45)',
    xpTrack: 'rgba(0, 0, 0, 0.35)',
    xpFill: 'linear-gradient(90deg, #059669, #4ade80)',
    xpLabelColor: '#ecfdf5',
    avatarBorder: '#fbbf24',
  },
  3: {
    overlay: 'linear-gradient(90deg, rgba(10, 50, 48, 0.82) 0%, rgba(10, 50, 48, 0.5) 55%, rgba(10, 50, 48, 0.22) 100%)',
    cardBorder: '#5eead4',
    nameColor: '#ffffff',
    titleColor: '#99f6e4',
    nameShadow: '0 1px 4px rgba(0, 0, 0, 0.45)',
    xpTrack: 'rgba(0, 0, 0, 0.32)',
    xpFill: 'linear-gradient(90deg, #0d9488, #2dd4bf)',
    xpLabelColor: '#ccfbf1',
    avatarBorder: '#fcd34d',
  },
  4: {
    overlay: 'linear-gradient(90deg, rgba(15, 30, 80, 0.84) 0%, rgba(15, 30, 80, 0.52) 55%, rgba(15, 30, 80, 0.24) 100%)',
    cardBorder: '#93c5fd',
    nameColor: '#ffffff',
    titleColor: '#bfdbfe',
    nameShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
    xpTrack: 'rgba(0, 0, 0, 0.35)',
    xpFill: 'linear-gradient(90deg, #2563eb, #60a5fa)',
    xpLabelColor: '#eff6ff',
    avatarBorder: '#fbbf24',
  },
  5: {
    overlay: 'linear-gradient(90deg, rgba(46, 16, 72, 0.86) 0%, rgba(46, 16, 72, 0.55) 55%, rgba(46, 16, 72, 0.25) 100%)',
    cardBorder: '#d8b4fe',
    nameColor: '#ffffff',
    titleColor: '#e9d5ff',
    nameShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
    xpTrack: 'rgba(0, 0, 0, 0.38)',
    xpFill: 'linear-gradient(90deg, #7c3aed, #d8b4fe)',
    xpLabelColor: '#f3e8ff',
    avatarBorder: '#fbbf24',
  },
  6: {
    overlay: 'linear-gradient(90deg, rgba(58, 8, 24, 0.88) 0%, rgba(58, 8, 24, 0.56) 55%, rgba(58, 8, 24, 0.26) 100%)',
    cardBorder: '#fbbf24',
    nameColor: '#ffffff',
    titleColor: '#fecdd3',
    nameShadow: '0 1px 4px rgba(0, 0, 0, 0.55)',
    xpTrack: 'rgba(0, 0, 0, 0.4)',
    xpFill: 'linear-gradient(90deg, #b45309, #fbbf24)',
    xpLabelColor: '#fef3c7',
    avatarBorder: '#fde68a',
  },
  7: {
    overlay: 'linear-gradient(90deg, rgba(26, 16, 6, 0.88) 0%, rgba(26, 16, 6, 0.56) 55%, rgba(26, 16, 6, 0.26) 100%)',
    cardBorder: '#d4af37',
    nameColor: '#ffffff',
    titleColor: '#fde68a',
    nameShadow: '0 1px 5px rgba(0, 0, 0, 0.6)',
    xpTrack: 'rgba(0, 0, 0, 0.42)',
    xpFill: 'linear-gradient(90deg, #b8860b, #ffd700)',
    xpLabelColor: '#fef9c3',
    avatarBorder: '#ffd700',
  },
  8: {
    overlay: 'linear-gradient(90deg, rgba(20, 16, 48, 0.86) 0%, rgba(20, 16, 48, 0.54) 55%, rgba(20, 16, 48, 0.24) 100%)',
    cardBorder: '#a78bfa',
    nameColor: '#ffffff',
    titleColor: '#c4b5fd',
    nameShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
    xpTrack: 'rgba(0, 0, 0, 0.38)',
    xpFill: 'linear-gradient(90deg, #6366f1, #c4b5fd)',
    xpLabelColor: '#ede9fe',
    avatarBorder: '#fcd34d',
  },
  9: {
    overlay: 'linear-gradient(90deg, rgba(58, 12, 88, 0.88) 0%, rgba(58, 12, 88, 0.56) 55%, rgba(58, 12, 88, 0.26) 100%)',
    cardBorder: '#e879f9',
    nameColor: '#ffffff',
    titleColor: '#f5d0fe',
    nameShadow: '0 1px 4px rgba(0, 0, 0, 0.55)',
    xpTrack: 'rgba(0, 0, 0, 0.4)',
    xpFill: 'linear-gradient(90deg, #a21caf, #e879f9)',
    xpLabelColor: '#fae8ff',
    avatarBorder: '#fbbf24',
  },
  10: {
    overlay: 'linear-gradient(90deg, rgba(8, 40, 62, 0.86) 0%, rgba(8, 40, 62, 0.54) 55%, rgba(8, 40, 62, 0.24) 100%)',
    cardBorder: '#7dd3fc',
    nameColor: '#ffffff',
    titleColor: '#bae6fd',
    nameShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
    xpTrack: 'rgba(0, 0, 0, 0.38)',
    xpFill: 'linear-gradient(90deg, #0284c7, #7dd3fc)',
    xpLabelColor: '#e0f2fe',
    avatarBorder: '#e2e8f0',
  },
  11: {
    overlay: 'linear-gradient(90deg, rgba(56, 8, 68, 0.88) 0%, rgba(56, 8, 68, 0.56) 55%, rgba(56, 8, 68, 0.26) 100%)',
    cardBorder: '#f0abfc',
    nameColor: '#ffffff',
    titleColor: '#f5d0fe',
    nameShadow: '0 1px 5px rgba(0, 0, 0, 0.55)',
    xpTrack: 'rgba(0, 0, 0, 0.42)',
    xpFill: 'linear-gradient(90deg, #c026d3, #f0abfc)',
    xpLabelColor: '#fae8ff',
    avatarBorder: '#fcd34d',
  },
  12: {
    overlay: 'linear-gradient(90deg, rgba(12, 4, 2, 0.9) 0%, rgba(40, 8, 4, 0.62) 55%, rgba(80, 16, 8, 0.35) 100%)',
    cardBorder: '#d4af37',
    nameColor: '#ffffff',
    titleColor: '#fdba74',
    nameShadow: '0 1px 6px rgba(0, 0, 0, 0.65)',
    xpTrack: 'rgba(0, 0, 0, 0.45)',
    xpFill: 'linear-gradient(90deg, #dc2626, #fbbf24)',
    xpLabelColor: '#fef3c7',
    avatarBorder: '#ef4444',
  },
}

export function getLevelRankingStripTheme(level: number): LevelRankingStripTheme {
  return LEVEL_RANKING_STRIP_THEMES[level] ?? LEVEL_RANKING_STRIP_THEMES[1]
}
