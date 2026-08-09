import type { MissionCategory, MissionDefinition } from '../types/gamification'

export type AchievementBadgeShape = 'shield' | 'hex' | 'circle' | 'star' | 'diamond'
export type AchievementBadgeDifficulty = 'easy' | 'medium' | 'hard' | 'legendary'

export interface AchievementBadgeArt {
  shape: AchievementBadgeShape
  glyph: string
  difficulty: AchievementBadgeDifficulty
  category: MissionCategory
}

const SHAPES: AchievementBadgeShape[] = ['circle', 'shield', 'hex', 'star', 'diamond']

function shapeForId(missionId: string): AchievementBadgeShape {
  let hash = 0
  for (let i = 0; i < missionId.length; i += 1) {
    hash = (hash + missionId.charCodeAt(i) * (i + 3)) % SHAPES.length
  }
  return SHAPES[hash] ?? 'circle'
}

export function difficultyFromXp(xp: number): AchievementBadgeDifficulty {
  if (xp >= 1500) return 'legendary'
  if (xp >= 800) return 'hard'
  if (xp >= 300) return 'medium'
  return 'easy'
}

const BADGE_CATALOG: Record<string, Omit<AchievementBadgeArt, 'category'> & { category?: MissionCategory }> = {
  debut_gastronomico: { shape: 'shield', glyph: '🎉', difficulty: 'easy' },
  primera_opinion: { shape: 'circle', glyph: '✍️', difficulty: 'easy' },
  primer_botin: { shape: 'diamond', glyph: '🎁', difficulty: 'easy' },
  corazon_favorito: { shape: 'circle', glyph: '❤️', difficulty: 'easy' },
  almuerzo_sol: { shape: 'hex', glyph: '☀️', difficulty: 'easy' },
  cena_especial: { shape: 'shield', glyph: '🌙', difficulty: 'easy' },
  martes_valiente: { shape: 'circle', glyph: '📅', difficulty: 'easy' },
  mesa_para_dos: { shape: 'hex', glyph: '🥂', difficulty: 'easy' },
  reserva_relampago_logro: { shape: 'star', glyph: '⚡', difficulty: 'easy' },
  cliente_fiel_meson: { shape: 'diamond', glyph: '🃏', difficulty: 'medium' },
  nomada_digital: { shape: 'circle', glyph: '🌍', difficulty: 'medium' },
  club_10_mesas: { shape: 'hex', glyph: '🪑', difficulty: 'medium' },
  fotografo_gourmet: { shape: 'hex', glyph: '📷', difficulty: 'medium' },
  cazador_tesoros: { shape: 'star', glyph: '🗝️', difficulty: 'medium' },
  racha_mensual: { shape: 'shield', glyph: '🔁', difficulty: 'medium' },
  cazador_ofertas: { shape: 'diamond', glyph: '🏷️', difficulty: 'medium' },
  voz_barrio: { shape: 'circle', glyph: '💬', difficulty: 'medium' },
  mesa_grande: { shape: 'hex', glyph: '👨‍👩‍👧‍👦', difficulty: 'medium' },
  explorador_zona: { shape: 'shield', glyph: '🗺️', difficulty: 'medium' },
  reserva_planificada: { shape: 'star', glyph: '📆', difficulty: 'medium' },
  ruta_internacional: { shape: 'shield', glyph: '🌏', difficulty: 'medium' },
  socio_veterano: { shape: 'shield', glyph: '🏅', difficulty: 'hard' },
  critico_destacado: { shape: 'star', glyph: '⭐', difficulty: 'hard' },
  infiltrado_hosteleria: { shape: 'star', glyph: '🕵️', difficulty: 'hard' },
  embajador_local: { shape: 'diamond', glyph: '🏘️', difficulty: 'hard' },
  maestro_resenas: { shape: 'hex', glyph: '🖊️', difficulty: 'hard' },
  coleccionista_premios: { shape: 'diamond', glyph: '💎', difficulty: 'hard' },
  maraton_gastro: { shape: 'shield', glyph: '🏃', difficulty: 'hard' },
  leyenda_restaurante: { shape: 'star', glyph: '👑', difficulty: 'hard' },
  guia_michelin: { shape: 'shield', glyph: '📖', difficulty: 'legendary' },
  centurion_mesas: { shape: 'hex', glyph: '💯', difficulty: 'legendary' },
  oraculo_sabores: { shape: 'diamond', glyph: '🔮', difficulty: 'legendary' },
  titan_hosteleria: { shape: 'star', glyph: '🌋', difficulty: 'legendary' },
  emperador_adelia: { shape: 'shield', glyph: '🦁', difficulty: 'legendary' },
  llama_eterna: { shape: 'diamond', glyph: '🔥', difficulty: 'legendary' },
  corona_gastro: { shape: 'star', glyph: '👑', difficulty: 'legendary' },
}

/** Muestra mezcla de obtenidas / bloqueadas en demo. */
export const SHOWCASE_EARNED_MISSION_IDS = new Set([
  'debut_gastronomico',
  'primera_opinion',
  'corazon_favorito',
  'cliente_fiel_meson',
  'critico_destacado',
  'guia_michelin',
])

export function getAchievementBadgeArt(
  missionId: string,
  mission?: Pick<MissionDefinition, 'icon' | 'xp' | 'category'>,
): AchievementBadgeArt {
  const catalog = BADGE_CATALOG[missionId]
  const glyph = catalog?.glyph ?? mission?.icon ?? '★'
  const difficulty = catalog?.difficulty ?? difficultyFromXp(mission?.xp ?? 150)

  return {
    shape: catalog?.shape ?? shapeForId(missionId),
    glyph,
    difficulty,
    category: catalog?.category ?? mission?.category ?? 'loyalty',
  }
}
