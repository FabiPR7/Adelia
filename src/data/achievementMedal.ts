/**
 * Diseño de las medallas de logros: formas y metales. COMÚN con la app (la web y el
 * móvil dibujan exactamente la misma medalla en SVG).
 *
 * Coordenadas en un lienzo de 100 × 100; el cuerpo de la medalla va centrado en 50,46
 * para dejar sitio a las cintas de abajo.
 */
import type { AchievementBadgeDifficulty, AchievementBadgeShape } from './achievementBadgeArt'

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'legend'

export interface MedalPalette {
  /** Borde metálico: claro → medio → oscuro. */
  rim: [string, string, string]
  /** Cara interior: luz arriba → sombra abajo. */
  face: [string, string]
  /** Icono grabado. */
  glyph: string
  /** Sombra del grabado. */
  engrave: string
  /** Cintas de la medalla. */
  ribbon: [string, string]
  /** Brillo alrededor (solo ganadas). */
  glow: string
  label: string
}

export const MEDAL_TIER_BY_DIFFICULTY: Record<AchievementBadgeDifficulty, MedalTier> = {
  easy: 'bronze',
  medium: 'silver',
  hard: 'gold',
  legendary: 'legend',
}

export const MEDAL_PALETTES: Record<MedalTier | 'locked', MedalPalette> = {
  bronze: {
    rim: ['#ffd9b3', '#c27a43', '#6a3518'],
    face: ['#a8622f', '#4f2610'],
    glyph: '#ffe6cc',
    engrave: 'rgba(40, 16, 4, 0.55)',
    ribbon: ['#8f2d1f', '#c2452f'],
    glow: 'rgba(214, 133, 74, 0.55)',
    label: 'Bronce',
  },
  silver: {
    rim: ['#ffffff', '#b8c3cf', '#5d6877'],
    face: ['#8d9aab', '#3c4654'],
    glyph: '#f6f9fc',
    engrave: 'rgba(14, 20, 30, 0.55)',
    ribbon: ['#1f3f74', '#2f5fae'],
    glow: 'rgba(190, 206, 224, 0.6)',
    label: 'Plata',
  },
  gold: {
    rim: ['#fff4b8', '#e5b23b', '#835406'],
    face: ['#d49a22', '#6a4104'],
    glyph: '#fff7dc',
    engrave: 'rgba(60, 34, 0, 0.6)',
    ribbon: ['#7c1020', '#c01f34'],
    glow: 'rgba(255, 200, 70, 0.65)',
    label: 'Oro',
  },
  legend: {
    rim: ['#f9e6ff', '#a274ff', '#2e137a'],
    face: ['#6a34e0', '#160845'],
    glyph: '#fff0ff',
    engrave: 'rgba(10, 0, 40, 0.65)',
    ribbon: ['#0f0f2e', '#3b2a9c'],
    glow: 'rgba(170, 120, 255, 0.75)',
    label: 'Legendaria',
  },
  locked: {
    rim: ['#6b6662', '#423e3b', '#211f1d'],
    face: ['#35312e', '#191716'],
    glyph: 'rgba(255, 248, 239, 0.3)',
    engrave: 'rgba(0, 0, 0, 0.5)',
    ribbon: ['#2b2826', '#3a3633'],
    glow: 'transparent',
    label: 'Bloqueada',
  },
}

const CX = 50
const CY = 46

function polygon(points: number, radius: number, rotation = -Math.PI / 2, innerRadius?: number): string {
  const total = innerRadius ? points * 2 : points
  const coords: string[] = []
  for (let index = 0; index < total; index += 1) {
    const r = innerRadius && index % 2 === 1 ? innerRadius : radius
    const angle = rotation + (index * 2 * Math.PI) / total
    coords.push(`${(CX + r * Math.cos(angle)).toFixed(2)} ${(CY + r * Math.sin(angle)).toFixed(2)}`)
  }
  return `M${coords.join(' L')} Z`
}

function circle(radius: number): string {
  return `M${CX - radius} ${CY} a${radius} ${radius} 0 1 0 ${radius * 2} 0 a${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`
}

function shield(scale: number): string {
  const s = (value: number) => (value * scale).toFixed(2)
  // Escudo de 76 × 84 centrado en CX, CY.
  return `M${CX} ${(CY - 42 * scale).toFixed(2)} l${s(36)} ${s(12)} v${s(28)} c0 ${s(22)} ${s(-15)} ${s(36)} ${s(-36)} ${s(46)} c${s(-21)} ${s(-10)} ${s(-36)} ${s(-24)} ${s(-36)} ${s(-46)} v${s(-28)} Z`
}

/** Silueta exterior y cara interior de cada forma. */
export function medalPaths(shape: AchievementBadgeShape): { outer: string; inner: string } {
  switch (shape) {
    case 'hex':
      return { outer: polygon(6, 42), inner: polygon(6, 33) }
    case 'shield':
      return { outer: shield(1), inner: shield(0.78) }
    case 'star':
      // Roseta de 12 puntas: parece un sello lacrado.
      return { outer: polygon(12, 43, -Math.PI / 2, 37), inner: circle(30) }
    case 'diamond':
      return { outer: polygon(4, 44), inner: polygon(4, 34) }
    default:
      return { outer: circle(41), inner: circle(32) }
  }
}

export const MEDAL_CENTER = { x: CX, y: CY }

/** Tamaño del icono grabado (los iconos miden 24) y su esquina superior izquierda. */
export const MEDAL_GLYPH = { scale: 1.35, x: CX - 12 * 1.35, y: CY - 12 * 1.35 }

/** Las cintas solo cuelgan de oro y legendarias. */
export function medalHasRibbons(tier: MedalTier): boolean {
  return tier === 'gold' || tier === 'legend'
}

/** Cintas (dos colas) detrás de la medalla. */
export const MEDAL_RIBBONS = {
  left: 'M36 70 L28 98 L37 92 L43 99 L48 74 Z',
  right: 'M64 70 L72 98 L63 92 L57 99 L52 74 Z',
}

/** Anillo de progreso alrededor de las bloqueadas. */
export const MEDAL_PROGRESS_RADIUS = 47

/** Metal del emblema de nivel: 1-3 bronce, 4-6 plata, 7-8 oro, 9-10 legendaria. */
export function levelMedalTier(level: number): MedalTier {
  if (level >= 9) return 'legend'
  if (level >= 7) return 'gold'
  if (level >= 4) return 'silver'
  return 'bronze'
}

/** Cuánto falta para que se renueven las misiones (semana: domingo a medianoche; mes: fin de mes). */
export function missionResetLabel(cadence: 'weekly' | 'monthly', now = new Date()): string {
  const end = new Date(now)
  if (cadence === 'weekly') {
    const day = end.getDay() || 7
    end.setDate(end.getDate() + (7 - day) + 1)
  } else {
    end.setMonth(end.getMonth() + 1, 1)
  }
  end.setHours(0, 0, 0, 0)
  const minutes = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days} d ${hours} h`
  return `${hours} h ${minutes % 60} min`
}
