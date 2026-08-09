import title01 from '../assets/levels/strips/titulos sin fondos/titulonivel1.png'
import title02 from '../assets/levels/strips/titulos sin fondos/titulonivel2.png'
import title03 from '../assets/levels/strips/titulos sin fondos/titulonivel3.png'
import title04 from '../assets/levels/strips/titulos sin fondos/titulonivel4.png'
import title05 from '../assets/levels/strips/titulos sin fondos/titulonivel5.png'
import title06 from '../assets/levels/strips/titulos sin fondos/titulonivel6.png'
import title07 from '../assets/levels/strips/titulos sin fondos/titulonivel7.png'
import title08 from '../assets/levels/strips/titulos sin fondos/titulonivel8.png'
import title09 from '../assets/levels/strips/titulos sin fondos/titulonivel9.png'
import title10 from '../assets/levels/strips/titulos sin fondos/titulonivel10.png'
import title11 from '../assets/levels/strips/titulos sin fondos/titulonivel11.png'
import title12 from '../assets/levels/strips/titulos sin fondos/titulonivel12.png'

import stripBg01 from '../assets/levels/strips/strip-bg-level-01.png'
import stripBg02 from '../assets/levels/strips/strip-bg-level-02.png'
import stripBg03 from '../assets/levels/strips/strip-bg-level-03.png'
import stripBg04 from '../assets/levels/strips/strip-bg-level-04.png'
import stripBg05 from '../assets/levels/strips/strip-bg-level-05.png'
import stripBg06 from '../assets/levels/strips/strip-bg-level-06.png'
import stripBg07 from '../assets/levels/strips/strip-bg-level-07.png'
import stripBg08 from '../assets/levels/strips/strip-bg-level-08.png'
import stripBg09 from '../assets/levels/strips/strip-bg-level-09.png'
import stripBg10 from '../assets/levels/strips/strip-bg-level-10.png'
import stripBg11 from '../assets/levels/strips/strip-bg-level-11.png'
import stripBg12 from '../assets/levels/strips/strip-bg-level-12.png'

import shield01 from '../assets/levels/strips/escudos sin fondos/nivel1.png'
import shield02 from '../assets/levels/strips/escudos sin fondos/nivel2.png'
import shield03 from '../assets/levels/strips/escudos sin fondos/nivel3.png'
import shield04 from '../assets/levels/strips/escudos sin fondos/nivel4.png'
import shield05 from '../assets/levels/strips/escudos sin fondos/nivel5.png'
import shield06 from '../assets/levels/strips/escudos sin fondos/nivel6.png'
import shield07 from '../assets/levels/strips/escudos sin fondos/nivel7.png'
import shield08 from '../assets/levels/strips/escudos sin fondos/nivel8.png'
import shield09 from '../assets/levels/strips/escudos sin fondos/nivel9.png'
import shield10 from '../assets/levels/strips/escudos sin fondos/nivel10.png'
import shield11 from '../assets/levels/strips/escudos sin fondos/nivel11.png'
import shield12 from '../assets/levels/strips/escudos sin fondos/nivel12.png'

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
