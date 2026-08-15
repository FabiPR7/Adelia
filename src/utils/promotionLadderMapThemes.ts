export type LadderMapThemeId = 'island' | 'volcano' | 'forest' | 'desert' | 'space'

export interface LadderMapThemeSticker {
  emoji: string
  x: number
  y: number
}

export interface LadderMapTheme {
  id: LadderMapThemeId
  label: string
  eyebrow: string
  finishEmoji: string
  compassEmoji: string
  stickers: LadderMapThemeSticker[]
  cssVars: Record<string, string>
}

export const LADDER_MAP_THEMES: LadderMapTheme[] = [
  {
    id: 'island',
    label: 'Isla tropical',
    eyebrow: 'Mapa del tesoro · Isla tropical',
    finishEmoji: '🏴‍☠️',
    compassEmoji: '🧭',
    stickers: [
      { emoji: '⛵', x: 8, y: 94 },
      { emoji: '🦜', x: 92, y: 18 },
      { emoji: '🌴', x: 6, y: 55 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #7ec8e3 0%, #5eb5d4 18%, #4a9fd4 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 70% 55% at 50% 62%, #7ec850 0%, #5aad38 42%, #3d8f28 68%, transparent 72%)',
      '--map-border': '#2d6a4f',
      '--map-inner-border': 'rgba(45, 106, 79, 0.35)',
      '--map-frame-shadow': 'inset 0 0 50px rgba(30, 90, 60, 0.2)',
      '--path-color': '#c0392b',
      '--path-glow': 'rgba(192, 57, 43, 0.35)',
      '--step-bg': 'linear-gradient(135deg, #e74c3c, #c0392b)',
      '--step-shadow': 'rgba(192, 57, 43, 0.35)',
      '--card-border': '#d4a574',
      '--card-bg': 'linear-gradient(180deg, #fffef9 0%, #fff5e6 100%)',
      '--meta-color': '#2d6a4f',
      '--progress-bg': 'rgba(45, 106, 79, 0.18)',
      '--progress-fill': 'linear-gradient(90deg, #e74c3c, #f39c12)',
      '--header-accent': '#1b7a54',
      '--theme-badge-bg': 'rgba(255, 255, 255, 0.88)',
      '--theme-badge-color': '#1b5e40',
    },
  },
  {
    id: 'volcano',
    label: 'Volcán ardiente',
    eyebrow: 'Mapa del tesoro · Volcán ardiente',
    finishEmoji: '💎',
    compassEmoji: '🌋',
    stickers: [
      { emoji: '🔥', x: 50, y: 8 },
      { emoji: '🪨', x: 10, y: 60 },
      { emoji: '☁️', x: 62, y: 12 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #1a1a2e 0%, #2d1f3d 35%, #4a2040 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 80% 45% at 50% 88%, rgba(255, 90, 0, 0.55) 0%, rgba(255, 50, 0, 0.25) 35%, transparent 65%)',
      '--map-border': '#8b2500',
      '--map-inner-border': 'rgba(255, 100, 50, 0.25)',
      '--map-frame-shadow': 'inset 0 0 60px rgba(255, 80, 0, 0.15)',
      '--path-color': '#ff6b35',
      '--path-glow': 'rgba(255, 107, 53, 0.45)',
      '--step-bg': 'linear-gradient(135deg, #ff6b35, #e63900)',
      '--step-shadow': 'rgba(255, 107, 53, 0.4)',
      '--card-border': '#ff8c42',
      '--card-bg': 'linear-gradient(180deg, #fff8f0 0%, #ffe8d6 100%)',
      '--meta-color': '#c0392b',
      '--progress-bg': 'rgba(139, 37, 0, 0.2)',
      '--progress-fill': 'linear-gradient(90deg, #ff6b35, #ffd700)',
      '--header-accent': '#e63900',
      '--theme-badge-bg': 'rgba(255, 120, 50, 0.2)',
      '--theme-badge-color': '#ff6b35',
    },
  },
  {
    id: 'forest',
    label: 'Bosque encantado',
    eyebrow: 'Mapa del tesoro · Bosque encantado',
    finishEmoji: '🦊',
    compassEmoji: '🌲',
    stickers: [
      { emoji: '🍄', x: 10, y: 82 },
      { emoji: '🦉', x: 90, y: 28 },
      { emoji: '🌿', x: 88, y: 88 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #87c98a 0%, #5a9e5f 40%, #3d7a45 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 90% 60% at 30% 80%, rgba(45, 90, 50, 0.5) 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 75% 25%, rgba(30, 70, 40, 0.35) 0%, transparent 50%)',
      '--map-border': '#2d5a27',
      '--map-inner-border': 'rgba(45, 90, 39, 0.35)',
      '--map-frame-shadow': 'inset 0 0 45px rgba(20, 60, 25, 0.25)',
      '--path-color': '#8b6914',
      '--path-glow': 'rgba(139, 105, 20, 0.3)',
      '--step-bg': 'linear-gradient(135deg, #6b8e23, #556b2f)',
      '--step-shadow': 'rgba(85, 107, 47, 0.35)',
      '--card-border': '#a08040',
      '--card-bg': 'linear-gradient(180deg, #fafff5 0%, #eef8e8 100%)',
      '--meta-color': '#3d5a27',
      '--progress-bg': 'rgba(45, 90, 39, 0.18)',
      '--progress-fill': 'linear-gradient(90deg, #6b8e23, #9acd32)',
      '--header-accent': '#3d7a45',
      '--theme-badge-bg': 'rgba(255, 255, 255, 0.85)',
      '--theme-badge-color': '#2d5a27',
    },
  },
  {
    id: 'desert',
    label: 'Desierto dorado',
    eyebrow: 'Mapa del tesoro · Desierto dorado',
    finishEmoji: '👑',
    compassEmoji: '☀️',
    stickers: [
      { emoji: '🐪', x: 8, y: 78 },
      { emoji: '🏜️', x: 88, y: 55 },
      { emoji: '🦂', x: 92, y: 90 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #f4d03f 0%, #e8b84a 30%, #d4a056 60%, #c9956a 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(255, 220, 100, 0.6) 0%, transparent 55%), radial-gradient(ellipse 80% 30% at 20% 70%, rgba(210, 150, 80, 0.4) 0%, transparent 50%)',
      '--map-border': '#b8860b',
      '--map-inner-border': 'rgba(184, 134, 11, 0.35)',
      '--map-frame-shadow': 'inset 0 0 40px rgba(160, 100, 20, 0.2)',
      '--path-color': '#8b4513',
      '--path-glow': 'rgba(139, 69, 19, 0.3)',
      '--step-bg': 'linear-gradient(135deg, #d4a056, #a0522d)',
      '--step-shadow': 'rgba(160, 82, 45, 0.35)',
      '--card-border': '#cd853f',
      '--card-bg': 'linear-gradient(180deg, #fffef5 0%, #fdf0d5 100%)',
      '--meta-color': '#8b4513',
      '--progress-bg': 'rgba(139, 69, 19, 0.15)',
      '--progress-fill': 'linear-gradient(90deg, #d4a056, #e8b84a)',
      '--header-accent': '#b8860b',
      '--theme-badge-bg': 'rgba(255, 248, 220, 0.92)',
      '--theme-badge-color': '#8b4513',
    },
  },
  {
    id: 'space',
    label: 'Galaxia estelar',
    eyebrow: 'Mapa del tesoro · Galaxia estelar',
    finishEmoji: '🛸',
    compassEmoji: '🪐',
    stickers: [
      { emoji: '🚀', x: 6, y: 42 },
      { emoji: '👽', x: 94, y: 68 },
      { emoji: '⭐', x: 12, y: 18 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #0f0c29 0%, #1a1a4e 40%, #24243e 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 70% 50% at 60% 30%, rgba(120, 80, 255, 0.35) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 20% 75%, rgba(255, 100, 200, 0.2) 0%, transparent 50%)',
      '--map-border': '#6b5bff',
      '--map-inner-border': 'rgba(107, 91, 255, 0.3)',
      '--map-frame-shadow': 'inset 0 0 60px rgba(100, 80, 255, 0.15)',
      '--path-color': '#00d4ff',
      '--path-glow': 'rgba(0, 212, 255, 0.4)',
      '--step-bg': 'linear-gradient(135deg, #7b68ee, #6b5bff)',
      '--step-shadow': 'rgba(107, 91, 255, 0.4)',
      '--card-border': '#9d8df1',
      '--card-bg': 'linear-gradient(180deg, #f8f6ff 0%, #ede8ff 100%)',
      '--meta-color': '#6b5bff',
      '--progress-bg': 'rgba(107, 91, 255, 0.2)',
      '--progress-fill': 'linear-gradient(90deg, #00d4ff, #7b68ee)',
      '--header-accent': '#7b68ee',
      '--theme-badge-bg': 'rgba(107, 91, 255, 0.25)',
      '--theme-badge-color': '#c4b5fd',
    },
  },
]

export function pickRandomLadderMapTheme(): LadderMapTheme {
  const index = Math.floor(Math.random() * LADDER_MAP_THEMES.length)
  return LADDER_MAP_THEMES[index] ?? LADDER_MAP_THEMES[0]
}

export function getLadderMapThemeById(id: LadderMapThemeId): LadderMapTheme {
  return LADDER_MAP_THEMES.find((theme) => theme.id === id) ?? LADDER_MAP_THEMES[0]
}
