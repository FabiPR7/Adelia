import { getLevelRankingStripTheme } from './levelRankingStripThemes'
import { getLevelProfileCanvas } from './levelProfileCanvas'

/** Pastillas de nivel alineadas con cada strip (no levelCardLayout). */
const LEVEL_PILL_THEMES: Record<
  number,
  { pillNumberBg: string; pillNumberColor: string; pillTitleBg: string; pillTitleColor: string }
> = {
  1: { pillNumberBg: '#3d2817', pillNumberColor: '#fff8ef', pillTitleBg: '#e8dcc8', pillTitleColor: '#4a2f20' },
  2: { pillNumberBg: '#064e3b', pillNumberColor: '#ffffff', pillTitleBg: '#6ee7b7', pillTitleColor: '#064e3b' },
  3: { pillNumberBg: '#0f766e', pillNumberColor: '#ffffff', pillTitleBg: '#5eead4', pillTitleColor: '#134e4a' },
  4: { pillNumberBg: '#1e3a8a', pillNumberColor: '#ffffff', pillTitleBg: '#93c5fd', pillTitleColor: '#1e3a8a' },
  5: { pillNumberBg: '#4c1d95', pillNumberColor: '#ffffff', pillTitleBg: '#d8b4fe', pillTitleColor: '#581c87' },
  6: { pillNumberBg: '#4a0718', pillNumberColor: '#ffffff', pillTitleBg: '#fbbf24', pillTitleColor: '#451a03' },
  7: { pillNumberBg: '#422006', pillNumberColor: '#ffffff', pillTitleBg: '#d4af37', pillTitleColor: '#422006' },
  8: { pillNumberBg: '#312e81', pillNumberColor: '#ffffff', pillTitleBg: '#a78bfa', pillTitleColor: '#1e1b4b' },
  9: { pillNumberBg: '#581c87', pillNumberColor: '#ffffff', pillTitleBg: '#e879f9', pillTitleColor: '#3b0764' },
  10: { pillNumberBg: '#0c4a6e', pillNumberColor: '#ffffff', pillTitleBg: '#7dd3fc', pillTitleColor: '#082f49' },
  11: { pillNumberBg: '#701a75', pillNumberColor: '#ffffff', pillTitleBg: '#e879f9', pillTitleColor: '#4a044e' },
  12: { pillNumberBg: '#1c1917', pillNumberColor: '#ffffff', pillTitleBg: '#d4af37', pillTitleColor: '#422006' },
}

export interface LevelProfileBodyTheme {
  pillNumberBg: string
  pillNumberColor: string
  pillTitleBg: string
  pillTitleColor: string
  heroHeight: string
  heroObjectPosition: string
  bodyTop: string
  bodyHeight: string
  bodyObjectPosition: string
  pageGlow: string
  pageVignette: string
  metricBg: string
  metricBorder: string
  chipBg: string
  chipText: string
  chipBorder: string
  divider: string
  sectionAccent: string
}

function glowFromBorder(borderColor: string): string {
  return `radial-gradient(ellipse 85% 50% at 50% 0%, color-mix(in srgb, ${borderColor} 32%, transparent), transparent 65%)`
}

export function getLevelProfileBodyTheme(level: number): LevelProfileBodyTheme {
  const clamped = Math.min(12, Math.max(1, level))
  const strip = getLevelRankingStripTheme(clamped)
  const pills = LEVEL_PILL_THEMES[clamped] ?? LEVEL_PILL_THEMES[1]
  const canvas = getLevelProfileCanvas(clamped)

  return {
    ...pills,
    ...canvas,
    pageGlow: glowFromBorder(strip.cardBorder),
    pageVignette:
      'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.06) 40%, rgba(0, 0, 0, 0.32) 100%)',
    metricBg: 'rgba(255, 255, 255, 0.1)',
    metricBorder: strip.cardBorder,
    chipBg: 'rgba(255, 255, 255, 0.12)',
    chipText: strip.titleColor,
    chipBorder: `color-mix(in srgb, ${strip.cardBorder} 50%, transparent)`,
    divider: 'rgba(255, 255, 255, 0.18)',
    sectionAccent: strip.cardBorder,
  }
}
