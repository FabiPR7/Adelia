/** Colores y posiciones calibrados sobre plantillas IA (16:9, ~1810×869). */
export interface LevelCardLayout {
  avatarLeft: string
  avatarTop: string
  avatarSize: string
  identityLeft: string
  identityTop: string
  identityWidth: string
  pillLeft: string
  pillBottom: string
  pillWidth: string
  pillHeight: string
  xpRight: string
  xpBottom: string
  xpWidth: string
  xpHeight: string
}

export interface LevelCardTheme {
  identityCover: string
  nameColor: string
  handleColor: string
  pillNumberBg: string
  pillNumberColor: string
  pillTitleBg: string
  pillTitleColor: string
  xpCover: string
  xpColor: string
  layout: LevelCardLayout
}

const DEFAULT_LAYOUT: LevelCardLayout = {
  avatarLeft: '7.8%',
  avatarTop: '26.5%',
  avatarSize: '13.2%',
  identityLeft: '24.5%',
  identityTop: '28.5%',
  identityWidth: '36%',
  pillLeft: '31.5%',
  pillBottom: '15.5%',
  pillWidth: '41%',
  pillHeight: '11.5%',
  xpRight: '5.2%',
  xpBottom: '15.8%',
  xpWidth: '12.8%',
  xpHeight: '10.5%',
}

export const LEVEL_CARD_THEMES: Record<number, LevelCardTheme> = {
  1: {
    layout: { ...DEFAULT_LAYOUT, avatarTop: '24%', identityTop: '26%' },
    identityCover: 'linear-gradient(90deg, #efe4d4 0%, #efe4d4 88%, transparent 100%)',
    nameColor: '#4a2f20',
    handleColor: '#6b5344',
    pillNumberBg: '#3d2817',
    pillNumberColor: '#fff',
    pillTitleBg: '#e8dcc8',
    pillTitleColor: '#4a2f20',
    xpCover: '#e8dcc8',
    xpColor: '#4a2f20',
  },
  2: {
    layout: { ...DEFAULT_LAYOUT, avatarTop: '24%', identityTop: '22%', pillLeft: '30%' },
    identityCover: 'linear-gradient(90deg, rgba(18, 62, 40, 0.96) 0%, rgba(18, 62, 40, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#a7f3d0',
    pillNumberBg: '#0a3520',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#7ecf98',
    pillTitleColor: '#064e3b',
    xpCover: '#0a3520',
    xpColor: '#ecfdf5',
  },
  3: {
    layout: DEFAULT_LAYOUT,
    identityCover: 'linear-gradient(90deg, rgba(12, 58, 56, 0.96) 0%, rgba(12, 58, 56, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#99f6e4',
    pillNumberBg: '#0f4c47',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#5eead4',
    pillTitleColor: '#134e4a',
    xpCover: '#0f4c47',
    xpColor: '#ccfbf1',
  },
  4: {
    layout: DEFAULT_LAYOUT,
    identityCover: 'linear-gradient(90deg, rgba(15, 38, 82, 0.96) 0%, rgba(15, 38, 82, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#93c5fd',
    pillNumberBg: '#1e3a8a',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#93c5fd',
    pillTitleColor: '#1e3a8a',
    xpCover: '#1e3a8a',
    xpColor: '#dbeafe',
  },
  5: {
    layout: { ...DEFAULT_LAYOUT, identityTop: '22%', pillLeft: '28%', pillWidth: '44%' },
    identityCover: 'linear-gradient(90deg, rgba(46, 16, 72, 0.96) 0%, rgba(46, 16, 72, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#e9d5ff',
    pillNumberBg: '#4c1d95',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#d8b4fe',
    pillTitleColor: '#581c87',
    xpCover: '#4c1d95',
    xpColor: '#f3e8ff',
  },
  6: {
    layout: DEFAULT_LAYOUT,
    identityCover: 'linear-gradient(90deg, rgba(58, 12, 24, 0.96) 0%, rgba(58, 12, 24, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#fecdd3',
    pillNumberBg: '#4a0718',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#fbbf24',
    pillTitleColor: '#451a03',
    xpCover: '#4a0718',
    xpColor: '#fde68a',
  },
  7: {
    layout: { ...DEFAULT_LAYOUT, identityTop: '22%' },
    identityCover: 'linear-gradient(90deg, rgba(28, 18, 8, 0.96) 0%, rgba(28, 18, 8, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#fde68a',
    pillNumberBg: '#292017',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#d4af37',
    pillTitleColor: '#422006',
    xpCover: '#292017',
    xpColor: '#fde68a',
  },
  8: {
    layout: DEFAULT_LAYOUT,
    identityCover: 'linear-gradient(90deg, rgba(22, 18, 48, 0.96) 0%, rgba(22, 18, 48, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#c4b5fd',
    pillNumberBg: '#312e81',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#a78bfa',
    pillTitleColor: '#1e1b4b',
    xpCover: '#312e81',
    xpColor: '#ede9fe',
  },
  9: {
    layout: DEFAULT_LAYOUT,
    identityCover: 'linear-gradient(90deg, rgba(12, 32, 68, 0.96) 0%, rgba(12, 32, 68, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#bae6fd',
    pillNumberBg: '#1e40af',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#7dd3fc',
    pillTitleColor: '#0c4a6e',
    xpCover: '#1e40af',
    xpColor: '#e0f2fe',
  },
  10: {
    layout: DEFAULT_LAYOUT,
    identityCover: 'linear-gradient(90deg, rgba(48, 20, 8, 0.96) 0%, rgba(48, 20, 8, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#fed7aa',
    pillNumberBg: '#7c2d12',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#fb923c',
    pillTitleColor: '#431407',
    xpCover: '#7c2d12',
    xpColor: '#ffedd5',
  },
  11: {
    layout: {
      avatarLeft: '5.5%',
      avatarTop: '18%',
      avatarSize: '14.5%',
      identityLeft: '22%',
      identityTop: '18%',
      identityWidth: '38%',
      pillLeft: '30%',
      pillBottom: '14%',
      pillWidth: '42%',
      pillHeight: '11.8%',
      xpRight: '4.8%',
      xpBottom: '14.5%',
      xpWidth: '13.5%',
      xpHeight: '10.8%',
    },
    identityCover: 'linear-gradient(90deg, rgba(38, 8, 58, 0.96) 0%, rgba(38, 8, 58, 0.88) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#f0abfc',
    pillNumberBg: '#701a75',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#e879f9',
    pillTitleColor: '#4a044e',
    xpCover: '#701a75',
    xpColor: '#fae8ff',
  },
  12: {
    layout: { ...DEFAULT_LAYOUT, avatarTop: '20%', identityTop: '20%' },
    identityCover: 'linear-gradient(90deg, rgba(18, 8, 4, 0.97) 0%, rgba(18, 8, 4, 0.9) 88%, transparent 100%)',
    nameColor: '#ffffff',
    handleColor: '#fdba74',
    pillNumberBg: '#1c1917',
    pillNumberColor: '#ffffff',
    pillTitleBg: '#d4af37',
    pillTitleColor: '#422006',
    xpCover: '#1c1917',
    xpColor: '#fde68a',
  },
}

export function getLevelCardTheme(level: number): LevelCardTheme {
  return LEVEL_CARD_THEMES[level] ?? LEVEL_CARD_THEMES[1]
}
