import { getLevelProfileBadgeTheme } from './levelProfileBadgeThemes'
import { getLevelRankingStripTheme } from './levelRankingStripThemes'

export type LevelUpParticleKind =
  | 'dust'
  | 'leaves'
  | 'bubbles'
  | 'shards'
  | 'arcane'
  | 'embers'
  | 'gold'
  | 'stars'
  | 'orbs'
  | 'snow'
  | 'diamonds'
  | 'divine'

export type LevelUpImpact = 'soft' | 'heavy' | 'epic'

export interface LevelUpCelebrationTheme {
  accent: string
  accentHot: string
  glow: string
  overlay: string
  titleGlow: string
  ctaGradient: string
  particle: LevelUpParticleKind
  foil: boolean
  rays: boolean
  impact: LevelUpImpact
  flavorReward: string
  badgeLabel: string
}

const LEVEL_UP_THEMES: Record<number, Omit<LevelUpCelebrationTheme, 'accent' | 'accentHot' | 'glow' | 'overlay' | 'titleGlow' | 'ctaGradient'>> = {
  1: {
    particle: 'dust',
    foil: false,
    rays: false,
    impact: 'soft',
    flavorReward: 'Marco rústico de comensal',
    badgeLabel: 'Primer rango',
  },
  2: {
    particle: 'leaves',
    foil: false,
    rays: false,
    impact: 'soft',
    flavorReward: 'Marco menta en tu perfil',
    badgeLabel: 'Nueva senda',
  },
  3: {
    particle: 'bubbles',
    foil: false,
    rays: false,
    impact: 'soft',
    flavorReward: 'Badge metálico plata',
    badgeLabel: 'Barrio gourmet',
  },
  4: {
    particle: 'shards',
    foil: false,
    rays: false,
    impact: 'heavy',
    flavorReward: 'Resplandor púrpura épico',
    badgeLabel: 'Paladar crítico',
  },
  5: {
    particle: 'arcane',
    foil: false,
    rays: false,
    impact: 'heavy',
    flavorReward: 'Marco efecto llamarada',
    badgeLabel: 'Maestro en escena',
  },
  6: {
    particle: 'embers',
    foil: true,
    rays: false,
    impact: 'heavy',
    flavorReward: 'Tarjeta VIP con destellos de Adelinas',
    badgeLabel: 'Leyenda viva',
  },
  7: {
    particle: 'gold',
    foil: true,
    rays: true,
    impact: 'epic',
    flavorReward: 'Tarjeta holográfica + ranking de amigos',
    badgeLabel: 'Deidad dorada',
  },
  8: {
    particle: 'stars',
    foil: true,
    rays: false,
    impact: 'epic',
    flavorReward: 'Aura nebula en tu perfil',
    badgeLabel: 'Gran paladar',
  },
  9: {
    particle: 'orbs',
    foil: true,
    rays: false,
    impact: 'epic',
    flavorReward: 'Destellos místicos',
    badgeLabel: 'Embajador',
  },
  10: {
    particle: 'snow',
    foil: false,
    rays: false,
    impact: 'epic',
    flavorReward: 'Nevada de titanio',
    badgeLabel: 'Titán del menú',
  },
  11: {
    particle: 'diamonds',
    foil: true,
    rays: true,
    impact: 'epic',
    flavorReward: 'Lluvia de diamantes',
    badgeLabel: 'Leyenda eterna',
  },
  12: {
    particle: 'divine',
    foil: true,
    rays: true,
    impact: 'epic',
    flavorReward: 'Corona divina eterna',
    badgeLabel: 'Cúspide',
  },
}

function mixOverlay(border: string): string {
  return `
    radial-gradient(circle at 50% 28%, color-mix(in srgb, ${border} 42%, transparent), transparent 46%),
    radial-gradient(circle at 18% 88%, color-mix(in srgb, ${border} 22%, transparent), transparent 38%),
    radial-gradient(circle at 84% 78%, color-mix(in srgb, ${border} 18%, transparent), transparent 36%)
  `
}

export function getLevelUpCelebrationTheme(level: number): LevelUpCelebrationTheme {
  const clamped = Math.min(12, Math.max(1, level))
  const strip = getLevelRankingStripTheme(clamped)
  const badge = getLevelProfileBadgeTheme(clamped)
  const extras = LEVEL_UP_THEMES[clamped] ?? LEVEL_UP_THEMES[1]
  const accent = strip.cardBorder
  const accentHot = strip.xpLabelColor

  return {
    ...extras,
    accent,
    accentHot,
    glow: badge.emblemGlow,
    overlay: mixOverlay(accent),
    titleGlow: `0 8px 32px color-mix(in srgb, ${accent} 55%, transparent)`,
    ctaGradient: `linear-gradient(135deg, ${accent}, ${accentHot} 58%, ${strip.avatarBorder})`,
  }
}

export function getLevelUpParticleCount(impact: LevelUpImpact): number {
  if (impact === 'epic') {
    return 34
  }
  if (impact === 'heavy') {
    return 24
  }
  return 16
}
