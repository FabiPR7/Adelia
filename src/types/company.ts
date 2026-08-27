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
  floorPlanId: string
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
  mainPhotoIndex: number
  videos: string[]
  characteristics: string[]
  venueTypes: string[]
  amenities: string[]
  priceRange: import('../data/companyProfileFacilities').CompanyPriceRange
  timeSlotMinutes: number
  reservationMode: import('../data/companyReservationMode').CompanyReservationMode
  /** A partir de este número de comensales se pedirá fianza (null = desactivado). */
  depositMinPax: number | null
  /** Importe de fianza por comensal en céntimos (null = desactivado). */
  depositPerGuestCents: number | null
  depositEnabled: boolean
  /** Horas antes de la reserva para cancelar sin que se cobre la fianza. */
  depositCancellationHours: number | null
  schedule: CompanySchedule
  turns: ServiceTurn[]
  floorPlan: FloorPlan
  floorPlans: FloorPlan[]
}

export interface TableInput {
  id?: string
  name: string
  capacity: number
  floorPlanId?: string
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
  id: string
  name: string
  enabled: boolean
  backgroundColor: string
  backgroundImageUrl: string
  floorStyle: FloorStyleId
  canvasWidth: number
  canvasHeight: number
  tablePositions: FloorPlanTablePosition[]
  elements: FloorPlanElement[]
}

export const MAX_FLOOR_PLANS = 20
export const MAX_FLOOR_PLAN_NAME_LENGTH = 40

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

export function sanitizeFloorPlanName(value: string, fallback = 'Salón'): string {
  const name = value.trim().replace(/\s+/g, ' ').slice(0, MAX_FLOOR_PLAN_NAME_LENGTH)
  return name || fallback
}

export function defaultFloorPlan(name = 'Salón'): FloorPlan {
  return {
    id: generateUuid(),
    name: sanitizeFloorPlanName(name),
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

export function createNamedFloorPlan(name: string, enabled = true): FloorPlan {
  return {
    ...defaultFloorPlan(name),
    enabled,
  }
}

export function primaryFloorPlan(plans: FloorPlan[]): FloorPlan {
  return plans.find((plan) => plan.enabled) ?? plans[0] ?? defaultFloorPlan()
}

export function areFloorPlansEnabled(plans: FloorPlan[]): boolean {
  return plans.some((plan) => plan.enabled)
}

export function enabledFloorPlans(plans: FloorPlan[]): FloorPlan[] {
  return plans.filter((plan) => plan.enabled)
}

export function getTableMapKey(table: TableInput, index: number): string {
  return table.id ?? `draft-${index}`
}

export function parseFloorPlan(value: unknown): FloorPlan {
  if (!value || typeof value !== 'object') {
    return defaultFloorPlan()
  }

  const data = value as Partial<FloorPlan> & { id?: unknown; name?: unknown }
  const parsed = parseFloorPlanFields(data)

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : 'default',
    name: sanitizeFloorPlanName(typeof data.name === 'string' ? data.name : 'Salón'),
    ...parsed,
  }
}

function parseFloorPlanFields(data: Partial<FloorPlan>): Omit<FloorPlan, 'id' | 'name'> {
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

export function parseFloorPlans(value: unknown, legacy?: unknown): FloorPlan[] {
  if (Array.isArray(value) && value.length > 0) {
    const plans = value
      .map((item, index) => {
        const parsed = parseFloorPlan(item)
        if (typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id !== 'string') {
          return { ...parsed, id: `map-${index + 1}` }
        }
        return parsed
      })
      .slice(0, MAX_FLOOR_PLANS)

    return ensureUniqueFloorPlanIds(plans)
  }

  const legacyPlan = parseFloorPlan(legacy)
  return [{
    ...legacyPlan,
    id: legacyPlan.id || 'default',
    name: legacyPlan.name || 'Salón',
  }]
}

function ensureUniqueFloorPlanIds(plans: FloorPlan[]): FloorPlan[] {
  const used = new Set<string>()

  return plans.map((plan, index) => {
    let id = plan.id.trim() || `map-${index + 1}`
    let suffix = 2
    while (used.has(id)) {
      id = `${plan.id.trim() || 'map'}-${suffix}`
      suffix += 1
    }
    used.add(id)
    return { ...plan, id }
  })
}

export function tableBelongsToFloorPlan(
  table: TableInput,
  plan: FloorPlan,
  plans: FloorPlan[],
): boolean {
  if (table.floorPlanId) {
    return table.floorPlanId === plan.id
  }

  return plans[0]?.id === plan.id
}

export function tablesForFloorPlan(
  tables: TableInput[],
  plan: FloorPlan,
  plans: FloorPlan[],
): TableInput[] {
  return tables.filter((table) => tableBelongsToFloorPlan(table, plan, plans))
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

export function syncAllFloorPlans(plans: FloorPlan[], tables: TableInput[]): FloorPlan[] {
  const list = plans.length > 0 ? plans : [defaultFloorPlan()]
  return list.map((plan) => syncFloorPlanWithTables(plan, tablesForFloorPlan(tables, plan, list)))
}

export function withFloorPlans(plans: FloorPlan[]): { floorPlans: FloorPlan[]; floorPlan: FloorPlan } {
  const floorPlans = plans.length > 0 ? plans : [defaultFloorPlan()]
  return {
    floorPlans,
    floorPlan: primaryFloorPlan(floorPlans),
  }
}

/** Firestore no acepta `undefined`; omitimos campos opcionales vacíos. */
export function serializeFloorPlanForFirestore(floorPlan: FloorPlan) {
  return {
    id: floorPlan.id,
    name: sanitizeFloorPlanName(floorPlan.name),
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

export function serializeFloorPlansForFirestore(plans: FloorPlan[]) {
  return plans.slice(0, MAX_FLOOR_PLANS).map(serializeFloorPlanForFirestore)
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
  | 'clients-reviews'

export type PromotionType = 'reservation_ladder' | 'time_limited' | 'attendance'

export type PromotionPinRotation = 'daily' | 'weekly' | 'monthly' | 'manual'

export interface PromotionPinSettings {
  code: string
  rotation: PromotionPinRotation
  nextRotationAt: Date | null
  lastRotatedAt: Date | null
  updatedAt: Date
}

export type PromotionOfferKind =
  | 'bundle'
  | 'discount'
  | 'fixed_price'
  | 'second_unit'
  | 'free_item'
  | 'custom'

export interface PromotionProductRef {
  nodeId: string
  name: string
  photoUrl: string
}

export interface PromotionOfferConfig {
  kind: PromotionOfferKind
  bundleGet: number | null
  bundlePay: number | null
  discountPercent: number | null
  fixedPriceCents: number | null
  customLabel: string
}

export interface CompanyPromotion {
  id: string
  companyId: string
  type: PromotionType
  title: string
  description: string
  photoUrl: string
  offer: PromotionOfferConfig
  productRefs: PromotionProductRef[]
  active: boolean
  requiresReservation: boolean
  requiredReservations: number | null
  minimumSpendEnabled: boolean
  minimumSpendCents: number | null
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
  offer: PromotionOfferConfig
  productIds: string[]
  active: boolean
  requiresReservation: boolean
  requiredReservations: number | null
  minimumSpendEnabled: boolean
  minimumSpendCents: number | null
  activeFromTime: string
  activeToTime: string
  maxRedemptions: number | null
  arrivalWindowMinutes: number | null
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  reservation_ladder: 'Oferta',
  time_limited: 'Tiempo limitado',
  attendance: 'Asistencia puntual',
}

export const PROMOTION_TYPE_HINTS: Record<PromotionType, string> = {
  reservation_ladder: 'Ofertas escalables: el cliente canjea primero la de menos reservas o consumos.',
  time_limited: 'Activa solo en un tramo horario concreto.',
  attendance: 'El cliente debe presentarse en un plazo; si no viene, se libera el cupo.',
}

export const PROMOTION_OFFER_KIND_LABELS: Record<PromotionOfferKind, string> = {
  bundle: 'X por X (ej. 2×1)',
  discount: 'Descuento',
  fixed_price: 'Precio fijo',
  second_unit: '2ª unidad con descuento',
  free_item: 'Producto de regalo',
  custom: 'Otro / personalizado',
}

export const PROMOTION_OFFER_KIND_HINTS: Record<PromotionOfferKind, string> = {
  bundle: 'Ej.: llevas 2 y pagas 1 → se muestra como 2×1.',
  discount: 'Porcentaje de descuento sobre los productos seleccionados.',
  fixed_price: 'Precio especial total para los productos de la promo.',
  second_unit: 'Descuento en la segunda unidad (ej. 2ª al 50%).',
  free_item: 'Regalo al pedir los productos seleccionados.',
  custom: 'Título, descripción y foto libres como hasta ahora.',
}

export function defaultPromotionOffer(kind: PromotionOfferKind = 'custom'): PromotionOfferConfig {
  return {
    kind,
    bundleGet: kind === 'bundle' ? 2 : null,
    bundlePay: kind === 'bundle' ? 1 : null,
    discountPercent: kind === 'discount' || kind === 'second_unit' ? 20 : null,
    fixedPriceCents: kind === 'fixed_price' ? 1000 : null,
    customLabel: '',
  }
}

export function defaultPromotionInput(type: PromotionType): PromotionInput {
  return {
    type,
    title: '',
    description: '',
    photoUrl: '',
    offer: defaultPromotionOffer('custom'),
    productIds: [],
    active: false,
    requiresReservation: false,
    requiredReservations: null,
    minimumSpendEnabled: false,
    minimumSpendCents: null,
    activeFromTime: '12:00',
    activeToTime: '16:00',
    maxRedemptions: type === 'attendance' ? 10 : null,
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

  const offerError = validatePromotionOfferConfig(input.offer)
  if (offerError) {
    return offerError
  }

  if (input.type === 'reservation_ladder') {
    if (input.requiresReservation) {
      if (
        input.requiredReservations === null
        || !Number.isFinite(input.requiredReservations)
        || input.requiredReservations < 1
      ) {
        return 'Indica cuántas reservas o consumos se requieren (mínimo 1).'
      }

      if (input.active) {
        const conflict = existing.find(
          (promotion) => promotion.id !== editingId
            && promotion.active
            && promotion.type === 'reservation_ladder'
            && promotion.requiresReservation
            && promotion.requiredReservations === input.requiredReservations,
        )

        if (conflict) {
          return `Ya hay una oferta activa que requiere ${
            input.requiredReservations === 1
              ? '1 reserva o consumo'
              : `${input.requiredReservations} reservas o consumos`
          }.`
        }
      }
    } else if (
      input.requiredReservations !== null
      && Number.isFinite(input.requiredReservations)
      && input.requiredReservations < 0
    ) {
      return 'Las reservas o consumos requeridos no pueden ser negativos.'
    }
  }

  if (input.type === 'time_limited' || input.type === 'attendance') {
    if (!input.activeFromTime || !input.activeToTime) {
      return 'Indica la franja horaria activa.'
    }
  }

  if (input.type === 'attendance') {
    if (!input.maxRedemptions || input.maxRedemptions < 1) {
      return 'Indica el máximo de canjes permitidos (mínimo 1).'
    }

    if (!input.arrivalWindowMinutes || input.arrivalWindowMinutes < 1) {
      return 'Indica el tiempo máximo de llegada en minutos.'
    }
  }

  if (input.minimumSpendEnabled) {
    if (
      input.minimumSpendCents === null
      || !Number.isFinite(input.minimumSpendCents)
      || input.minimumSpendCents < 0
    ) {
      return 'Indica un gasto mínimo válido (0 € o más).'
    }
  }

  return null
}

export function validatePromotionOfferConfig(offer: PromotionOfferConfig): string | null {
  switch (offer.kind) {
    case 'bundle': {
      if (!offer.bundleGet || offer.bundleGet < 2) {
        return 'Indica cuántas unidades lleva el cliente (mínimo 2).'
      }
      if (!offer.bundlePay || offer.bundlePay < 1 || offer.bundlePay >= offer.bundleGet) {
        return 'Indica cuántas unidades paga (debe ser menor que las que lleva).'
      }
      return null
    }
    case 'discount':
    case 'second_unit': {
      if (
        offer.discountPercent === null
        || !Number.isFinite(offer.discountPercent)
        || offer.discountPercent < 1
        || offer.discountPercent > 100
      ) {
        return 'Indica un descuento entre 1 y 100%.'
      }
      return null
    }
    case 'fixed_price': {
      if (!offer.fixedPriceCents || offer.fixedPriceCents < 1) {
        return 'Indica un precio fijo válido.'
      }
      return null
    }
    case 'free_item':
    case 'custom':
      return null
    default:
      return null
  }
}

export type MenuLayout = 'list' | 'grid'

export type MenuNodeType = 'family' | 'product'

export interface MenuCategoryAvailability {
  enabled: boolean
  start: string
  end: string
}

export interface MenuTemplateConfig {
  templateId: string
  backgroundColor: string
  backgroundImageUrl: string
  backgroundImageOpacity: number
  fontFamily: string
  titleColor: string
  textColor: string
  accentColor: string
  familyColor: string
  subfamilyColor: string
  priceColor: string
  layout: MenuLayout
  showPhotos: boolean
  showAllergens: boolean
  showDescriptions: boolean
}

export interface MenuBoard {
  id: string
  companyId: string
  name: string
  active: boolean
  sortOrder: number
  template: MenuTemplateConfig
  pdfUrl: string
  pdfFileName: string
  pdfPages: number
  createdAt: Date
  updatedAt: Date
}

export interface MenuBoardInput {
  name: string
  active: boolean
  sortOrder: number
  template: MenuTemplateConfig
  pdfUrl?: string
  pdfFileName?: string
  pdfPages?: number
}

export function hasMenuPdf(board: Pick<MenuBoard, 'pdfUrl'> | null | undefined): boolean {
  return Boolean(board?.pdfUrl?.trim())
}

export interface MenuNode {
  id: string
  companyId: string
  boardId: string
  nodeType: MenuNodeType
  parentId: string | null
  sortOrder: number
  name: string
  description: string
  allergens: string[]
  priceCents: number | null
  priceCurrency: string
  photoUrl: string
  active: boolean
  availability: MenuCategoryAvailability
  createdAt: Date
  updatedAt: Date
}

export interface MenuNodeInput {
  boardId: string
  nodeType: MenuNodeType
  parentId: string | null
  sortOrder: number
  name: string
  description: string
  allergens: string[]
  priceCents: number | null
  priceCurrency: string
  photoUrl: string
  active: boolean
  availability: MenuCategoryAvailability
}

export function defaultMenuNodeInput(
  boardId: string,
  nodeType: MenuNodeType,
  parentId: string | null,
  sortOrder: number,
): MenuNodeInput {
  return {
    boardId,
    nodeType,
    parentId,
    sortOrder,
    name: '',
    description: '',
    allergens: [],
    priceCents: null,
    priceCurrency: 'EUR',
    photoUrl: '',
    active: true,
    availability: { enabled: false, start: '13:00', end: '16:00' },
  }
}

export type SettingsSection =
  | 'contact'
  | 'profile'
  | 'reservation-settings'
  | 'tables'
  | 'menu'
  | 'plan'

export type CompanySettingsSection = Exclude<SettingsSection, 'menu' | 'plan'>

export type ReportsSection = 'reports-reservations' | 'reports-clients' | 'reports-products' | 'reports-reviews'

export type CompiteSection = 'compite-notifications' | 'compite-missions' | 'compite-ranking'

export type CompanyTab = 'reservations' | ClientsSection | ReportsSection | CompiteSection | 'help' | SettingsSection

export const CLIENTS_SECTIONS: { id: ClientsSection; label: string; hint: string }[] = [
  { id: 'clients-reservations', label: 'Reservas', hint: 'Historial por cliente' },
  { id: 'clients-promotions', label: 'Promociones', hint: 'Premios y cupos limitados' },
  { id: 'clients-reviews', label: 'Reseñas', hint: 'Opiniones y puntuación' },
  { id: 'clients-email-received', label: 'Reserva recibida', hint: 'Correo al solicitar' },
  { id: 'clients-email-confirmation', label: 'Confirmación', hint: 'Correo al confirmar' },
]

export const REPORTS_SECTIONS: { id: ReportsSection; label: string; hint: string }[] = [
  { id: 'reports-reservations', label: 'Reservas', hint: 'KPIs, gráficos y listado' },
  { id: 'reports-clients', label: 'Clientes', hint: 'Informes de clientes' },
  { id: 'reports-products', label: 'Productos', hint: 'Consumo verificado en promos' },
  { id: 'reports-reviews', label: 'Reseñas', hint: 'Puntuación, estrellas y Adelinas' },
]

export const COMPITE_SECTIONS: { id: CompiteSection; label: string; hint: string }[] = [
  { id: 'compite-notifications', label: 'Notificaciones', hint: 'Misiones, niveles y puntuación' },
  { id: 'compite-missions', label: 'Misiones e insignias', hint: 'Retos, logros y tu nivel' },
  { id: 'compite-ranking', label: 'Ranking', hint: 'Local y mundial' },
]

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; hint: string }[] = [
  { id: 'contact', label: 'Contacto', hint: 'Datos y logo' },
  { id: 'profile', label: 'Perfil', hint: 'Ubicación, servicios y estilo' },
  { id: 'reservation-settings', label: 'Reservas y horario', hint: 'Modo, duración y días' },
  { id: 'tables', label: 'Mesas', hint: 'Capacidad y mapa' },
  { id: 'menu', label: 'Carta', hint: 'Productos, diseño y PDF' },
  { id: 'plan', label: 'Plan', hint: 'Suscripción y baja' },
]

export function isClientsTab(tab: CompanyTab): tab is ClientsSection {
  return tab === 'clients-reservations'
    || tab === 'clients-promotions'
    || tab === 'clients-reviews'
    || tab === 'clients-email-received'
    || tab === 'clients-email-confirmation'
}

export function isReportsTab(tab: CompanyTab): tab is ReportsSection {
  return tab === 'reports-reservations'
    || tab === 'reports-clients'
    || tab === 'reports-products'
    || tab === 'reports-reviews'
}

export function isCompiteTab(tab: CompanyTab): tab is CompiteSection {
  return tab === 'compite-notifications'
    || tab === 'compite-missions'
    || tab === 'compite-ranking'
}

export function isSettingsTab(tab: CompanyTab): tab is SettingsSection {
  return tab !== 'reservations'
    && !isClientsTab(tab)
    && !isReportsTab(tab)
    && !isCompiteTab(tab)
    && tab !== 'help'
}

export function isSettingsEditorTab(tab: CompanyTab): tab is CompanySettingsSection {
  return tab === 'contact'
    || tab === 'profile'
    || tab === 'reservation-settings'
    || tab === 'tables'
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

export type QrLogoMode = 'adelia' | 'restaurant' | 'none'

export type QrBrandingKind = 'booking' | 'menu' | 'promotion'

export interface QrBrandingConfig {
  logoMode: QrLogoMode
  title: string
  subtitle: string
  showTitle: boolean
  showSubtitle: boolean
  darkColor: string
}

export interface CompanyQrBranding {
  booking: QrBrandingConfig
  menu: QrBrandingConfig
  promotion: QrBrandingConfig
}
