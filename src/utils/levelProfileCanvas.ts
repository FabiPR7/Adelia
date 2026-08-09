/**
 * Recorte del arte strip por zona — calibrado como nivel 11 (escena arriba / suelo abajo).
 * Cada strip-bg-level-XX.png tiene la misma estructura: salón arriba ~55%, piso abajo ~45%.
 */
export interface LevelProfileCanvasLayout {
  heroHeight: string
  heroObjectPosition: string
  bodyTop: string
  bodyHeight: string
  bodyObjectPosition: string
}

/** Referencia: nivel 11 — el usuario lo marcó como perfecto. */
const CANVAS_L11: LevelProfileCanvasLayout = {
  heroHeight: '56%',
  heroObjectPosition: 'center 30%',
  bodyTop: '52%',
  bodyHeight: '58%',
  bodyObjectPosition: 'center 75%',
}

/**
 * Misma fórmula que L11; solo se ajusta el punto focal según dónde está
 * el detalle principal de escena y de suelo en cada ilustración.
 */
export const LEVEL_PROFILE_CANVAS: Record<number, LevelProfileCanvasLayout> = {
  1: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 28%',
    bodyObjectPosition: 'center 78%',
  },
  2: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 30%',
    bodyObjectPosition: 'center 76%',
  },
  3: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 30%',
    bodyObjectPosition: 'center 78%',
  },
  4: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 32%',
    bodyObjectPosition: 'center 76%',
  },
  5: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 26%',
    bodyObjectPosition: 'center 80%',
  },
  6: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 30%',
    bodyObjectPosition: 'center 77%',
  },
  7: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 28%',
    bodyObjectPosition: 'center 78%',
  },
  8: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 32%',
    bodyObjectPosition: 'center 76%',
  },
  9: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 28%',
    bodyObjectPosition: 'center 78%',
  },
  10: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 30%',
    bodyObjectPosition: 'center 76%',
  },
  11: { ...CANVAS_L11 },
  12: {
    ...CANVAS_L11,
    heroObjectPosition: 'center 26%',
    bodyObjectPosition: 'center 82%',
  },
}

export function getLevelProfileCanvas(level: number): LevelProfileCanvasLayout {
  const clamped = Math.min(12, Math.max(1, level))
  return LEVEL_PROFILE_CANVAS[clamped] ?? CANVAS_L11
}
