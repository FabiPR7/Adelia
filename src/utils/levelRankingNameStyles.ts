export interface NameGradientStop {
  at: number
  color: string
}

export interface NameShadowLayer {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

export interface LevelRankingNameStyle {
  fontSize: number
  lineHeight: number
  fontFamily: string
  fontWeight: string
  paddingX: number
  gradientStops: NameGradientStop[]
  strokeColor: string
  strokeWidth: number
  shadows: NameShadowLayer[]
}

const BASE_FAMILY = "'Cormorant Garamond', Georgia, serif"

function tierStyle(
  level: number,
  gradientStops: NameGradientStop[],
  strokeColor: string,
  strokeWidth: number,
  shadows: NameShadowLayer[],
): LevelRankingNameStyle {
  const epicness = Math.min(level, 12)

  return {
    fontSize: 17 + Math.floor(epicness / 3),
    lineHeight: 1.15,
    fontFamily: BASE_FAMILY,
    fontWeight: epicness >= 10 ? '700' : epicness >= 6 ? '700' : '600',
    paddingX: 1,
    gradientStops,
    strokeColor,
    strokeWidth,
    shadows,
  }
}

export const LEVEL_RANKING_NAME_STYLES: Record<number, LevelRankingNameStyle> = {
  1: tierStyle(
    1,
    [
      { at: 0, color: '#f5e6c8' },
      { at: 0.5, color: '#d4a574' },
      { at: 1, color: '#8b6914' },
    ],
    '#4a2f20',
    0.4,
    [{ color: 'rgba(74, 47, 32, 0.45)', blur: 0, offsetX: 0, offsetY: 1 }],
  ),
  2: tierStyle(
    2,
    [
      { at: 0, color: '#ecfdf5' },
      { at: 0.5, color: '#6ee7b7' },
      { at: 1, color: '#059669' },
    ],
    '#064e3b',
    0.5,
    [
      { color: 'rgba(0, 0, 0, 0.35)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(251, 191, 36, 0.35)', blur: 4, offsetX: 0, offsetY: 0 },
    ],
  ),
  3: tierStyle(
    3,
    [
      { at: 0, color: '#ccfbf1' },
      { at: 0.5, color: '#5eead4' },
      { at: 1, color: '#0f766e' },
    ],
    '#134e4a',
    0.55,
    [
      { color: 'rgba(0, 0, 0, 0.35)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(252, 211, 77, 0.3)', blur: 5, offsetX: 0, offsetY: 0 },
    ],
  ),
  4: tierStyle(
    4,
    [
      { at: 0, color: '#eff6ff' },
      { at: 0.45, color: '#93c5fd' },
      { at: 1, color: '#1d4ed8' },
    ],
    '#1e3a8a',
    0.65,
    [
      { color: 'rgba(0, 0, 0, 0.4)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(251, 191, 36, 0.35)', blur: 6, offsetX: 0, offsetY: 0 },
    ],
  ),
  5: tierStyle(
    5,
    [
      { at: 0, color: '#f3e8ff' },
      { at: 0.45, color: '#d8b4fe' },
      { at: 1, color: '#7c3aed' },
    ],
    '#4c1d95',
    0.7,
    [
      { color: 'rgba(0, 0, 0, 0.45)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(251, 191, 36, 0.4)', blur: 7, offsetX: 0, offsetY: 0 },
    ],
  ),
  6: tierStyle(
    6,
    [
      { at: 0, color: '#fef3c7' },
      { at: 0.4, color: '#fbbf24' },
      { at: 1, color: '#b45309' },
    ],
    '#4a0718',
    0.75,
    [
      { color: 'rgba(0, 0, 0, 0.5)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(251, 191, 36, 0.45)', blur: 8, offsetX: 0, offsetY: 0 },
    ],
  ),
  7: tierStyle(
    7,
    [
      { at: 0, color: '#fef9c3' },
      { at: 0.35, color: '#ffd700' },
      { at: 1, color: '#b8860b' },
    ],
    '#422006',
    0.85,
    [
      { color: 'rgba(0, 0, 0, 0.55)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(255, 215, 0, 0.5)', blur: 9, offsetX: 0, offsetY: 0 },
      { color: 'rgba(255, 215, 0, 0.25)', blur: 14, offsetX: 0, offsetY: 0 },
    ],
  ),
  8: tierStyle(
    8,
    [
      { at: 0, color: '#ede9fe' },
      { at: 0.4, color: '#c4b5fd' },
      { at: 1, color: '#6366f1' },
    ],
    '#312e81',
    0.9,
    [
      { color: 'rgba(0, 0, 0, 0.5)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(252, 211, 77, 0.45)', blur: 10, offsetX: 0, offsetY: 0 },
    ],
  ),
  9: tierStyle(
    9,
    [
      { at: 0, color: '#fae8ff' },
      { at: 0.4, color: '#e879f9' },
      { at: 1, color: '#a21caf' },
    ],
    '#581c87',
    1,
    [
      { color: 'rgba(0, 0, 0, 0.55)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(232, 121, 249, 0.5)', blur: 11, offsetX: 0, offsetY: 0 },
      { color: 'rgba(251, 191, 36, 0.3)', blur: 6, offsetX: 0, offsetY: 0 },
    ],
  ),
  10: tierStyle(
    10,
    [
      { at: 0, color: '#f0f9ff' },
      { at: 0.35, color: '#7dd3fc' },
      { at: 0.7, color: '#38bdf8' },
      { at: 1, color: '#1e40af' },
    ],
    '#0c4a6e',
    1.05,
    [
      { color: 'rgba(0, 0, 0, 0.55)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(125, 211, 252, 0.55)', blur: 12, offsetX: 0, offsetY: 0 },
      { color: 'rgba(226, 232, 240, 0.35)', blur: 8, offsetX: 0, offsetY: 0 },
    ],
  ),
  11: tierStyle(
    11,
    [
      { at: 0, color: '#fdf4ff' },
      { at: 0.35, color: '#f0abfc' },
      { at: 0.7, color: '#d946ef' },
      { at: 1, color: '#86198f' },
    ],
    '#701a75',
    1.1,
    [
      { color: 'rgba(0, 0, 0, 0.6)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(240, 171, 252, 0.55)', blur: 13, offsetX: 0, offsetY: 0 },
      { color: 'rgba(252, 211, 77, 0.35)', blur: 8, offsetX: 0, offsetY: 0 },
    ],
  ),
  12: tierStyle(
    12,
    [
      { at: 0, color: '#fef3c7' },
      { at: 0.25, color: '#fbbf24' },
      { at: 0.55, color: '#f97316' },
      { at: 0.8, color: '#dc2626' },
      { at: 1, color: '#ffd700' },
    ],
    '#451a03',
    1.2,
    [
      { color: 'rgba(0, 0, 0, 0.65)', blur: 0, offsetX: 0, offsetY: 1 },
      { color: 'rgba(220, 38, 38, 0.55)', blur: 14, offsetX: 0, offsetY: 0 },
      { color: 'rgba(251, 191, 36, 0.6)', blur: 16, offsetX: 0, offsetY: 0 },
      { color: 'rgba(255, 140, 0, 0.35)', blur: 10, offsetX: 1, offsetY: 0 },
    ],
  ),
}

export function getLevelRankingNameStyle(level: number): LevelRankingNameStyle {
  return LEVEL_RANKING_NAME_STYLES[level] ?? LEVEL_RANKING_NAME_STYLES[1]
}

export interface LevelRankingNameCss {
  gradient: string
  strokeColor: string
  strokeWidthPx: number
  fontSizeRem: number
  letterSpacing: string
  highlightColor: string
}

export function getLevelRankingNameCss(level: number): LevelRankingNameCss {
  const style = getLevelRankingNameStyle(level)
  const epicness = Math.min(Math.max(level, 1), 12)
  const stops = style.gradientStops

  return {
    gradient: `linear-gradient(180deg, ${stops.map((stop) => `${stop.color} ${stop.at * 100}%`).join(', ')})`,
    strokeColor: style.strokeColor,
    strokeWidthPx: Math.max(2, style.strokeWidth * 1.8),
    fontSizeRem: 1.38 + epicness * 0.028,
    letterSpacing: '0.045em',
    highlightColor: stops[0]?.color ?? '#ffffff',
  }
}
