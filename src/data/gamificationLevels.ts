import type { GamificationLevel } from '../types/gamification'

export const GAMIFICATION_LEVELS: GamificationLevel[] = [
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

export const PROFILE_REWARDS = [
  { level: 2, reward: 'Marco menta en tu perfil' },
  { level: 3, reward: 'Badge metálico plata' },
  { level: 4, reward: 'Resplandor púrpura épico' },
  { level: 5, reward: 'Marco efecto llamarada' },
  { level: 6, reward: 'Tarjeta VIP con destellos de Adelinas' },
  { level: 7, reward: 'Tarjeta holográfica + ranking de amigos' },
]
