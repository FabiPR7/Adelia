import type { CompanySchedule } from './index'
import { generateUuid } from '../utils/helpers'

export interface ServiceTurn {
  name: string
  start: string
  end: string
}

export interface RestaurantTable {
  id: string
  companyId: string
  name: string
  capacity: number
  sortOrder: number
}

export interface CompanySettingsPayload {
  name: string
  contactEmail: string
  phone: string
  website: string
  location: string
  logoUrl: string
  timeSlotMinutes: number
  schedule: CompanySchedule
  turns: ServiceTurn[]
  floorPlan: FloorPlan
}

export interface TableInput {
  id?: string
  name: string
  capacity: number
}

export interface FloorPlanTablePosition {
  tableKey: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  variant?: string
}

export type FloorPlanElementType = 'wall' | 'window' | 'door' | 'bar' | 'chair' | 'decor_table'

export const FLOOR_PLAN_ELEMENT_TYPES: FloorPlanElementType[] = [
  'wall',
  'window',
  'door',
  'bar',
  'decor_table',
  'chair',
]

export interface FloorPlanElement {
  id: string
  type: FloorPlanElementType
  variant?: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export type FloorStyleId =
  | 'wine'
  | 'wood'
  | 'checker'
  | 'ceramic'
  | 'carpet'
  | 'marble'
  | 'slate'

export const FLOOR_STYLE_IDS: FloorStyleId[] = [
  'wine',
  'wood',
  'checker',
  'ceramic',
  'carpet',
  'marble',
  'slate',
]

export interface FloorPlan {
  enabled: boolean
  backgroundColor: string
  backgroundImageUrl: string
  floorStyle: FloorStyleId
  canvasWidth: number
  canvasHeight: number
  tablePositions: FloorPlanTablePosition[]
  elements: FloorPlanElement[]
}

export const FLOOR_STYLE_OPTIONS: { id: FloorStyleId; label: string }[] = [
  { id: 'wine', label: 'Mosaico bar' },
  { id: 'wood', label: 'Madera' },
  { id: 'checker', label: 'Cuadros' },
  { id: 'ceramic', label: 'Cerámica' },
  { id: 'carpet', label: 'Alfombra negra' },
  { id: 'marble', label: 'Mármol' },
  { id: 'slate', label: 'Pizarra' },
]

export const FLOOR_PLAN_ELEMENT_LABELS: Record<FloorPlanElementType, string> = {
  wall: 'Pared',
  window: 'Ventana',
  door: 'Puerta',
  bar: 'Barra',
  decor_table: 'Mesa visual',
  chair: 'Silla visual',
}

const ELEMENT_DEFAULTS: Record<FloorPlanElementType, { width: number; height: number }> = {
  wall: { width: 18, height: 8 },
  window: { width: 16, height: 6 },
  door: { width: 12, height: 8 },
  bar: { width: 28, height: 12 },
  decor_table: { width: 14, height: 12 },
  chair: { width: 6, height: 6 },
}

const DEFAULT_TABLE_SIZE = { width: 14, height: 12 }

export function createFloorPlanElement(type: FloorPlanElementType): FloorPlanElement {
  const size = ELEMENT_DEFAULTS[type]

  return {
    id: generateUuid(),
    type,
    variant: undefined,
    x: 36,
    y: 36,
    width: size.width,
    height: size.height,
  }
}

export function defaultFloorPlan(): FloorPlan {
  return {
    enabled: false,
    backgroundColor: '#6b2424',
    backgroundImageUrl: '',
    floorStyle: 'wine',
    canvasWidth: 640,
    canvasHeight: 480,
    tablePositions: [],
    elements: [],
  }
}

export function getTableMapKey(table: TableInput, index: number): string {
  return table.id ?? `draft-${index}`
}

export function parseFloorPlan(value: unknown): FloorPlan {
  if (!value || typeof value !== 'object') {
    return defaultFloorPlan()
  }

  const data = value as Partial<FloorPlan>
  const tablePositions = Array.isArray(data.tablePositions)
    ? data.tablePositions
        .filter(
          (item): item is FloorPlanTablePosition =>
            typeof item === 'object'
            && item !== null
            && typeof (item as FloorPlanTablePosition).tableKey === 'string'
            && typeof (item as FloorPlanTablePosition).x === 'number'
            && typeof (item as FloorPlanTablePosition).y === 'number',
        )
        .map((item) => ({
          tableKey: item.tableKey,
          x: Math.min(96, Math.max(2, item.x)),
          y: Math.min(96, Math.max(2, item.y)),
          width: Math.min(40, Math.max(4, item.width ?? DEFAULT_TABLE_SIZE.width)),
          height: Math.min(40, Math.max(4, item.height ?? DEFAULT_TABLE_SIZE.height)),
          rotation: item.rotation ?? 0,
          variant: typeof item.variant === 'string' ? item.variant : undefined,
        }))
    : []

  const elements = Array.isArray(data.elements)
    ? data.elements
        .filter(
          (item): item is FloorPlanElement =>
            typeof item === 'object'
            && item !== null
            && typeof (item as FloorPlanElement).id === 'string'
            && typeof (item as FloorPlanElement).type === 'string'
            && FLOOR_PLAN_ELEMENT_TYPES.includes((item as FloorPlanElement).type)
            && typeof (item as FloorPlanElement).x === 'number'
            && typeof (item as FloorPlanElement).y === 'number'
            && typeof (item as FloorPlanElement).width === 'number'
            && typeof (item as FloorPlanElement).height === 'number',
        )
        .map((item) => ({
          id: item.id,
          type: item.type,
          variant: typeof item.variant === 'string' ? item.variant : undefined,
          x: Math.min(98, Math.max(0, item.x)),
          y: Math.min(98, Math.max(0, item.y)),
          width: Math.min(100, Math.max(1, item.width)),
          height: Math.min(100, Math.max(1, item.height)),
          rotation: item.rotation,
        }))
    : []

  const canvasWidth =
    typeof data.canvasWidth === 'number'
      ? Math.min(1200, Math.max(320, Math.round(data.canvasWidth)))
      : 640
  const canvasHeight =
    typeof data.canvasHeight === 'number'
      ? Math.min(900, Math.max(240, Math.round(data.canvasHeight)))
      : 480

  const floorStyle: FloorStyleId =
    typeof data.floorStyle === 'string' && FLOOR_STYLE_IDS.includes(data.floorStyle as FloorStyleId)
      ? (data.floorStyle as FloorStyleId)
      : 'wine'

  return {
    enabled: data.enabled === true,
    backgroundColor:
      typeof data.backgroundColor === 'string' ? data.backgroundColor : '#6b2424',
    backgroundImageUrl:
      typeof data.backgroundImageUrl === 'string' ? data.backgroundImageUrl : '',
    floorStyle,
    canvasWidth,
    canvasHeight,
    tablePositions,
    elements,
  }
}

export function syncFloorPlanWithTables(floorPlan: FloorPlan, tables: TableInput[]): FloorPlan {
  const keys = tables.map((table, index) => getTableMapKey(table, index))
  const previous = new Map(floorPlan.tablePositions.map((item) => [item.tableKey, item]))
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(tables.length, 1))))

  const tablePositions = keys.map((tableKey, index) => {
    const existing = previous.get(tableKey)

    if (existing) {
      return {
        ...existing,
        width: existing.width ?? DEFAULT_TABLE_SIZE.width,
        height: existing.height ?? DEFAULT_TABLE_SIZE.height,
        rotation: existing.rotation ?? 0,
        variant: existing.variant,
      }
    }

    const row = Math.floor(index / cols)
    const col = index % cols

    return {
      tableKey,
      x: 12 + col * (76 / cols),
      y: 12 + row * (76 / cols),
      width: DEFAULT_TABLE_SIZE.width,
      height: DEFAULT_TABLE_SIZE.height,
      rotation: 0,
    }
  })

  return {
    ...floorPlan,
    tablePositions,
  }
}

/** Firestore no acepta `undefined`; omitimos campos opcionales vacíos. */
export function serializeFloorPlanForFirestore(floorPlan: FloorPlan) {
  return {
    enabled: floorPlan.enabled,
    backgroundColor: floorPlan.backgroundColor,
    backgroundImageUrl: floorPlan.backgroundImageUrl,
    floorStyle: floorPlan.floorStyle,
    canvasWidth: floorPlan.canvasWidth,
    canvasHeight: floorPlan.canvasHeight,
    tablePositions: floorPlan.tablePositions.map((item) => ({
      tableKey: item.tableKey,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      ...(item.rotation !== undefined ? { rotation: item.rotation } : {}),
      ...(item.variant ? { variant: item.variant } : {}),
    })),
    elements: floorPlan.elements.map((item) => ({
      id: item.id,
      type: item.type,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      ...(item.variant ? { variant: item.variant } : {}),
      ...(item.rotation !== undefined ? { rotation: item.rotation } : {}),
    })),
  }
}

export type SettingsSection = 'contact' | 'reservation-settings' | 'schedule' | 'tables'

export type CompanyTab = 'reservations' | 'help' | SettingsSection

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; hint: string }[] = [
  { id: 'contact', label: 'Contacto', hint: 'Datos y logo' },
  { id: 'reservation-settings', label: 'Reservas', hint: 'Duración y turnos' },
  { id: 'schedule', label: 'Horario', hint: 'Días y franjas' },
  { id: 'tables', label: 'Mesas', hint: 'Capacidad y mapa' },
]

export function isSettingsTab(tab: CompanyTab): tab is SettingsSection {
  return tab !== 'reservations' && tab !== 'help'
}

export const SCHEDULE_DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export const SCHEDULE_DAY_LABELS: Record<(typeof SCHEDULE_DAY_KEYS)[number], string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
}

export function defaultTurns(): ServiceTurn[] {
  return [
    { name: 'Comida', start: '13:00', end: '16:00' },
    { name: 'Cena', start: '20:00', end: '23:00' },
  ]
}
