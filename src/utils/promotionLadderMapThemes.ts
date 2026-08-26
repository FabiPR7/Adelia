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
  stickers: LadderMapThemeSticker[]
  cssVars: Record<string, string>
}

export const LADDER_MAP_HOOK = 'Cada reserva o consumo te acerca a un premio'

export const LADDER_MAP_THEMES: LadderMapTheme[] = [
  {
    id: 'island',
    label: 'Isla tropical',
    eyebrow: 'Carta náutica · Isla del tesoro',
    finishEmoji: '🏴‍☠️',
    stickers: [
      { emoji: '⛵', x: 9, y: 92 },
      { emoji: '🦜', x: 91, y: 22 },
      { emoji: '🌴', x: 7, y: 58 },
      { emoji: '🐚', x: 88, y: 86 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #7ec8e3 0%, #5eb5d4 18%, #4a9fd4 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 70% 55% at 50% 62%, rgba(126, 200, 80, 0.28) 0%, transparent 72%)',
      '--map-wash': 'linear-gradient(180deg, rgba(255, 244, 214, 0.22) 0%, rgba(20, 50, 40, 0.12) 100%)',
      '--map-border': '#c9a227',
      '--map-inner-border': 'rgba(74, 44, 16, 0.38)',
      '--map-frame-shadow': 'inset 0 0 70px rgba(40, 24, 8, 0.22)',
      '--path-color': '#7a1f12',
      '--path-glow': 'rgba(201, 162, 39, 0.55)',
      '--step-bg': 'linear-gradient(135deg, #e74c3c, #c0392b)',
      '--step-shadow': 'rgba(192, 57, 43, 0.35)',
      '--card-border': '#d4a574',
      '--card-bg': 'linear-gradient(180deg, #fffef9 0%, #fff5e6 100%)',
      '--meta-color': '#2d6a4f',
      '--progress-bg': 'rgba(45, 106, 79, 0.18)',
      '--progress-fill': 'linear-gradient(90deg, #e74c3c, #f39c12)',
      '--header-accent': '#1b7a54',
      '--theme-badge-bg': 'rgba(255, 248, 230, 0.94)',
      '--theme-badge-color': '#1b5e40',
      '--pin-bg': 'linear-gradient(180deg, #f6d365, #c47b0a)',
      '--pin-ink': '#3b2410',
    },
  },
  {
    id: 'volcano',
    label: 'Volcán ardiente',
    eyebrow: 'Carta magmática · Cumbre de fuego',
    finishEmoji: '💎',
    stickers: [
      { emoji: '🔥', x: 50, y: 10 },
      { emoji: '🪨', x: 10, y: 62 },
      { emoji: '✨', x: 88, y: 28 },
      { emoji: '💎', x: 12, y: 88 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #1a1a2e 0%, #2d1f3d 35%, #4a2040 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 80% 45% at 50% 88%, rgba(255, 90, 0, 0.4) 0%, transparent 65%)',
      '--map-wash': 'linear-gradient(180deg, rgba(40, 10, 8, 0.28) 0%, rgba(255, 80, 0, 0.12) 100%)',
      '--map-border': '#ff8c42',
      '--map-inner-border': 'rgba(255, 140, 66, 0.32)',
      '--map-frame-shadow': 'inset 0 0 70px rgba(255, 80, 0, 0.18)',
      '--path-color': '#ffb347',
      '--path-glow': 'rgba(255, 107, 53, 0.55)',
      '--step-bg': 'linear-gradient(135deg, #ff6b35, #e63900)',
      '--step-shadow': 'rgba(255, 107, 53, 0.4)',
      '--card-border': '#ff8c42',
      '--card-bg': 'linear-gradient(180deg, #fff8f0 0%, #ffe8d6 100%)',
      '--meta-color': '#c0392b',
      '--progress-bg': 'rgba(139, 37, 0, 0.2)',
      '--progress-fill': 'linear-gradient(90deg, #ff6b35, #ffd700)',
      '--header-accent': '#e63900',
      '--theme-badge-bg': 'rgba(255, 236, 210, 0.94)',
      '--theme-badge-color': '#9a3412',
      '--pin-bg': 'linear-gradient(180deg, #ffb347, #ea580c)',
      '--pin-ink': '#431407',
    },
  },
  {
    id: 'forest',
    label: 'Bosque encantado',
    eyebrow: 'Carta silvestre · Sendero mágico',
    finishEmoji: '🦊',
    stickers: [
      { emoji: '🍄', x: 10, y: 82 },
      { emoji: '🦉', x: 90, y: 28 },
      { emoji: '🌿', x: 88, y: 88 },
      { emoji: '🦌', x: 8, y: 38 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #87c98a 0%, #5a9e5f 40%, #3d7a45 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 90% 60% at 30% 80%, rgba(45, 90, 50, 0.35) 0%, transparent 55%)',
      '--map-wash': 'linear-gradient(180deg, rgba(230, 255, 220, 0.18) 0%, rgba(20, 50, 24, 0.16) 100%)',
      '--map-border': '#c9a227',
      '--map-inner-border': 'rgba(45, 90, 39, 0.4)',
      '--map-frame-shadow': 'inset 0 0 60px rgba(20, 60, 25, 0.22)',
      '--path-color': '#4a2c0a',
      '--path-glow': 'rgba(212, 175, 55, 0.45)',
      '--step-bg': 'linear-gradient(135deg, #6b8e23, #556b2f)',
      '--step-shadow': 'rgba(85, 107, 47, 0.35)',
      '--card-border': '#a08040',
      '--card-bg': 'linear-gradient(180deg, #fafff5 0%, #eef8e8 100%)',
      '--meta-color': '#3d5a27',
      '--progress-bg': 'rgba(45, 90, 39, 0.18)',
      '--progress-fill': 'linear-gradient(90deg, #6b8e23, #9acd32)',
      '--header-accent': '#3d7a45',
      '--theme-badge-bg': 'rgba(255, 255, 245, 0.94)',
      '--theme-badge-color': '#2d5a27',
      '--pin-bg': 'linear-gradient(180deg, #bef264, #3f6212)',
      '--pin-ink': '#1a2e05',
    },
  },
  {
    id: 'desert',
    label: 'Desierto dorado',
    eyebrow: 'Carta de caravana · Dunas reales',
    finishEmoji: '👑',
    stickers: [
      { emoji: '🐪', x: 8, y: 78 },
      { emoji: '🏜️', x: 88, y: 55 },
      { emoji: '🦂', x: 92, y: 90 },
      { emoji: '🏺', x: 10, y: 32 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #f4d03f 0%, #e8b84a 30%, #d4a056 60%, #c9956a 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(255, 220, 100, 0.45) 0%, transparent 55%)',
      '--map-wash': 'linear-gradient(180deg, rgba(255, 236, 180, 0.2) 0%, rgba(120, 70, 20, 0.16) 100%)',
      '--map-border': '#c9a227',
      '--map-inner-border': 'rgba(120, 72, 16, 0.38)',
      '--map-frame-shadow': 'inset 0 0 55px rgba(160, 100, 20, 0.2)',
      '--path-color': '#5c2010',
      '--path-glow': 'rgba(201, 162, 39, 0.5)',
      '--step-bg': 'linear-gradient(135deg, #d4a056, #a0522d)',
      '--step-shadow': 'rgba(160, 82, 45, 0.35)',
      '--card-border': '#cd853f',
      '--card-bg': 'linear-gradient(180deg, #fffef5 0%, #fdf0d5 100%)',
      '--meta-color': '#8b4513',
      '--progress-bg': 'rgba(139, 69, 19, 0.15)',
      '--progress-fill': 'linear-gradient(90deg, #d4a056, #e8b84a)',
      '--header-accent': '#b8860b',
      '--theme-badge-bg': 'rgba(255, 248, 220, 0.95)',
      '--theme-badge-color': '#8b4513',
      '--pin-bg': 'linear-gradient(180deg, #fde68a, #b45309)',
      '--pin-ink': '#451a03',
    },
  },
  {
    id: 'space',
    label: 'Galaxia estelar',
    eyebrow: 'Carta celeste · Ruta de estrellas',
    finishEmoji: '🛸',
    stickers: [
      { emoji: '🚀', x: 6, y: 42 },
      { emoji: '👽', x: 94, y: 68 },
      { emoji: '⭐', x: 12, y: 18 },
      { emoji: '🌙', x: 90, y: 14 },
    ],
    cssVars: {
      '--map-bg': 'linear-gradient(180deg, #0f0c29 0%, #1a1a4e 40%, #24243e 100%)',
      '--map-bg-overlay': 'radial-gradient(ellipse 70% 50% at 60% 30%, rgba(120, 80, 255, 0.28) 0%, transparent 55%)',
      '--map-wash': 'linear-gradient(180deg, rgba(12, 10, 40, 0.28) 0%, rgba(80, 40, 140, 0.14) 100%)',
      '--map-border': '#9d8df1',
      '--map-inner-border': 'rgba(196, 181, 253, 0.32)',
      '--map-frame-shadow': 'inset 0 0 70px rgba(100, 80, 255, 0.18)',
      '--path-color': '#7dd3fc',
      '--path-glow': 'rgba(0, 212, 255, 0.5)',
      '--step-bg': 'linear-gradient(135deg, #7b68ee, #6b5bff)',
      '--step-shadow': 'rgba(107, 91, 255, 0.4)',
      '--card-border': '#9d8df1',
      '--card-bg': 'linear-gradient(180deg, #f8f6ff 0%, #ede8ff 100%)',
      '--meta-color': '#6b5bff',
      '--progress-bg': 'rgba(107, 91, 255, 0.2)',
      '--progress-fill': 'linear-gradient(90deg, #00d4ff, #7b68ee)',
      '--header-accent': '#7b68ee',
      '--theme-badge-bg': 'rgba(244, 240, 255, 0.95)',
      '--theme-badge-color': '#5b21b6',
      '--pin-bg': 'linear-gradient(180deg, #c4b5fd, #6d28d9)',
      '--pin-ink': '#2e1065',
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
