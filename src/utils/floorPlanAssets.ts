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

export interface FloorPlanAssetOption {
  id: string
  label: string
  src: string
  defaultWidth?: number
  defaultHeight?: number
}

export interface FloorPlanElementVariantOption extends FloorPlanAssetOption {}

export const FLOOR_PLAN_TABLE_VARIANTS: FloorPlanAssetOption[] = [
  { id: 'mesas2sillas', label: '2 sillas', src: mesas2sillas },
  { id: 'mesa2sillas_blancas', label: '2 sillas blancas', src: mesa2sillasBlancas },
  { id: 'mesa2sillas_negras', label: '2 sillas negras', src: mesa2sillasNegras },
  {
    id: 'mesa_larga_madera',
    label: 'Larga madera',
    src: mesaLargaMadera,
    defaultWidth: 22,
    defaultHeight: 10,
  },
  {
    id: 'mesa_larga_blanca',
    label: 'Larga blanca',
    src: mesaLargaBlanca,
    defaultWidth: 22,
    defaultHeight: 10,
  },
  {
    id: 'mesa_larga_negra',
    label: 'Larga negra',
    src: mesaLargaNegra,
    defaultWidth: 22,
    defaultHeight: 10,
  },
  {
    id: 'mesaconsillas_gris',
    label: 'Sofá gris',
    src: mesaConsillasGris,
    defaultWidth: 18,
    defaultHeight: 14,
  },
  {
    id: 'mesaconsillas_amarillas',
    label: 'Sofá amarillo',
    src: mesaConsillasAmarillas,
    defaultWidth: 18,
    defaultHeight: 14,
  },
  {
    id: 'mesaconsillas_rojas',
    label: 'Sofá rojo',
    src: mesaConsillasRojas,
    defaultWidth: 18,
    defaultHeight: 14,
  },
]

export const FLOOR_PLAN_ELEMENT_VARIANTS: Record<
  FloorPlanElementType,
  FloorPlanElementVariantOption[]
> = {
  wall: [
    { id: 'columna_cemento', label: 'Cemento', src: columnaCemento },
    { id: 'columna_roja', label: 'Roja', src: columnaRoja },
  ],
  window: [
    { id: 'ventana', label: 'Ventana', src: ventana },
    { id: 'grifobar', label: 'Grifo bar', src: grifobar },
  ],
  door: [{ id: 'puerta', label: 'Puerta', src: puerta }],
  bar: [{ id: 'barra', label: 'Barra', src: barra }],
  chair: [
    { id: 'silla_roja', label: 'Roja', src: sillaRoja },
    { id: 'silla_madera', label: 'Madera', src: sillaMadera },
  ],
  decor_table: [],
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

const ELEMENT_PALETTE_TYPES: Exclude<FloorPlanElementType, 'decor_table'>[] = [
  'wall',
  'window',
  'door',
  'bar',
  'chair',
]

function tableVariantToPaletteItem(option: FloorPlanAssetOption): FloorPlanPaletteItem {
  return {
    id: `decor_table-${option.id}`,
    type: 'decor_table',
    variantId: option.id,
    label: option.label,
    src: option.src,
    defaultWidth: option.defaultWidth,
    defaultHeight: option.defaultHeight,
  }
}

export const FLOOR_PLAN_MESA_PALETTE: FloorPlanPaletteItem[] =
  FLOOR_PLAN_TABLE_VARIANTS.map(tableVariantToPaletteItem)

export const FLOOR_PLAN_CHAIR_PALETTE: FloorPlanPaletteItem[] =
  FLOOR_PLAN_ELEMENT_VARIANTS.chair.map((option) => ({
    id: `chair-${option.id}`,
    type: 'chair',
    variantId: option.id,
    label: option.label,
    src: option.src,
  }))

export const FLOOR_PLAN_PALETTE: FloorPlanPaletteItem[] = [
  ...ELEMENT_PALETTE_TYPES.flatMap((type) =>
    FLOOR_PLAN_ELEMENT_VARIANTS[type].map((option) => ({
      id: `${type}-${option.id}`,
      type,
      variantId: option.id,
      label: option.label,
      src: option.src,
    })),
  ),
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

const ASSET_ASPECT_BY_VARIANT: Record<string, number> = {
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
