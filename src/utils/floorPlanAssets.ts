import type { FloorPlanElementType } from '../types/company'
import barra from '../assets/barra.webp'
import columnaCemento from '../assets/columna_cemento.webp'
import columnaRoja from '../assets/columna_roja.webp'
import grifobar from '../assets/grifobar.webp'
import mesa2sillasBlancas from '../assets/mesa2sillas_blancas.webp'
import mesa2sillasNegras from '../assets/mesa2sillas_negras.webp'
import mesaLargaBlanca from '../assets/mesa_larga_blanca.webp'
import mesaLargaMadera from '../assets/mesa_larga_madera.webp'
import mesaLargaNegra from '../assets/mesa_larga negra.webp'
import mesaConsillasGris from '../assets/mesaconsillasalchocadasgris.webp'
import mesaConsillasAmarillas from '../assets/mesaconsillasalcochadasamarillas.webp'
import mesaConsillasRojas from '../assets/mesaconsillasalcochadasrojas.webp'
import mesas2sillas from '../assets/mesas2sillas.webp'
import puerta from '../assets/puerta.webp'
import sillaMadera from '../assets/silla_madera.webp'
import sillaRoja from '../assets/silla_roja.webp'
import ventana from '../assets/ventana.webp'
import {
  SVG_BAR_ASSETS,
  SVG_CHAIR_ASSETS,
  SVG_DECOR_ASSETS,
  SVG_DOOR_ASSETS,
  SVG_PLANT_ASSETS,
  SVG_SOFA_ASSETS,
  SVG_TABLE_ASSETS,
  SVG_WALL_ASSETS,
  SVG_WINDOW_ASSETS,
  SVG_ZONE_ASSETS,
  type SvgFloorAsset,
} from './floorPlanSvgAssets'

export interface FloorPlanAssetOption {
  id: string
  label: string
  src: string
  defaultWidth?: number
  defaultHeight?: number
}

export interface FloorPlanElementVariantOption extends FloorPlanAssetOption {}

function svgOption(item: SvgFloorAsset): FloorPlanAssetOption {
  return { id: item.id, label: item.label, src: item.src, defaultWidth: item.defaultWidth }
}

const ALL_SVG_ASSETS: SvgFloorAsset[] = [
  ...SVG_TABLE_ASSETS,
  ...SVG_CHAIR_ASSETS,
  ...SVG_SOFA_ASSETS,
  ...SVG_BAR_ASSETS,
  ...SVG_PLANT_ASSETS,
  ...SVG_DOOR_ASSETS,
  ...SVG_WINDOW_ASSETS,
  ...SVG_WALL_ASSETS,
  ...SVG_DECOR_ASSETS,
  ...SVG_ZONE_ASSETS,
]

/** Diseños fotográficos originales. El primero es el diseño por defecto de los mapas ya guardados. */
const PHOTO_TABLE_VARIANTS: FloorPlanAssetOption[] = [
  { id: 'mesas2sillas', label: '2 sillas', src: mesas2sillas },
  { id: 'mesa2sillas_blancas', label: '2 sillas blancas', src: mesa2sillasBlancas },
  { id: 'mesa2sillas_negras', label: '2 sillas negras', src: mesa2sillasNegras },
  { id: 'mesa_larga_madera', label: 'Larga madera', src: mesaLargaMadera, defaultWidth: 22, defaultHeight: 10 },
  { id: 'mesa_larga_blanca', label: 'Larga blanca', src: mesaLargaBlanca, defaultWidth: 22, defaultHeight: 10 },
  { id: 'mesa_larga_negra', label: 'Larga negra', src: mesaLargaNegra, defaultWidth: 22, defaultHeight: 10 },
  { id: 'mesaconsillas_gris', label: 'Sofá gris', src: mesaConsillasGris, defaultWidth: 18, defaultHeight: 14 },
  { id: 'mesaconsillas_amarillas', label: 'Sofá amarillo', src: mesaConsillasAmarillas, defaultWidth: 18, defaultHeight: 14 },
  { id: 'mesaconsillas_rojas', label: 'Sofá rojo', src: mesaConsillasRojas, defaultWidth: 18, defaultHeight: 14 },
]

export const FLOOR_PLAN_TABLE_VARIANTS: FloorPlanAssetOption[] = [
  ...PHOTO_TABLE_VARIANTS,
  ...SVG_TABLE_ASSETS.map(svgOption),
]

/** Orden en el que se enseñan los diseños de mesa: primero los dibujos nuevos. */
export const FLOOR_PLAN_TABLE_PICKER: FloorPlanAssetOption[] = [
  ...SVG_TABLE_ASSETS.map(svgOption),
  ...PHOTO_TABLE_VARIANTS,
]

export const FLOOR_PLAN_ELEMENT_VARIANTS: Record<
  FloorPlanElementType,
  FloorPlanElementVariantOption[]
> = {
  wall: [
    { id: 'columna_cemento', label: 'Columna cemento', src: columnaCemento },
    { id: 'columna_roja', label: 'Columna roja', src: columnaRoja },
    ...SVG_WALL_ASSETS.map(svgOption),
  ],
  window: [
    { id: 'ventana', label: 'Ventana', src: ventana },
    { id: 'grifobar', label: 'Grifo bar', src: grifobar },
    ...SVG_WINDOW_ASSETS.map(svgOption),
  ],
  door: [{ id: 'puerta', label: 'Puerta clásica', src: puerta }, ...SVG_DOOR_ASSETS.map(svgOption)],
  bar: [{ id: 'barra', label: 'Barra clásica', src: barra }, ...SVG_BAR_ASSETS.map(svgOption)],
  chair: [
    { id: 'silla_roja', label: 'Silla roja', src: sillaRoja },
    { id: 'silla_madera', label: 'Silla madera', src: sillaMadera },
    ...SVG_CHAIR_ASSETS.map(svgOption),
  ],
  decor_table: [],
  sofa: SVG_SOFA_ASSETS.map(svgOption),
  plant: SVG_PLANT_ASSETS.map(svgOption),
  decor: SVG_DECOR_ASSETS.map(svgOption),
  zone: SVG_ZONE_ASSETS.map(svgOption),
}

export interface FloorPlanPaletteItem {
  id: string
  type: FloorPlanElementType
  variantId: string
  label: string
  src: string
  defaultWidth?: number
  defaultHeight?: number
}

function toPaletteItem(type: FloorPlanElementType, option: FloorPlanAssetOption): FloorPlanPaletteItem {
  return {
    id: `${type}-${option.id}`,
    type,
    variantId: option.id,
    label: option.label,
    src: option.src,
    defaultWidth: option.defaultWidth,
    defaultHeight: option.defaultHeight,
  }
}

function svgFirst(type: FloorPlanElementType): FloorPlanPaletteItem[] {
  const options = FLOOR_PLAN_ELEMENT_VARIANTS[type]
  const svg = options.filter((option) => option.src.startsWith('data:'))
  const photo = options.filter((option) => !option.src.startsWith('data:'))
  return [...svg, ...photo].map((option) => toPaletteItem(type, option))
}

export type FloorPlanPaletteCategoryId = 'tables' | 'seating' | 'bar' | 'plants' | 'decor' | 'structure'

export interface FloorPlanPaletteCategory {
  id: FloorPlanPaletteCategoryId
  label: string
  hint: string
  items: FloorPlanPaletteItem[]
}

export const FLOOR_PLAN_PALETTE_CATEGORIES: FloorPlanPaletteCategory[] = [
  {
    id: 'tables',
    label: 'Mesas',
    hint: 'Mesas de adorno: no se reservan. Para cambiar el diseño de una mesa reservable, tócala en el mapa.',
    items: FLOOR_PLAN_TABLE_PICKER.map((option) => toPaletteItem('decor_table', option)),
  },
  {
    id: 'seating',
    label: 'Asientos',
    hint: 'Sofás, butacas, sillas y taburetes.',
    items: [...svgFirst('sofa'), ...svgFirst('chair')],
  },
  {
    id: 'bar',
    label: 'Barra',
    hint: 'Barras, botelleros y cafetera.',
    items: svgFirst('bar'),
  },
  {
    id: 'plants',
    label: 'Plantas',
    hint: 'Macetas, árboles, jardineras y setos.',
    items: svgFirst('plant'),
  },
  {
    id: 'decor',
    label: 'Decoración',
    hint: 'Fuente, piano, chimenea, alfombras, escenario y más. Usa «Al fondo» para dejar las alfombras debajo.',
    items: svgFirst('decor'),
  },
  {
    id: 'structure',
    label: 'Estructura',
    hint: 'Paredes, columnas, puertas, ventanas y zonas como cocina o aseos.',
    items: [
      ...svgFirst('wall'),
      ...svgFirst('door'),
      ...svgFirst('window'),
      ...svgFirst('zone'),
    ],
  },
]

export function getElementVariantOptions(type: FloorPlanElementType): FloorPlanAssetOption[] {
  if (type === 'decor_table') {
    return FLOOR_PLAN_TABLE_VARIANTS
  }

  return FLOOR_PLAN_ELEMENT_VARIANTS[type]
}

export function getDefaultTableVariant(): string {
  return FLOOR_PLAN_TABLE_VARIANTS[0].id
}

export function resolveTableVariant(variant?: string): FloorPlanAssetOption {
  return FLOOR_PLAN_TABLE_VARIANTS.find((option) => option.id === variant)
    ?? FLOOR_PLAN_TABLE_VARIANTS[0]
}

export function resolveTableImage(variant?: string): string {
  return resolveTableVariant(variant).src
}

export function getDefaultElementVariant(type: FloorPlanElementType): string {
  if (type === 'decor_table') {
    return getDefaultTableVariant()
  }

  return FLOOR_PLAN_ELEMENT_VARIANTS[type][0].id
}

export function resolveElementVariant(
  type: FloorPlanElementType,
  variant?: string,
): FloorPlanElementVariantOption {
  const options = FLOOR_PLAN_ELEMENT_VARIANTS[type]
  return options.find((option) => option.id === variant) ?? options[0]
}

export function resolveElementImage(type: FloorPlanElementType, variant?: string): string {
  if (type === 'decor_table') {
    return resolveTableImage(variant)
  }

  return resolveElementVariant(type, variant).src
}

const DEFAULT_ASSET_ASPECT = 676 / 369

const SVG_ASPECTS: Record<string, number> = Object.fromEntries(
  ALL_SVG_ASSETS.map((item) => [item.id, item.aspect]),
)

const ASSET_ASPECT_BY_VARIANT: Record<string, number> = {
  ...SVG_ASPECTS,
  mesas2sillas: 677 / 369,
  mesa2sillas_blancas: 676 / 369,
  mesa2sillas_negras: 676 / 369,
  mesa_larga_madera: 676 / 369,
  mesa_larga_blanca: 676 / 369,
  mesa_larga_negra: 676 / 369,
  mesaconsillas_gris: 387 / 239,
  mesaconsillas_amarillas: 636 / 392,
  mesaconsillas_rojas: 636 / 392,
  columna_cemento: 676 / 369,
  columna_roja: 676 / 369,
  ventana: 677 / 369,
  grifobar: 676 / 369,
  puerta: 677 / 369,
  barra: 676 / 369,
  silla_roja: 676 / 369,
  silla_madera: 676 / 369,
}

export function resolveTableAspectRatio(variant?: string): number {
  const id = resolveTableVariant(variant).id
  return ASSET_ASPECT_BY_VARIANT[id] ?? DEFAULT_ASSET_ASPECT
}

export function resolveElementAspectRatio(
  type: FloorPlanElementType,
  variant?: string,
): number {
  if (type === 'decor_table') {
    return resolveTableAspectRatio(variant)
  }

  const id = resolveElementVariant(type, variant).id
  return ASSET_ASPECT_BY_VARIANT[id] ?? DEFAULT_ASSET_ASPECT
}

export function computeDisplayHeightPercent(
  widthPercent: number,
  canvasWidth: number,
  canvasHeight: number,
  assetAspect: number,
): number {
  const canvasAspect = canvasWidth / canvasHeight
  return (widthPercent * canvasAspect) / assetAspect
}

export function computeStoredHeightFromWidth(
  widthPercent: number,
  canvasWidth: number,
  canvasHeight: number,
  assetAspect: number,
): number {
  return computeDisplayHeightPercent(widthPercent, canvasWidth, canvasHeight, assetAspect)
}
