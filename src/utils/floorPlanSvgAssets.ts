/**
 * Dibujos vectoriales (vista cenital) para el editor de mapas.
 * Cada dibujo se genera como `data:image/svg+xml`, así se pinta con un <img>
 * igual que las imágenes webp antiguas y se ve nítido a cualquier tamaño.
 */

export interface SvgFloorAsset {
  id: string
  label: string
  src: string
  /** Ancho / alto del dibujo. */
  aspect: number
  /** Ancho por defecto en % del lienzo al añadirlo. */
  defaultWidth: number
}

const FONT = "Inter,'Segoe UI',Arial,sans-serif"
const SIZE_FACTOR = 0.11

function svgUri(w: number, h: number, body: string, defs = ''): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}"><defs><filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.1" stdDeviation="1.3" flood-color="#1c1410" flood-opacity="0.38"/></filter>${defs}</defs>${body}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}

function asset(
  id: string,
  label: string,
  w: number,
  h: number,
  body: string,
  options: { defs?: string; defaultWidth?: number } = {},
): SvgFloorAsset {
  return {
    id,
    label,
    src: svgUri(w, h, body, options.defs),
    aspect: w / h,
    defaultWidth: options.defaultWidth ?? Math.max(3, Math.round(w * SIZE_FACTOR)),
  }
}

/* ---------- Paletas de color ---------- */

interface TopColors {
  top: string
  edge: string
  grain: string
}

interface SeatColors {
  seat: string
  back: string
}

interface SofaColors {
  frame: string
  cushion: string
}

const TOP_OAK: TopColors = { top: '#c8925c', edge: '#94653a', grain: '#b37c49' }
const TOP_WALNUT: TopColors = { top: '#6f4b32', edge: '#47301f', grain: '#5d3e29' }
const TOP_WHITE: TopColors = { top: '#fbfaf8', edge: '#d3ccc2', grain: '#ece7e0' }
const TOP_MARBLE: TopColors = { top: '#f2efeb', edge: '#bdb5aa', grain: '#d4cdc3' }
const TOP_BLACK: TopColors = { top: '#36312d', edge: '#191614', grain: '#45403b' }
const TOP_CLOTH: TopColors = { top: '#ffffff', edge: '#cfc8be', grain: '#efe9e1' }

const SEAT_WOOD: SeatColors = { seat: '#b9824f', back: '#83552f' }
const SEAT_BLACK: SeatColors = { seat: '#3d3935', back: '#1d1a18' }
const SEAT_WHITE: SeatColors = { seat: '#f5f2ed', back: '#c9c0b4' }
const SEAT_GREEN: SeatColors = { seat: '#62806a', back: '#40594a' }
const SEAT_TERRA: SeatColors = { seat: '#c3693f', back: '#8d4426' }
const SEAT_RATTAN: SeatColors = { seat: '#dcbd84', back: '#ad8a50' }

const SOFA_GREY: SofaColors = { frame: '#77736e', cushion: '#a19c96' }
const SOFA_GREEN: SofaColors = { frame: '#3c5c48', cushion: '#5b7f67' }
const SOFA_LEATHER: SofaColors = { frame: '#6b4127', cushion: '#94603a' }
const SOFA_MUSTARD: SofaColors = { frame: '#b07f22', cushion: '#d6a744' }
const SOFA_BLUE: SofaColors = { frame: '#2f4560', cushion: '#4c6784' }
const SOFA_TERRA: SofaColors = { frame: '#93492b', cushion: '#bf6a43' }

/* ---------- Piezas ---------- */

/** Silla vista desde arriba. El respaldo queda hacia fuera de la mesa. */
function chair(cx: number, cy: number, angle: number, c: SeatColors): string {
  return `<g transform="translate(${cx} ${cy}) rotate(${angle})" filter="url(#sh)"><rect x="-7.5" y="-6" width="15" height="13" rx="3.6" fill="${c.seat}"/><rect x="-7.5" y="-9" width="15" height="4.6" rx="2.3" fill="${c.back}"/></g>`
}

function stool(cx: number, cy: number, c: SeatColors, r = 6.5): string {
  return `<g filter="url(#sh)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.back}"/><circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="${c.seat}"/></g>`
}

function roundTop(cx: number, cy: number, r: number, t: TopColors): string {
  return `<g filter="url(#sh)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.top}" stroke="${t.edge}" stroke-width="2"/></g><circle cx="${cx}" cy="${cy}" r="${(r * 0.7).toFixed(1)}" fill="none" stroke="${t.grain}" stroke-width="0.8"/><ellipse cx="${(cx - r * 0.32).toFixed(1)}" cy="${(cy - r * 0.38).toFixed(1)}" rx="${(r * 0.36).toFixed(1)}" ry="${(r * 0.16).toFixed(1)}" fill="#fff" opacity="0.18"/>`
}

function rectTop(x: number, y: number, w: number, h: number, t: TopColors, rx = 3): string {
  const lines: string[] = []
  for (let i = 1; i < 4; i += 1) {
    const ly = (y + (h * i) / 4).toFixed(1)
    lines.push(`<line x1="${x + 4}" y1="${ly}" x2="${x + w - 4}" y2="${ly}" stroke="${t.grain}" stroke-width="0.7"/>`)
  }
  return `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${t.top}" stroke="${t.edge}" stroke-width="2"/></g>${lines.join('')}<rect x="${x + 3}" y="${y + 2.5}" width="${(w * 0.4).toFixed(1)}" height="${(h * 0.14).toFixed(1)}" rx="1.5" fill="#fff" opacity="0.16"/>`
}

function marbleVeins(cx: number, cy: number, r: number): string {
  return `<path d="M${cx - r * 0.7} ${cy - r * 0.2} q${r * 0.4} ${-r * 0.3} ${r * 0.8} ${r * 0.1} t${r * 0.6} ${-r * 0.1}" fill="none" stroke="#c9c1b6" stroke-width="0.6"/><path d="M${cx - r * 0.4} ${cy + r * 0.45} q${r * 0.5} ${-r * 0.2} ${r * 1} ${r * 0.05}" fill="none" stroke="#d5cec4" stroke-width="0.5"/>`
}

function roundTable(
  id: string,
  label: string,
  seats: number,
  top: TopColors,
  seat: SeatColors,
  veins = false,
): SvgFloorAsset {
  const size = seats > 4 ? 112 : 100
  const c = size / 2
  const tableR = seats > 4 ? 26 : seats > 2 ? 22 : 19
  const chairR = tableR + 11
  const chairs = Array.from({ length: seats }, (_, i) => {
    const angle = (360 / seats) * i + (seats === 2 ? 90 : seats === 4 ? 45 : 0)
    const rad = (angle * Math.PI) / 180
    return chair(c + chairR * Math.sin(rad), c - chairR * Math.cos(rad), angle, seat)
  }).join('')
  return asset(id, label, size, size, chairs + roundTop(c, c, tableR, top) + (veins ? marbleVeins(c, c, tableR) : ''))
}

function squareTable(id: string, label: string, seats: 2 | 4, top: TopColors, seat: SeatColors): SvgFloorAsset {
  const angles = seats === 2 ? [90, 270] : [0, 90, 180, 270]
  const chairs = angles
    .map((angle) => {
      const rad = (angle * Math.PI) / 180
      return chair(50 + 33 * Math.sin(rad), 50 - 33 * Math.cos(rad), angle, seat)
    })
    .join('')
  return asset(id, label, 100, 100, chairs + rectTop(28, 28, 44, 44, top, 3))
}

function longTable(
  id: string,
  label: string,
  perSide: number,
  ends: boolean,
  top: TopColors,
  seat: SeatColors,
  cloth = false,
): SvgFloorAsset {
  const spacing = 34
  const tableW = perSide * spacing + 12
  const pad = ends ? 24 : 8
  const w = tableW + pad * 2
  const h = 100
  const x0 = pad
  const chairs: string[] = []
  for (let i = 0; i < perSide; i += 1) {
    const cx = x0 + 6 + spacing / 2 + i * spacing
    chairs.push(chair(cx, 20, 0, seat), chair(cx, 80, 180, seat))
  }
  if (ends) {
    chairs.push(chair(x0 - 11, 50, 270, seat), chair(x0 + tableW + 11, 50, 90, seat))
  }
  const clothDetail = cloth
    ? `<rect x="${x0 + 4}" y="35" width="${tableW - 8}" height="30" rx="2" fill="none" stroke="#ddd5ca" stroke-width="0.8" stroke-dasharray="2 2"/>`
    : ''
  return asset(id, label, w, h, chairs.join('') + rectTop(x0, 30, tableW, 40, top, 3) + clothDetail)
}

function sofaBlock(x: number, y: number, w: number, h: number, seats: number, c: SofaColors): string {
  const back = h * 0.3
  const arm = Math.min(9, h * 0.22)
  const innerW = w - arm * 2
  const cushionW = innerW / seats
  const cushions = Array.from({ length: seats }, (_, i) => {
    const cxp = x + arm + i * cushionW
    return `<rect x="${(cxp + 0.6).toFixed(1)}" y="${(y + back).toFixed(1)}" width="${(cushionW - 1.2).toFixed(1)}" height="${(h - back - 2).toFixed(1)}" rx="3" fill="${c.cushion}"/><rect x="${(cxp + 2).toFixed(1)}" y="${(y + back + 1.5).toFixed(1)}" width="${(cushionW - 4).toFixed(1)}" height="2" rx="1" fill="#fff" opacity="0.14"/>`
  }).join('')
  return `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${c.frame}"/></g>${cushions}`
}

function sofa(id: string, label: string, seats: number, c: SofaColors): SvgFloorAsset {
  const w = 14 + seats * 32
  return asset(id, label, w + 8, 52, sofaBlock(4, 4, w, 44, seats, c))
}

function armchair(id: string, label: string, c: SofaColors): SvgFloorAsset {
  return asset(id, label, 52, 52, sofaBlock(4, 4, 44, 44, 1, c), { defaultWidth: 5 })
}

function leaf(cx: number, cy: number, angle: number, dist: number, rx: number, ry: number, fill: string): string {
  return `<g transform="translate(${cx} ${cy}) rotate(${angle})"><ellipse cx="0" cy="${-dist}" rx="${rx}" ry="${ry}" fill="${fill}"/><line x1="0" y1="${-dist + ry * 0.85}" x2="0" y2="${-dist - ry * 0.85}" stroke="#ffffff" stroke-opacity="0.28" stroke-width="0.7"/></g>`
}

const GREENS = ['#3f7d4e', '#4f9a5f', '#2f6b40', '#5aa66a']

function pot(cx: number, cy: number, r: number, color = '#b5653d'): string {
  return `<g filter="url(#sh)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/></g><circle cx="${cx}" cy="${cy}" r="${r - 2.5}" fill="#5a3b26"/>`
}

/* ---------- Mesas ---------- */

export const SVG_TABLE_ASSETS: SvgFloorAsset[] = [
  roundTable('svg_round2_oak', 'Redonda 2 · roble', 2, TOP_OAK, SEAT_WOOD),
  roundTable('svg_round4_oak', 'Redonda 4 · roble', 4, TOP_OAK, SEAT_BLACK),
  roundTable('svg_round4_marble', 'Redonda 4 · mármol', 4, TOP_MARBLE, SEAT_GREEN, true),
  roundTable('svg_round4_white', 'Redonda 4 · blanca', 4, TOP_WHITE, SEAT_RATTAN),
  roundTable('svg_round6_walnut', 'Redonda 6 · nogal', 6, TOP_WALNUT, SEAT_TERRA),
  squareTable('svg_square2_black', 'Cuadrada 2 · negra', 2, TOP_BLACK, SEAT_WOOD),
  squareTable('svg_square4_oak', 'Cuadrada 4 · roble', 4, TOP_OAK, SEAT_WHITE),
  squareTable('svg_square4_walnut', 'Cuadrada 4 · nogal', 4, TOP_WALNUT, SEAT_GREEN),
  longTable('svg_rect6_oak', 'Rectangular 6', 3, false, TOP_OAK, SEAT_BLACK),
  longTable('svg_rect8_cloth', 'Banquete 8 · mantel', 3, true, TOP_CLOTH, SEAT_WHITE, true),
  longTable('svg_rect10_walnut', 'Larga 10', 4, true, TOP_WALNUT, SEAT_RATTAN),
  asset(
    'svg_high4',
    'Alta con taburetes',
    100,
    100,
    [45, 135, 225, 315]
      .map((angle) => {
        const rad = (angle * Math.PI) / 180
        return stool(50 + 30 * Math.sin(rad), 50 - 30 * Math.cos(rad), SEAT_BLACK)
      })
      .join('') + roundTop(50, 50, 17, TOP_WALNUT),
    { defaultWidth: 10 },
  ),
  asset(
    'svg_booth',
    'Reservado en U',
    140,
    112,
    `<g filter="url(#sh)"><path d="M6 12 a8 8 0 0 1 8 -8 h112 a8 8 0 0 1 8 8 v92 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 v-74 h-88 v74 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 z" fill="${SOFA_TERRA.frame}"/></g><rect x="24" y="18" width="92" height="10" rx="3" fill="${SOFA_TERRA.cushion}"/><rect x="20" y="22" width="12" height="80" rx="3" fill="${SOFA_TERRA.cushion}"/><rect x="108" y="22" width="12" height="80" rx="3" fill="${SOFA_TERRA.cushion}"/>${rectTop(40, 40, 60, 44, TOP_OAK, 3)}`,
    { defaultWidth: 15 },
  ),
  asset(
    'svg_lounge',
    'Zona chill',
    140,
    120,
    `${sofaBlock(22, 4, 96, 34, 3, SOFA_GREY)}${sofaBlock(6, 76, 38, 38, 1, SOFA_MUSTARD)}${sofaBlock(96, 76, 38, 38, 1, SOFA_MUSTARD)}${roundTop(70, 66, 16, TOP_WALNUT)}`,
    { defaultWidth: 16 },
  ),
]

/* ---------- Asientos ---------- */

export const SVG_CHAIR_ASSETS: SvgFloorAsset[] = [
  asset('svg_chair_black', 'Silla negra', 24, 24, chair(12, 13, 0, SEAT_BLACK), { defaultWidth: 3 }),
  asset('svg_chair_rattan', 'Silla ratán', 24, 24, chair(12, 13, 0, SEAT_RATTAN), { defaultWidth: 3 }),
  asset('svg_stool', 'Taburete', 22, 22, stool(11, 11, SEAT_WOOD, 8), { defaultWidth: 3 }),
]

export const SVG_SOFA_ASSETS: SvgFloorAsset[] = [
  sofa('svg_sofa2_grey', 'Sofá 2 · gris', 2, SOFA_GREY),
  sofa('svg_sofa3_green', 'Sofá 3 · verde', 3, SOFA_GREEN),
  sofa('svg_sofa3_leather', 'Sofá 3 · cuero', 3, SOFA_LEATHER),
  sofa('svg_sofa3_blue', 'Sofá 3 · azul', 3, SOFA_BLUE),
  asset(
    'svg_sofa_l',
    'Sofá en L',
    120,
    100,
    `<g filter="url(#sh)"><path d="M4 9 a5 5 0 0 1 5 -5 h102 a5 5 0 0 1 5 5 v30 a5 5 0 0 1 -5 5 h-67 v47 a5 5 0 0 1 -5 5 h-30 a5 5 0 0 1 -5 -5 z" fill="${SOFA_GREY.frame}"/></g><rect x="16" y="16" width="27" height="26" rx="3" fill="${SOFA_GREY.cushion}"/><rect x="44.5" y="16" width="30" height="26" rx="3" fill="${SOFA_GREY.cushion}"/><rect x="76" y="16" width="30" height="26" rx="3" fill="${SOFA_GREY.cushion}"/><rect x="16" y="43.5" width="27" height="22" rx="3" fill="${SOFA_GREY.cushion}"/><rect x="16" y="67" width="27" height="21" rx="3" fill="${SOFA_GREY.cushion}"/>`,
    { defaultWidth: 13 },
  ),
  armchair('svg_armchair_mustard', 'Butaca mostaza', SOFA_MUSTARD),
  armchair('svg_armchair_blue', 'Butaca azul', SOFA_BLUE),
  asset(
    'svg_pouf',
    'Puf',
    40,
    40,
    `<g filter="url(#sh)"><circle cx="20" cy="20" r="16" fill="#c9a77c"/></g><circle cx="20" cy="20" r="11" fill="none" stroke="#b08d61" stroke-width="1"/><circle cx="20" cy="20" r="2" fill="#a17f53"/>`,
    { defaultWidth: 4 },
  ),
  asset(
    'svg_bench',
    'Banco corrido',
    180,
    30,
    `<g filter="url(#sh)"><rect x="4" y="4" width="172" height="22" rx="4" fill="${SOFA_LEATHER.frame}"/></g>${[0, 1, 2, 3, 4]
      .map((i) => `<rect x="${(8 + i * 33.2).toFixed(1)}" y="11" width="32" height="12" rx="2.5" fill="${SOFA_LEATHER.cushion}"/>`)
      .join('')}`,
    { defaultWidth: 20 },
  ),
]

/* ---------- Barra ---------- */

const BAR_TOP = '#a8743f'
const BAR_FRONT = '#4a3122'

function barCounter(x: number, y: number, w: number, h: number): string {
  const glasses = [0.2, 0.45, 0.72]
    .map((p) => `<circle cx="${(x + w * p).toFixed(1)}" cy="${(y + h * 0.42).toFixed(1)}" r="2.4" fill="#e6f1f5" stroke="#9fb7c0" stroke-width="0.6"/>`)
    .join('')
  return `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${BAR_FRONT}"/></g><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 11}" rx="2.5" fill="${BAR_TOP}"/><line x1="${x + 6}" y1="${y + h * 0.3}" x2="${x + w - 6}" y2="${y + h * 0.3}" stroke="#946233" stroke-width="0.7"/><line x1="${x + 6}" y1="${y + h * 0.55}" x2="${x + w - 6}" y2="${y + h * 0.55}" stroke="#946233" stroke-width="0.7"/>${glasses}`
}

export const SVG_BAR_ASSETS: SvgFloorAsset[] = [
  asset('svg_bar_straight', 'Barra recta', 200, 40, barCounter(4, 4, 192, 32), { defaultWidth: 24 }),
  asset(
    'svg_bar_stools',
    'Barra con taburetes',
    200,
    68,
    barCounter(4, 4, 192, 32) + [26, 62, 98, 134, 170].map((x) => stool(x, 54, SEAT_BLACK, 7)).join(''),
    { defaultWidth: 24 },
  ),
  asset(
    'svg_bar_l',
    'Barra en L',
    160,
    130,
    `<g filter="url(#sh)"><path d="M4 8 a4 4 0 0 1 4 -4 h144 a4 4 0 0 1 4 4 v114 a4 4 0 0 1 -4 4 h-24 a4 4 0 0 1 -4 -4 v-86 h-116 a4 4 0 0 1 -4 -4 z" fill="${BAR_FRONT}"/></g><path d="M7 9 a2 2 0 0 1 2 -2 h142 a2 2 0 0 1 2 2 v110 a2 2 0 0 1 -2 2 h-17 v-90 h-125 a2 2 0 0 1 -2 -2 z" fill="${BAR_TOP}"/>${[22, 54, 86].map((x) => stool(x, 50, SEAT_BLACK, 7)).join('')}${[62, 96].map((y) => stool(108, y, SEAT_BLACK, 7)).join('')}`,
    { defaultWidth: 19 },
  ),
  asset(
    'svg_bottle_shelf',
    'Botellero',
    160,
    28,
    `<g filter="url(#sh)"><rect x="4" y="4" width="152" height="20" rx="2" fill="#3a2a1f"/></g>${Array.from({ length: 16 }, (_, i) => {
      const colors = ['#2f6b40', '#9c5b1c', '#d8e4e6', '#6b2424']
      return `<circle cx="${12 + i * 9}" cy="14" r="3.4" fill="${colors[i % 4]}" stroke="#00000033" stroke-width="0.6"/><circle cx="${11 + i * 9}" cy="13" r="1" fill="#fff" opacity="0.5"/>`
    }).join('')}`,
    { defaultWidth: 18 },
  ),
  asset(
    'svg_coffee',
    'Cafetera',
    60,
    40,
    `<g filter="url(#sh)"><rect x="4" y="4" width="52" height="32" rx="4" fill="#b9bdc2"/></g><rect x="8" y="8" width="44" height="12" rx="2" fill="#d8dbde"/><circle cx="18" cy="27" r="4" fill="#3d3935"/><circle cx="42" cy="27" r="4" fill="#3d3935"/><rect x="27" y="23" width="6" height="8" rx="1" fill="#8d9196"/>`,
    { defaultWidth: 6 },
  ),
]

/* ---------- Plantas ---------- */

function leafyPlant(id: string, label: string, size: number, leaves: number, potColor: string): SvgFloorAsset {
  const c = size / 2
  const potR = size * 0.24
  const parts = Array.from({ length: leaves }, (_, i) =>
    leaf(c, c, (360 / leaves) * i + 12, size * 0.24, size * 0.1, size * 0.2, GREENS[i % GREENS.length]),
  ).join('')
  return asset(id, label, size, size, `${pot(c, c, potR, potColor)}<g filter="url(#sh)">${parts}</g>`, {
    defaultWidth: Math.round(size * 0.1),
  })
}

export const SVG_PLANT_ASSETS: SvgFloorAsset[] = [
  leafyPlant('svg_plant_monstera', 'Planta grande', 64, 8, '#b5653d'),
  leafyPlant('svg_plant_small', 'Planta pequeña', 40, 6, '#e8e2d8'),
  asset(
    'svg_plant_palm',
    'Palmera',
    90,
    90,
    `${pot(45, 45, 14, '#8a8178')}<g filter="url(#sh)">${Array.from({ length: 9 }, (_, i) =>
      leaf(45, 45, i * 40 + 8, 22, 4.6, 21, i % 2 ? '#5b8a3a' : '#6f9e47'),
    ).join('')}</g><circle cx="45" cy="45" r="5" fill="#7a5a3a"/>`,
    { defaultWidth: 9 },
  ),
  asset(
    'svg_plant_tree',
    'Árbol / olivo',
    90,
    90,
    `<g filter="url(#sh)"><circle cx="38" cy="36" r="22" fill="#6d7f48"/><circle cx="56" cy="40" r="22" fill="#7d8f55"/><circle cx="44" cy="56" r="22" fill="#647542"/><circle cx="60" cy="58" r="16" fill="#76884f"/></g>${[
      [34, 30], [52, 34], [44, 50], [62, 54], [30, 52], [56, 22], [40, 66],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#9aab6c" opacity="0.7"/>`)
      .join('')}`,
    { defaultWidth: 9 },
  ),
  asset(
    'svg_plant_flowers',
    'Maceta con flores',
    56,
    56,
    `${pot(28, 28, 15, '#c9774d')}<g filter="url(#sh)">${Array.from({ length: 7 }, (_, i) => leaf(28, 28, i * 51, 11, 4, 8, GREENS[i % 4])).join('')}</g>${[
      [22, 22, '#e86a8a'], [34, 20, '#f2c14e'], [30, 33, '#e86a8a'], [20, 33, '#ffffff'], [37, 30, '#b07cd8'], [27, 26, '#ffffff'],
    ]
      .map(([x, y, color]) => `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/><circle cx="${x}" cy="${y}" r="1" fill="#f6d36b"/>`)
      .join('')}`,
    { defaultWidth: 5 },
  ),
  asset(
    'svg_planter',
    'Jardinera',
    160,
    40,
    `<g filter="url(#sh)"><rect x="4" y="6" width="152" height="30" rx="4" fill="#8a8178"/></g><rect x="8" y="10" width="144" height="22" rx="2" fill="#5a3b26"/><g filter="url(#sh)">${Array.from({ length: 9 }, (_, i) =>
      `<circle cx="${16 + i * 16}" cy="${i % 2 ? 19 : 23}" r="${i % 3 === 0 ? 10 : 9}" fill="${GREENS[i % 4]}"/>`,
    ).join('')}</g>`,
    { defaultWidth: 18 },
  ),
  asset(
    'svg_hedge',
    'Seto',
    160,
    32,
    `<g filter="url(#sh)">${Array.from({ length: 11 }, (_, i) =>
      `<circle cx="${10 + i * 14}" cy="${i % 2 ? 14 : 18}" r="11" fill="${i % 2 ? '#3d6b3f' : '#4a7c4a'}"/>`,
    ).join('')}</g>${Array.from({ length: 14 }, (_, i) =>
      `<circle cx="${8 + i * 11}" cy="${i % 3 === 0 ? 11 : 17}" r="2" fill="#6c9b5e" opacity="0.7"/>`,
    ).join('')}`,
    { defaultWidth: 18 },
  ),
]

/* ---------- Puertas, ventanas y paredes ---------- */

const LINE = '#3b3632'

export const SVG_DOOR_ASSETS: SvgFloorAsset[] = [
  asset(
    'svg_door_single',
    'Puerta',
    66,
    66,
    `<rect x="0" y="60" width="5" height="6" fill="${LINE}"/><rect x="61" y="60" width="5" height="6" fill="${LINE}"/><path d="M5 62 L5 6 A56 56 0 0 1 61 62 Z" fill="#c8a77a" fill-opacity="0.18"/><path d="M5 6 A56 56 0 0 1 61 62" fill="none" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 2.5"/><rect x="3" y="6" width="4" height="56" rx="1" fill="#8a6440" stroke="${LINE}" stroke-width="0.8"/>`,
    { defaultWidth: 7 },
  ),
  asset(
    'svg_door_double',
    'Puerta doble',
    122,
    66,
    `<rect x="0" y="60" width="5" height="6" fill="${LINE}"/><rect x="117" y="60" width="5" height="6" fill="${LINE}"/><path d="M5 62 L5 6 A56 56 0 0 1 61 62 Z M117 62 L117 6 A56 56 0 0 0 61 62 Z" fill="#c8a77a" fill-opacity="0.18"/><path d="M5 6 A56 56 0 0 1 61 62 M117 6 A56 56 0 0 0 61 62" fill="none" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 2.5"/><rect x="3" y="6" width="4" height="56" rx="1" fill="#8a6440" stroke="${LINE}" stroke-width="0.8"/><rect x="115" y="6" width="4" height="56" rx="1" fill="#8a6440" stroke="${LINE}" stroke-width="0.8"/>`,
    { defaultWidth: 12 },
  ),
  asset(
    'svg_door_sliding',
    'Puerta corredera',
    120,
    24,
    `<rect x="0" y="9" width="6" height="8" fill="${LINE}"/><rect x="114" y="9" width="6" height="8" fill="${LINE}"/><rect x="6" y="7" width="60" height="4" rx="1" fill="#8a6440"/><rect x="54" y="14" width="60" height="4" rx="1" fill="#a47a52"/><path d="M40 21 h22 m-4 -3 l4 3 l-4 3" fill="none" stroke="${LINE}" stroke-width="0.9"/>`,
    { defaultWidth: 12 },
  ),
  asset(
    'svg_entrance',
    'Entrada principal',
    132,
    92,
    `<rect x="0" y="62" width="10" height="6" fill="${LINE}"/><rect x="122" y="62" width="10" height="6" fill="${LINE}"/><path d="M10 64 L10 8 A56 56 0 0 1 66 64 Z M122 64 L122 8 A56 56 0 0 0 66 64 Z" fill="#c8a77a" fill-opacity="0.18"/><path d="M10 8 A56 56 0 0 1 66 64 M122 8 A56 56 0 0 0 66 64" fill="none" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 2.5"/><rect x="8" y="8" width="4" height="56" rx="1" fill="#8a6440"/><rect x="120" y="8" width="4" height="56" rx="1" fill="#8a6440"/><g filter="url(#sh)"><rect x="30" y="70" width="72" height="18" rx="2" fill="#3d3632"/></g><text x="66" y="82.5" text-anchor="middle" font-family="${FONT}" font-size="8" font-weight="700" letter-spacing="1.6" fill="#f3ede4">ENTRADA</text>`,
    { defaultWidth: 13 },
  ),
]

function glass(w: number, panes: number): string {
  const paneW = (w - 8) / panes
  const mullions = Array.from({ length: panes - 1 }, (_, i) => {
    const x = (4 + paneW * (i + 1)).toFixed(1)
    return `<rect x="${(Number(x) - 1).toFixed(1)}" y="2" width="2" height="12" fill="#5c6670"/>`
  }).join('')
  const shines = Array.from({ length: panes }, (_, i) => {
    const x = 4 + paneW * i + paneW * 0.25
    return `<line x1="${x.toFixed(1)}" y1="11" x2="${(x + 5).toFixed(1)}" y2="5" stroke="#fff" stroke-opacity="0.7" stroke-width="0.8"/>`
  }).join('')
  return `<rect x="0" y="2" width="4" height="12" fill="${LINE}"/><rect x="${w - 4}" y="2" width="4" height="12" fill="${LINE}"/><rect x="4" y="4" width="${w - 8}" height="8" fill="#cfe5ee" stroke="#5c6670" stroke-width="1"/>${mullions}${shines}`
}

export const SVG_WINDOW_ASSETS: SvgFloorAsset[] = [
  asset('svg_window', 'Ventana', 100, 16, glass(100, 2), { defaultWidth: 11 }),
  asset('svg_window_wide', 'Ventanal', 200, 16, glass(200, 4), { defaultWidth: 22 }),
]

export const SVG_WALL_ASSETS: SvgFloorAsset[] = [
  asset('svg_wall', 'Pared', 200, 10, `<rect x="0" y="1" width="200" height="8" fill="#4a4541"/><rect x="0" y="1" width="200" height="1.5" fill="#fff" opacity="0.12"/>`, { defaultWidth: 22 }),
  asset(
    'svg_wall_brick',
    'Pared de ladrillo',
    200,
    12,
    `<rect x="0" y="0" width="200" height="12" fill="#a4553a"/>${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 10 + 5}" y1="0" x2="${i * 10 + 5}" y2="6" stroke="#e7d6c6" stroke-width="0.8"/><line x1="${i * 10}" y1="6" x2="${i * 10}" y2="12" stroke="#e7d6c6" stroke-width="0.8"/>`).join('')}<line x1="0" y1="6" x2="200" y2="6" stroke="#e7d6c6" stroke-width="0.8"/>`,
    { defaultWidth: 22 },
  ),
  asset(
    'svg_column_round',
    'Columna redonda',
    40,
    40,
    `<g filter="url(#sh)"><circle cx="20" cy="20" r="15" fill="#b8b2aa" stroke="#8f8880" stroke-width="1.4"/></g><circle cx="16" cy="16" r="5" fill="#fff" opacity="0.18"/>`,
    { defaultWidth: 4 },
  ),
  asset(
    'svg_column_square',
    'Columna cuadrada',
    40,
    40,
    `<g filter="url(#sh)"><rect x="6" y="6" width="28" height="28" rx="1.5" fill="#57524d"/></g><path d="M6 6 L34 34 M34 6 L6 34" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>`,
    { defaultWidth: 4 },
  ),
]

/* ---------- Decoración ---------- */

export const SVG_DECOR_ASSETS: SvgFloorAsset[] = [
  asset(
    'svg_fountain',
    'Fuente',
    120,
    120,
    `<g filter="url(#sh)"><circle cx="60" cy="60" r="55" fill="#d2c9bb" stroke="#a59b8d" stroke-width="2.5"/></g><circle cx="60" cy="60" r="47" fill="url(#water)"/><circle cx="60" cy="60" r="38" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="1"/><circle cx="60" cy="60" r="29" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1"/><g filter="url(#sh)"><circle cx="60" cy="60" r="17" fill="#d2c9bb" stroke="#a59b8d" stroke-width="1.6"/></g><circle cx="60" cy="60" r="12" fill="#8cc6dc"/><circle cx="60" cy="60" r="4" fill="#fff" opacity="0.9"/>${Array.from({ length: 10 }, (_, i) => {
      const rad = (i * 36 * Math.PI) / 180
      return `<circle cx="${(60 + 22 * Math.cos(rad)).toFixed(1)}" cy="${(60 + 22 * Math.sin(rad)).toFixed(1)}" r="1.4" fill="#fff" opacity="0.8"/>`
    }).join('')}`,
    {
      defs: '<radialGradient id="water" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#a9dcec"/><stop offset="1" stop-color="#4f9cbf"/></radialGradient>',
      defaultWidth: 12,
    },
  ),
  asset(
    'svg_piano',
    'Piano de cola',
    110,
    122,
    `<g filter="url(#sh)"><path d="M8 90 L8 22 Q8 4 28 4 Q48 4 54 26 Q60 46 84 52 Q104 57 104 76 L104 90 Z" fill="#161412"/></g><path d="M14 84 L14 24 Q14 10 28 10 Q44 10 49 28 Q55 50 82 57 Q98 61 98 76 L98 84 Z" fill="none" stroke="#3b3632" stroke-width="1"/><rect x="8" y="90" width="96" height="12" fill="#f7f4ee" stroke="#161412" stroke-width="1"/>${Array.from({ length: 13 }, (_, i) => `<rect x="${12 + i * 7}" y="90" width="3.2" height="7" fill="#161412"/>`).join('')}<g filter="url(#sh)"><rect x="34" y="106" width="44" height="12" rx="2" fill="#2a2522"/></g>`,
    { defaultWidth: 10 },
  ),
  asset(
    'svg_fireplace',
    'Chimenea',
    120,
    48,
    `<g filter="url(#sh)"><rect x="2" y="2" width="116" height="44" rx="2" fill="#9a928a"/></g>${[[6, 6, 22, 10], [30, 6, 18, 10], [72, 6, 20, 10], [94, 6, 20, 10], [6, 18, 18, 10], [96, 18, 18, 10], [6, 30, 24, 12], [90, 30, 24, 12]]
      .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#aea69d"/>`)
      .join('')}<rect x="30" y="16" width="60" height="26" rx="2" fill="#2a2522"/><ellipse cx="60" cy="34" rx="20" ry="6" fill="#e0641c"/><ellipse cx="54" cy="31" rx="9" ry="7" fill="#f08a24"/><ellipse cx="66" cy="31" rx="8" ry="6" fill="#f08a24"/><ellipse cx="60" cy="30" rx="6" ry="6" fill="#f8c445"/>`,
    { defaultWidth: 13 },
  ),
  asset(
    'svg_rug_round',
    'Alfombra redonda',
    120,
    120,
    `<circle cx="60" cy="60" r="57" fill="#b5643f"/><circle cx="60" cy="60" r="49" fill="none" stroke="#efe3cf" stroke-width="3"/><circle cx="60" cy="60" r="40" fill="#e9dcc4"/><circle cx="60" cy="60" r="28" fill="none" stroke="#b5643f" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="60" cy="60" r="12" fill="#b5643f"/>`,
    { defaultWidth: 14 },
  ),
  asset(
    'svg_rug_rect',
    'Alfombra',
    184,
    120,
    `${Array.from({ length: 22 }, (_, i) => `<line x1="2" y1="${10 + i * 4.7}" x2="8" y2="${10 + i * 4.7}" stroke="#e9dcc4" stroke-width="1.2"/><line x1="176" y1="${10 + i * 4.7}" x2="182" y2="${10 + i * 4.7}" stroke="#e9dcc4" stroke-width="1.2"/>`).join('')}<rect x="8" y="6" width="168" height="108" rx="2" fill="#3f5873"/><rect x="16" y="14" width="152" height="92" fill="none" stroke="#e9dcc4" stroke-width="2"/><rect x="24" y="22" width="136" height="76" fill="#f0e6d4"/><path d="M92 34 L124 60 L92 86 L60 60 Z" fill="#3f5873"/><path d="M92 46 L108 60 L92 74 L76 60 Z" fill="#c98a4b"/>`,
    { defaultWidth: 18 },
  ),
  asset(
    'svg_stage',
    'Escenario',
    200,
    100,
    `<g filter="url(#sh)"><rect x="4" y="4" width="192" height="92" rx="3" fill="#7a5233"/></g>${Array.from({ length: 8 }, (_, i) => `<line x1="6" y1="${14 + i * 10}" x2="194" y2="${14 + i * 10}" stroke="#6a4529" stroke-width="0.9"/>`).join('')}<rect x="4" y="86" width="192" height="10" rx="2" fill="#5a3a22"/><g filter="url(#sh)"><rect x="14" y="14" width="22" height="22" rx="2" fill="#1f1c1a"/><rect x="164" y="14" width="22" height="22" rx="2" fill="#1f1c1a"/></g><circle cx="25" cy="25" r="6" fill="#3d3935"/><circle cx="175" cy="25" r="6" fill="#3d3935"/><circle cx="100" cy="58" r="4" fill="#2a2522"/><circle cx="100" cy="58" r="1.6" fill="#bfbfbf"/>`,
    { defaultWidth: 22 },
  ),
  asset(
    'svg_umbrella',
    'Sombrilla',
    100,
    100,
    `<g filter="url(#sh)">${Array.from({ length: 8 }, (_, i) => {
      const a1 = ((i * 45 - 22.5) * Math.PI) / 180
      const a2 = (((i + 1) * 45 - 22.5) * Math.PI) / 180
      return `<path d="M50 50 L${(50 + 46 * Math.cos(a1)).toFixed(1)} ${(50 + 46 * Math.sin(a1)).toFixed(1)} L${(50 + 46 * Math.cos(a2)).toFixed(1)} ${(50 + 46 * Math.sin(a2)).toFixed(1)} Z" fill="${i % 2 ? '#f4efe6' : '#c0673f'}"/>`
    }).join('')}</g><circle cx="50" cy="50" r="3.5" fill="#6b5a4a"/>`,
    { defaultWidth: 11 },
  ),
  asset(
    'svg_lamp',
    'Lámpara de pie',
    40,
    40,
    `<circle cx="20" cy="20" r="18" fill="url(#glow)"/><g filter="url(#sh)"><circle cx="20" cy="20" r="9" fill="#efe2c4" stroke="#b49a6a" stroke-width="1.2"/></g><circle cx="20" cy="20" r="2" fill="#6b5a4a"/>`,
    {
      defs: '<radialGradient id="glow"><stop offset="0" stop-color="#ffd76a" stop-opacity="0.75"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>',
      defaultWidth: 4,
    },
  ),
  asset(
    'svg_tv',
    'Pantalla / TV',
    100,
    14,
    `<g filter="url(#sh)"><rect x="2" y="3" width="96" height="8" rx="1.5" fill="#1b1b1d"/></g><rect x="8" y="5" width="84" height="2" rx="1" fill="#4a5c70"/>`,
    { defaultWidth: 10 },
  ),
  asset(
    'svg_sideboard',
    'Aparador',
    120,
    36,
    `<g filter="url(#sh)"><rect x="4" y="4" width="112" height="28" rx="2" fill="${TOP_WALNUT.top}" stroke="${TOP_WALNUT.edge}" stroke-width="1.4"/></g><line x1="8" y1="14" x2="112" y2="14" stroke="${TOP_WALNUT.grain}" stroke-width="0.8"/><line x1="8" y1="22" x2="112" y2="22" stroke="${TOP_WALNUT.grain}" stroke-width="0.8"/>${pot(22, 18, 7, '#e8e2d8')}${leaf(22, 18, 0, 5, 2.4, 5, '#4f9a5f')}${leaf(22, 18, 120, 5, 2.4, 5, '#3f7d4e')}${leaf(22, 18, 240, 5, 2.4, 5, '#5aa66a')}`,
    { defaultWidth: 13 },
  ),
]

/* ---------- Zonas ---------- */

function zoneLabel(x: number, y: number, text: string, size = 10): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="700" letter-spacing="1.8" fill="#57534e">${text}</text>`
}

export const SVG_ZONE_ASSETS: SvgFloorAsset[] = [
  asset(
    'svg_zone_kitchen',
    'Cocina',
    180,
    120,
    `<rect x="2" y="2" width="176" height="116" fill="url(#tiles)" stroke="${LINE}" stroke-width="3"/><g filter="url(#sh)"><rect x="8" y="8" width="164" height="24" rx="2" fill="#c3c7cc"/><rect x="58" y="56" width="64" height="24" rx="2" fill="#c3c7cc"/></g>${[24, 44, 64, 84]
      .map((x) => `<circle cx="${x}" cy="20" r="6" fill="none" stroke="#2f2f31" stroke-width="2.2"/><circle cx="${x}" cy="20" r="2" fill="#2f2f31"/>`)
      .join('')}<rect x="112" y="11" width="44" height="18" rx="3" fill="#9da3aa"/><circle cx="134" cy="20" r="2" fill="#6b7178"/>${zoneLabel(90, 106, 'COCINA', 11)}`,
    {
      defs: '<pattern id="tiles" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#eef0f1"/><path d="M12 0 H0 V12" fill="none" stroke="#d3d7da" stroke-width="0.8"/></pattern>',
      defaultWidth: 20,
    },
  ),
  asset(
    'svg_zone_wc',
    'Aseos',
    140,
    100,
    `<rect x="2" y="2" width="136" height="96" fill="#eef3f5" stroke="${LINE}" stroke-width="3"/><line x1="70" y1="2" x2="70" y2="62" stroke="${LINE}" stroke-width="2.4"/>${[36, 104]
      .map((x) => `<g filter="url(#sh)"><rect x="${x - 9}" y="8" width="18" height="7" rx="1.5" fill="#fff" stroke="#b9c1c6" stroke-width="0.8"/><ellipse cx="${x}" cy="24" rx="8" ry="10" fill="#fff" stroke="#b9c1c6" stroke-width="0.8"/></g><ellipse cx="${x}" cy="25" rx="4.5" ry="6" fill="#e3ecef"/>`)
      .join('')}<circle cx="28" cy="54" r="5" fill="#57534e"/><path d="M23 70 h10 v-8 a5 5 0 0 0 -10 0 z" fill="#57534e"/><circle cx="112" cy="54" r="5" fill="#57534e"/><path d="M105 72 l7 -12 l7 12 z" fill="#57534e"/>${zoneLabel(70, 88, 'ASEOS', 10)}`,
    { defaultWidth: 15 },
  ),
  asset(
    'svg_zone_stairs',
    'Escalera',
    80,
    140,
    `<rect x="2" y="2" width="76" height="136" fill="#e7e2da" stroke="${LINE}" stroke-width="2.4"/>${Array.from({ length: 11 }, (_, i) => `<line x1="2" y1="${14 + i * 10}" x2="78" y2="${14 + i * 10}" stroke="#8c847a" stroke-width="1"/>`).join('')}<line x1="40" y1="118" x2="40" y2="20" stroke="${LINE}" stroke-width="1.6"/><path d="M33 28 L40 18 L47 28" fill="none" stroke="${LINE}" stroke-width="1.6"/><circle cx="40" cy="118" r="2.6" fill="${LINE}"/><rect x="10" y="126" width="60" height="10" fill="#e7e2da"/>${zoneLabel(40, 134, 'ESCALERA', 7)}`,
    { defaultWidth: 8 },
  ),
  asset(
    'svg_zone_reception',
    'Recepción',
    120,
    70,
    `<g filter="url(#sh)"><path d="M6 10 Q60 64 114 10 L114 22 Q60 78 6 22 Z" fill="${TOP_OAK.top}" stroke="${TOP_OAK.edge}" stroke-width="1.4"/></g><rect x="52" y="22" width="16" height="10" rx="1.5" fill="#2a2522"/><rect x="56" y="33" width="8" height="2" fill="#2a2522"/><circle cx="84" cy="22" r="3.5" fill="#4f9a5f"/>${zoneLabel(60, 66, 'RECEPCIÓN', 7.5)}`,
    { defaultWidth: 13 },
  ),
  asset(
    'svg_zone_storage',
    'Almacén',
    120,
    90,
    `<rect x="2" y="2" width="116" height="86" fill="url(#hatch)" stroke="${LINE}" stroke-width="3"/><rect x="28" y="36" width="64" height="18" rx="3" fill="#f6f3ee"/>${zoneLabel(60, 49, 'ALMACÉN', 9)}`,
    {
      defs: '<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#ece7df"/><line x1="0" y1="0" x2="0" y2="8" stroke="#cfc6ba" stroke-width="2"/></pattern>',
      defaultWidth: 13,
    },
  ),
  asset(
    'svg_zone_terrace',
    'Toldo terraza',
    200,
    60,
    `<g filter="url(#sh)">${Array.from({ length: 10 }, (_, i) => `<rect x="${4 + i * 19.2}" y="4" width="19.2" height="48" fill="${i % 2 ? '#f4efe6' : '#3f6b57'}"/>`).join('')}</g><path d="M4 52 ${Array.from({ length: 10 }, () => `q4.8 6 9.6 0 t9.6 0`).join(' ')}" fill="#3f6b57" opacity="0.9"/>`,
    { defaultWidth: 22 },
  ),
]
