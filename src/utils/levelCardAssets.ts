/** Plantillas IA sin texto (niveles 1, 3–4, 6–12). Niveles 2 y 5 usan el PNG original del diseñador. */
import level01 from '../assets/levels/generated/level-01-template.png'
import level02 from '../assets/levels name/nivel 2.png'
import level03 from '../assets/levels/generated/level-03-template.png'
import level04 from '../assets/levels/generated/level-04-template.png'
import level05 from '../assets/levels name/nivel 5.png'
import level06 from '../assets/levels/generated/level-06-template.png'
import level07 from '../assets/levels/generated/level-07-template.png'
import level08 from '../assets/levels/generated/level-08-template.png'
import level09 from '../assets/levels/generated/level-09-template.png'
import level10 from '../assets/levels/generated/level-10-template.png'
import level11 from '../assets/levels/generated/level-11-template.png'
import level12 from '../assets/levels/generated/level-12-template.png'

const LEVEL_CARD_FRAMES: Record<number, string> = {
  1: level01,
  2: level02,
  3: level03,
  4: level04,
  5: level05,
  6: level06,
  7: level07,
  8: level08,
  9: level09,
  10: level10,
  11: level11,
  12: level12,
}

/** Niveles cuyo PNG trae texto fijo: los overlays llevan fondo opaco. */
export const LEVEL_CARD_NEEDS_TEXT_COVER: Record<number, boolean> = {
  2: true,
  5: true,
}

export function getLevelCardFrame(level: number): string {
  return LEVEL_CARD_FRAMES[level] ?? LEVEL_CARD_FRAMES[1]
}

export function levelCardNeedsTextCover(level: number): boolean {
  return LEVEL_CARD_NEEDS_TEXT_COVER[level] ?? false
}

export { LEVEL_CARD_FRAMES }
