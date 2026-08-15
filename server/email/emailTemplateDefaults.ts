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

const MAX_FIELD_LENGTH = 500
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

const SHARED_TEMPLATE_DEFAULTS: Omit<ReservationEmailTemplate, 'headerEyebrow' | 'introMessage' | 'closingMessage'> = {
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

export const DEFAULT_RECEIVED_TEMPLATE: ReservationEmailTemplate = {
  ...SHARED_TEMPLATE_DEFAULTS,
  headerEyebrow: 'Solicitud de reserva',
  introMessage:
    'Hola {nombre}, hemos recibido tu solicitud de reserva. Estos son los detalles:',
  closingMessage:
    'Recibirás otro correo cuando el restaurante confirme tu asistencia el día de la reserva.',
}

export const DEFAULT_CONFIRMATION_TEMPLATE: ReservationEmailTemplate = {
  ...SHARED_TEMPLATE_DEFAULTS,
  headerEyebrow: 'Confirmación de reserva',
  introMessage: 'Hola {nombre}, tu reserva ha quedado confirmada. Estos son los detalles:',
  closingMessage: 'Te esperamos. Si necesitas modificar algo, contacta con el restaurante.',
}

export function defaultCompanyEmailTemplates(): CompanyEmailTemplates {
  return {
    received: { ...DEFAULT_RECEIVED_TEMPLATE },
    confirmation: { ...DEFAULT_CONFIRMATION_TEMPLATE },
  }
}

function sanitizeText(value: unknown, fallback: string, maxLength = MAX_FIELD_LENGTH): string {
  if (typeof value !== 'string') {
    return fallback
  }

  return value.trim().slice(0, maxLength) || fallback
}

function sanitizeOptionalText(value: unknown, maxLength = MAX_FIELD_LENGTH): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, maxLength)
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed : fallback
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function sanitizeHeaderStyle(value: unknown, fallback: EmailHeaderStyle): EmailHeaderStyle {
  return value === 'solid' || value === 'light' || value === 'gradient' ? value : fallback
}

function sanitizeLayoutStyle(value: unknown, fallback: EmailLayoutStyle): EmailLayoutStyle {
  return value === 'compact' || value === 'classic' ? value : fallback
}

export function normalizeReservationEmailTemplate(
  value: unknown,
  defaults: ReservationEmailTemplate,
): ReservationEmailTemplate {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    subject: sanitizeOptionalText(raw.subject),
    headerEyebrow: sanitizeText(raw.headerEyebrow, defaults.headerEyebrow, 80),
    headline: sanitizeOptionalText(raw.headline, 120),
    introMessage: sanitizeText(raw.introMessage, defaults.introMessage),
    preDetailsMessage: sanitizeOptionalText(raw.preDetailsMessage),
    detailsSectionTitle: sanitizeText(raw.detailsSectionTitle, defaults.detailsSectionTitle, 80),
    closingMessage: sanitizeText(raw.closingMessage, defaults.closingMessage),
    accentColor: sanitizeColor(raw.accentColor, defaults.accentColor),
    accentColorEnd: sanitizeColor(raw.accentColorEnd, defaults.accentColorEnd),
    headerStyle: sanitizeHeaderStyle(raw.headerStyle, defaults.headerStyle),
    layoutStyle: sanitizeLayoutStyle(raw.layoutStyle, defaults.layoutStyle),
    showRestaurantLogo: sanitizeBoolean(raw.showRestaurantLogo, defaults.showRestaurantLogo),
    showRestaurantName: sanitizeBoolean(raw.showRestaurantName, defaults.showRestaurantName),
    showDate: sanitizeBoolean(raw.showDate, defaults.showDate),
    showTime: sanitizeBoolean(raw.showTime, defaults.showTime),
    showPax: sanitizeBoolean(raw.showPax, defaults.showPax),
    showTable: sanitizeBoolean(raw.showTable, defaults.showTable),
    showPhone: sanitizeBoolean(raw.showPhone, defaults.showPhone),
    showLocation: sanitizeBoolean(raw.showLocation, defaults.showLocation),
    showNotes: sanitizeBoolean(raw.showNotes, defaults.showNotes),
    showWebsite: sanitizeBoolean(raw.showWebsite, defaults.showWebsite),
    showContactEmail: sanitizeBoolean(raw.showContactEmail, defaults.showContactEmail),
    showCancelButton: sanitizeBoolean(raw.showCancelButton, defaults.showCancelButton),
    cancelButtonLabel: sanitizeText(raw.cancelButtonLabel, defaults.cancelButtonLabel, 60),
    cancelHelpText: sanitizeText(raw.cancelHelpText, defaults.cancelHelpText, 240),
    showPromotion: sanitizeBoolean(raw.showPromotion, defaults.showPromotion),
    promotionTitle: sanitizeText(raw.promotionTitle, defaults.promotionTitle, 80),
    promotionMessage: sanitizeText(raw.promotionMessage, defaults.promotionMessage),
    promotionCode: sanitizeOptionalText(raw.promotionCode, 40),
    showViewRestaurantButton: sanitizeBoolean(
      raw.showViewRestaurantButton,
      defaults.showViewRestaurantButton,
    ),
    viewRestaurantButtonLabel: sanitizeText(
      raw.viewRestaurantButtonLabel,
      defaults.viewRestaurantButtonLabel,
      60,
    ),
  }
}

export function parseCompanyEmailTemplates(value: unknown): CompanyEmailTemplates {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    received: normalizeReservationEmailTemplate(raw.received, DEFAULT_RECEIVED_TEMPLATE),
    confirmation: normalizeReservationEmailTemplate(raw.confirmation, DEFAULT_CONFIRMATION_TEMPLATE),
  }
}

export function serializeCompanyEmailTemplates(templates: CompanyEmailTemplates): CompanyEmailTemplates {
  return {
    received: normalizeReservationEmailTemplate(templates.received, DEFAULT_RECEIVED_TEMPLATE),
    confirmation: normalizeReservationEmailTemplate(
      templates.confirmation,
      DEFAULT_CONFIRMATION_TEMPLATE,
    ),
  }
}

export function applyTemplatePlaceholders(
  template: string,
  values: { nombre: string; restaurante: string; fecha?: string; hora?: string },
): string {
  return template
    .replaceAll('{nombre}', values.nombre)
    .replaceAll('{restaurante}', values.restaurante)
    .replaceAll('{fecha}', values.fecha ?? '')
    .replaceAll('{hora}', values.hora ?? '')
}

export function buildReservationCancelUrl(slug: string, cancelToken: string): string {
  const base = (process.env.APP_URL ?? 'https://adeliareservas.com').replace(/\/$/, '')
  return `${base}/reservar/${encodeURIComponent(slug)}/cancelar?token=${encodeURIComponent(cancelToken)}`
}

export function buildRestaurantProfileUrl(slug: string): string {
  const base = (process.env.APP_URL ?? 'https://adeliareservas.com').replace(/\/$/, '')
  return `${base}/reservar/${encodeURIComponent(slug)}`
}
