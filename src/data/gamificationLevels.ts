import type { GamificationLevel } from '../types/gamification'

export let GAMIFICATION_LEVELS: GamificationLevel[] = [
  {
    level: 1,
    title: 'Comensal Aficionado',
    minXp: 0,
    maxXp: 299,
    colors: ['#FFFFFF', '#E0E0E0'],
    styleClass: 'level1',
  },
  {
    level: 2,
    title: 'Explorador de Sabores',
    minXp: 300,
    maxXp: 799,
    colors: ['#10B981', '#059669'],
    styleClass: 'level2',
  },
  {
    level: 3,
    title: 'Gourmet de Barrio',
    minXp: 800,
    maxXp: 1599,
    colors: ['#3B82F6', '#93C5FD'],
    styleClass: 'level3',
  },
  {
    level: 4,
    title: 'Crítico de la Casa',
    minXp: 1600,
    maxXp: 3199,
    colors: ['#8B5CF6', '#C4B5FD'],
    styleClass: 'level4',
  },
  {
    level: 5,
    title: 'Maestro de Mesa',
    minXp: 3200,
    maxXp: 5999,
    colors: ['#EF4444', '#F97316'],
    styleClass: 'level5',
  },
  {
    level: 6,
    title: 'Leyenda Gastronómica',
    minXp: 6000,
    maxXp: 9999,
    colors: ['#F59E0B', '#FDE68A'],
    styleClass: 'level6',
  },
  {
    level: 7,
    title: 'Deidad del Paladar',
    minXp: 10000,
    maxXp: null,
    colors: ['#06B6D4', '#EC4899'],
    styleClass: 'level7',
  },
]

export let PROFILE_REWARDS = [
  { level: 2, reward: 'Marco menta en tu perfil' },
  { level: 3, reward: 'Badge metálico plata' },
  { level: 4, reward: 'Resplandor púrpura épico' },
  { level: 5, reward: 'Marco efecto llamarada' },
  { level: 6, reward: 'Tarjeta VIP con destellos de Adelinas' },
  { level: 7, reward: 'Tarjeta holográfica + ranking de amigos' },
  { level: 8, reward: 'Aura nebula en tu perfil' },
  { level: 9, reward: 'Destellos místicos' },
  { level: 10, reward: 'Nevada de titanio' },
  { level: 11, reward: 'Lluvia de diamantes' },
  { level: 12, reward: 'Corona divina eterna' },
]

/** Títulos para niveles 8–12 (assets de tarjeta extendidos). */
export const EXTENDED_LEVEL_TITLES: Record<number, string> = {
  8: 'Gran Paladar',
  9: 'Embajador Gourmet',
  10: 'Titán del Menú',
  11: 'Cliente Legendario',
  12: 'Deidad Suprema',
}

export function getGamificationLevelTitle(level: number): string {
  const base = GAMIFICATION_LEVELS.find((entry) => entry.level === level)
  if (base) {
    return base.title
  }

  return EXTENDED_LEVEL_TITLES[level] ?? `Nivel ${level}`
}

export function getGamificationLevelByNumber(level: number): GamificationLevel {
  const base = GAMIFICATION_LEVELS.find((entry) => entry.level === level)
  if (base) {
    return base
  }

  const fallback = GAMIFICATION_LEVELS[GAMIFICATION_LEVELS.length - 1]
  return {
    ...fallback,
    level,
    title: getGamificationLevelTitle(level),
    minXp: fallback.minXp,
    maxXp: null,
  }
}

export function getProfileRewardForLevel(level: number): string | null {
  return PROFILE_REWARDS.find((reward) => reward.level === level)?.reward ?? null
}

export function applyLevelCatalog(
  levels: GamificationLevel[],
  rewards: Array<{ level: number; reward: string }> = [],
): void {
  if (levels.length > 0) {
    GAMIFICATION_LEVELS = [...levels].sort((left, right) => left.level - right.level)
  }
  if (rewards.length > 0) {
    PROFILE_REWARDS = [...rewards].sort((left, right) => left.level - right.level)
  }
}
