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
  municipality: string
  country: string
  postalCode: string
  latitude: number | null
  longitude: number | null
  description: string
  logoUrl: string
  photos: string[]
  videos: string[]
  characteristics: string[]
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

export type EmailTemplateKind = 'received' | 'confirmation'
export type EmailHeaderStyle = 'gradient' | 'solid' | 'light'
export type EmailLayoutStyle = 'classic' | 'compact'

export interface ReservationEmailTemplate {
  subject: string
  headerEyebrow: string
  headline: string
  introMessage: string
  preDetailsMessage: string
  detailsSectionTitle: string
  closingMessage: string
  accentColor: string
  accentColorEnd: string
  headerStyle: EmailHeaderStyle
  layoutStyle: EmailLayoutStyle
  showRestaurantLogo: boolean
  showRestaurantName: boolean
  showDate: boolean
  showTime: boolean
  showPax: boolean
  showTable: boolean
  showPhone: boolean
  showLocation: boolean
  showNotes: boolean
  showWebsite: boolean
  showContactEmail: boolean
  showCancelButton: boolean
  cancelButtonLabel: string
  cancelHelpText: string
  showPromotion: boolean
  promotionTitle: string
  promotionMessage: string
  promotionCode: string
  showViewRestaurantButton: boolean
  viewRestaurantButtonLabel: string
}

export interface CompanyEmailTemplates {
  received: ReservationEmailTemplate
  confirmation: ReservationEmailTemplate
}

const SHARED_EMAIL_TEMPLATE_DEFAULTS: Omit<
  ReservationEmailTemplate,
  'headerEyebrow' | 'introMessage' | 'closingMessage'
> = {
  subject: '',
  headline: '',
  preDetailsMessage: '',
  detailsSectionTitle: 'Detalles de tu reserva',
  accentColor: '#6d28d9',
  accentColorEnd: '#9333ea',
  headerStyle: 'gradient',
  layoutStyle: 'classic',
  showRestaurantLogo: true,
  showRestaurantName: true,
  showDate: true,
  showTime: true,
  showPax: true,
  showTable: true,
  showPhone: true,
  showLocation: true,
  showNotes: true,
  showWebsite: false,
  showContactEmail: false,
  showCancelButton: false,
  cancelButtonLabel: 'Cancelar reserva',
  cancelHelpText: 'Si no puedes acudir, cancela tu reserva con el botón de abajo.',
  showPromotion: false,
  promotionTitle: 'Oferta especial',
  promotionMessage: 'Presenta este correo en el restaurante para disfrutar de nuestra promoción.',
  promotionCode: '',
  showViewRestaurantButton: false,
  viewRestaurantButtonLabel: 'Ver restaurante',
}

export const DEFAULT_RECEIVED_EMAIL_TEMPLATE: ReservationEmailTemplate = {
  ...SHARED_EMAIL_TEMPLATE_DEFAULTS,
  headerEyebrow: 'Solicitud de reserva',
  introMessage:
    'Hola {nombre}, hemos recibido tu solicitud de reserva. Estos son los detalles:',
  closingMessage:
    'Recibirás otro correo cuando el restaurante confirme tu asistencia el día de la reserva.',
}

export const DEFAULT_CONFIRMATION_EMAIL_TEMPLATE: ReservationEmailTemplate = {
  ...SHARED_EMAIL_TEMPLATE_DEFAULTS,
  headerEyebrow: 'Confirmación de reserva',
  introMessage: 'Hola {nombre}, tu reserva ha quedado confirmada. Estos son los detalles:',
  closingMessage: 'Te esperamos. Si necesitas modificar algo, contacta con el restaurante.',
}

export function defaultCompanyEmailTemplates(): CompanyEmailTemplates {
  return {
    received: { ...DEFAULT_RECEIVED_EMAIL_TEMPLATE },
    confirmation: { ...DEFAULT_CONFIRMATION_EMAIL_TEMPLATE },
  }
}

export type ClientsSection =
  | 'clients-reservations'
  | 'clients-email-received'
  | 'clients-email-confirmation'
  | 'clients-promotions'

export type PromotionType = 'reservation_ladder' | 'time_limited' | 'attendance'

export interface CompanyPromotion {
  id: string
  companyId: string
  type: PromotionType
  title: string
  description: string
  photoUrl: string
  active: boolean
  requiresReservation: boolean
  requiredReservations: number | null
  activeFromTime: string
  activeToTime: string
  maxRedemptions: number | null
  currentRedemptions: number
  arrivalWindowMinutes: number | null
  createdAt: Date
  updatedAt: Date
}

export interface PromotionInput {
  type: PromotionType
  title: string
  description: string
  photoUrl: string
  active: boolean
  requiresReservation: boolean
  requiredReservations: number | null
  activeFromTime: string
  activeToTime: string
  maxRedemptions: number | null
  arrivalWindowMinutes: number | null
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  reservation_ladder: 'Premio por reservas',
  time_limited: 'Tiempo limitado',
  attendance: 'Asistencia puntual',
}

export const PROMOTION_TYPE_HINTS: Record<PromotionType, string> = {
  reservation_ladder: 'Escalable: el cliente canjea primero el premio de menos reservas.',
  time_limited: 'Activa solo en un tramo horario y con cupos limitados.',
  attendance: 'El cliente debe presentarse en un plazo; si no viene, se libera el cupo.',
}

export function defaultPromotionInput(type: PromotionType): PromotionInput {
  return {
    type,
    title: '',
    description: '',
    photoUrl: '',
    active: false,
    requiresReservation: type === 'reservation_ladder',
    requiredReservations: null,
    activeFromTime: '12:00',
    activeToTime: '16:00',
    maxRedemptions: type === 'reservation_ladder' ? null : 10,
    arrivalWindowMinutes: type === 'attendance' ? 30 : null,
  }
}

export function validatePromotionInput(
  input: PromotionInput,
  existing: CompanyPromotion[],
  editingId: string | null,
): string | null {
  if (!input.title.trim()) {
    return 'El título es obligatorio.'
  }

  if (!input.description.trim()) {
    return 'La descripción es obligatoria.'
  }

  if (input.type === 'reservation_ladder') {
    if (
      input.requiredReservations === null
      || !Number.isFinite(input.requiredReservations)
      || input.requiredReservations < 1
    ) {
      return 'Indica cuántas reservas se requieren (número positivo, mínimo 1).'
    }

    if (input.active) {
      const conflict = existing.find(
        (promotion) => promotion.id !== editingId
          && promotion.active
          && promotion.type === 'reservation_ladder'
          && promotion.requiredReservations === input.requiredReservations,
      )

      if (conflict) {
        return `Ya hay una promoción activa que requiere ${input.requiredReservations} reservas.`
      }
    }
  }

  if (input.type === 'time_limited' || input.type === 'attendance') {
    if (!input.activeFromTime || !input.activeToTime) {
      return 'Indica la franja horaria activa.'
    }

    if (!input.maxRedemptions || input.maxRedemptions < 1) {
      return 'Indica el máximo de canjes permitidos (mínimo 1).'
    }
  }

  if (input.type === 'attendance') {
    if (!input.arrivalWindowMinutes || input.arrivalWindowMinutes < 1) {
      return 'Indica el tiempo máximo de llegada en minutos.'
    }
  }

  return null
}

export type SettingsSection =
  | 'contact'
  | 'profile'
  | 'reservation-settings'
  | 'tables'

export type ReportsSection = 'reports-reservations' | 'reports-clients'

export type CompanyTab = 'reservations' | ClientsSection | ReportsSection | 'help' | SettingsSection

export const CLIENTS_SECTIONS: { id: ClientsSection; label: string; hint: string }[] = [
  { id: 'clients-reservations', label: 'Reservas', hint: 'Historial por cliente' },
  { id: 'clients-promotions', label: 'Promociones', hint: 'Premios y cupos limitados' },
  { id: 'clients-email-received', label: 'Reserva recibida', hint: 'Correo al solicitar' },
  { id: 'clients-email-confirmation', label: 'Confirmación', hint: 'Correo al confirmar' },
]

export const REPORTS_SECTIONS: { id: ReportsSection; label: string; hint: string }[] = [
  { id: 'reports-reservations', label: 'Reservas', hint: 'KPIs, gráficos y listado' },
  { id: 'reports-clients', label: 'Clientes', hint: 'Informes de clientes' },
]

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; hint: string }[] = [
  { id: 'contact', label: 'Contacto', hint: 'Datos y logo' },
  { id: 'profile', label: 'Perfil', hint: 'Ficha del local' },
  { id: 'reservation-settings', label: 'Reservas y horario', hint: 'Duración, turnos y días' },
  { id: 'tables', label: 'Mesas', hint: 'Capacidad y mapa' },
]

export function isClientsTab(tab: CompanyTab): tab is ClientsSection {
  return tab === 'clients-reservations'
    || tab === 'clients-promotions'
    || tab === 'clients-email-received'
    || tab === 'clients-email-confirmation'
}

export function isReportsTab(tab: CompanyTab): tab is ReportsSection {
  return tab === 'reports-reservations' || tab === 'reports-clients'
}

export function isSettingsTab(tab: CompanyTab): tab is SettingsSection {
  return tab !== 'reservations'
    && !isClientsTab(tab)
    && !isReportsTab(tab)
    && tab !== 'help'
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
