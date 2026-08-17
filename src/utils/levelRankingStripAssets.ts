import title01 from '../assets/levels/strips/titulos sin fondos/titulonivel1.webp'
import title02 from '../assets/levels/strips/titulos sin fondos/titulonivel2.webp'
import title03 from '../assets/levels/strips/titulos sin fondos/titulonivel3.webp'
import title04 from '../assets/levels/strips/titulos sin fondos/titulonivel4.webp'
import title05 from '../assets/levels/strips/titulos sin fondos/titulonivel5.webp'
import title06 from '../assets/levels/strips/titulos sin fondos/titulonivel6.webp'
import title07 from '../assets/levels/strips/titulos sin fondos/titulonivel7.webp'
import title08 from '../assets/levels/strips/titulos sin fondos/titulonivel8.webp'
import title09 from '../assets/levels/strips/titulos sin fondos/titulonivel9.webp'
import title10 from '../assets/levels/strips/titulos sin fondos/titulonivel10.webp'
import title11 from '../assets/levels/strips/titulos sin fondos/titulonivel11.webp'
import title12 from '../assets/levels/strips/titulos sin fondos/titulonivel12.webp'

import stripBg01 from '../assets/levels/strips/strip-bg-level-01.webp'
import stripBg02 from '../assets/levels/strips/strip-bg-level-02.webp'
import stripBg03 from '../assets/levels/strips/strip-bg-level-03.webp'
import stripBg04 from '../assets/levels/strips/strip-bg-level-04.webp'
import stripBg05 from '../assets/levels/strips/strip-bg-level-05.webp'
import stripBg06 from '../assets/levels/strips/strip-bg-level-06.webp'
import stripBg07 from '../assets/levels/strips/strip-bg-level-07.webp'
import stripBg08 from '../assets/levels/strips/strip-bg-level-08.webp'
import stripBg09 from '../assets/levels/strips/strip-bg-level-09.webp'
import stripBg10 from '../assets/levels/strips/strip-bg-level-10.webp'
import stripBg11 from '../assets/levels/strips/strip-bg-level-11.webp'
import stripBg12 from '../assets/levels/strips/strip-bg-level-12.webp'

import shield01 from '../assets/levels/strips/escudos sin fondos/nivel1.webp'
import shield02 from '../assets/levels/strips/escudos sin fondos/nivel2.webp'
import shield03 from '../assets/levels/strips/escudos sin fondos/nivel3.webp'
import shield04 from '../assets/levels/strips/escudos sin fondos/nivel4.webp'
import shield05 from '../assets/levels/strips/escudos sin fondos/nivel5.webp'
import shield06 from '../assets/levels/strips/escudos sin fondos/nivel6.webp'
import shield07 from '../assets/levels/strips/escudos sin fondos/nivel7.webp'
import shield08 from '../assets/levels/strips/escudos sin fondos/nivel8.webp'
import shield09 from '../assets/levels/strips/escudos sin fondos/nivel9.webp'
import shield10 from '../assets/levels/strips/escudos sin fondos/nivel10.webp'
import shield11 from '../assets/levels/strips/escudos sin fondos/nivel11.webp'
import shield12 from '../assets/levels/strips/escudos sin fondos/nivel12.webp'

const STRIP_BACKGROUNDS: Record<number, string> = {
  1: stripBg01,
  2: stripBg02,
  3: stripBg03,
  4: stripBg04,
  5: stripBg05,
  6: stripBg06,
  7: stripBg07,
  8: stripBg08,
  9: stripBg09,
  10: stripBg10,
  11: stripBg11,
  12: stripBg12,
}

const STRIP_EMBLEMS: Record<number, string> = {
  1: shield01,
  2: shield02,
  3: shield03,
  4: shield04,
  5: shield05,
  6: shield06,
  7: shield07,
  8: shield08,
  9: shield09,
  10: shield10,
  11: shield11,
  12: shield12,
}

const STRIP_TITLES: Record<number, string> = {
  1: title01,
  2: title02,
  3: title03,
  4: title04,
  5: title05,
  6: title06,
  7: title07,
  8: title08,
  9: title09,
  10: title10,
  11: title11,
  12: title12,
}

export function getStripBackground(level: number): string {
  return STRIP_BACKGROUNDS[level] ?? STRIP_BACKGROUNDS[1]
}

export function getStripEmblem(level: number): string {
  return STRIP_EMBLEMS[level] ?? STRIP_EMBLEMS[1]
}

export function getStripTitleArt(level: number): string {
  return STRIP_TITLES[level] ?? STRIP_TITLES[1]
}

export function getStripEmblemBlendMode(_level: number): string {
  return 'normal'
}
