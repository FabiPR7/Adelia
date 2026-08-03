import {
  DEFAULT_CONFIRMATION_EMAIL_TEMPLATE,
  DEFAULT_RECEIVED_EMAIL_TEMPLATE,
  type CompanyEmailTemplates,
  type EmailHeaderStyle,
  type EmailLayoutStyle,
  type ReservationEmailTemplate,
} from '../types'

const MAX_FIELD_LENGTH = 500
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

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
  value: ReservationEmailTemplate,
  defaults: ReservationEmailTemplate,
): ReservationEmailTemplate {
  return {
    subject: sanitizeOptionalText(value.subject),
    headerEyebrow: sanitizeText(value.headerEyebrow, defaults.headerEyebrow, 80),
    headline: sanitizeOptionalText(value.headline, 120),
    introMessage: sanitizeText(value.introMessage, defaults.introMessage),
    preDetailsMessage: sanitizeOptionalText(value.preDetailsMessage),
    detailsSectionTitle: sanitizeText(value.detailsSectionTitle, defaults.detailsSectionTitle, 80),
    closingMessage: sanitizeText(value.closingMessage, defaults.closingMessage),
    accentColor: sanitizeColor(value.accentColor, defaults.accentColor),
    accentColorEnd: sanitizeColor(value.accentColorEnd, defaults.accentColorEnd),
    headerStyle: sanitizeHeaderStyle(value.headerStyle, defaults.headerStyle),
    layoutStyle: sanitizeLayoutStyle(value.layoutStyle, defaults.layoutStyle),
    showRestaurantLogo: sanitizeBoolean(value.showRestaurantLogo, defaults.showRestaurantLogo),
    showRestaurantName: sanitizeBoolean(value.showRestaurantName, defaults.showRestaurantName),
    showDate: sanitizeBoolean(value.showDate, defaults.showDate),
    showTime: sanitizeBoolean(value.showTime, defaults.showTime),
    showPax: sanitizeBoolean(value.showPax, defaults.showPax),
    showTable: sanitizeBoolean(value.showTable, defaults.showTable),
    showPhone: sanitizeBoolean(value.showPhone, defaults.showPhone),
    showLocation: sanitizeBoolean(value.showLocation, defaults.showLocation),
    showNotes: sanitizeBoolean(value.showNotes, defaults.showNotes),
    showWebsite: sanitizeBoolean(value.showWebsite, defaults.showWebsite),
    showContactEmail: sanitizeBoolean(value.showContactEmail, defaults.showContactEmail),
    showCancelButton: sanitizeBoolean(value.showCancelButton, defaults.showCancelButton),
    cancelButtonLabel: sanitizeText(value.cancelButtonLabel, defaults.cancelButtonLabel, 60),
    cancelHelpText: sanitizeText(value.cancelHelpText, defaults.cancelHelpText, 240),
    showPromotion: sanitizeBoolean(value.showPromotion, defaults.showPromotion),
    promotionTitle: sanitizeText(value.promotionTitle, defaults.promotionTitle, 80),
    promotionMessage: sanitizeText(value.promotionMessage, defaults.promotionMessage),
    promotionCode: sanitizeOptionalText(value.promotionCode, 40),
    showViewRestaurantButton: sanitizeBoolean(
      value.showViewRestaurantButton,
      defaults.showViewRestaurantButton,
    ),
    viewRestaurantButtonLabel: sanitizeText(
      value.viewRestaurantButtonLabel,
      defaults.viewRestaurantButtonLabel,
      60,
    ),
  }
}

export function normalizeCompanyEmailTemplates(templates: CompanyEmailTemplates): CompanyEmailTemplates {
  return {
    received: normalizeReservationEmailTemplate(templates.received, DEFAULT_RECEIVED_EMAIL_TEMPLATE),
    confirmation: normalizeReservationEmailTemplate(
      templates.confirmation,
      DEFAULT_CONFIRMATION_EMAIL_TEMPLATE,
    ),
  }
}

export function parseCompanyEmailTemplatesFromFirestore(value: unknown): CompanyEmailTemplates {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  const receivedRaw = raw.received && typeof raw.received === 'object'
    ? (raw.received as ReservationEmailTemplate)
    : DEFAULT_RECEIVED_EMAIL_TEMPLATE
  const confirmationRaw = raw.confirmation && typeof raw.confirmation === 'object'
    ? (raw.confirmation as ReservationEmailTemplate)
    : DEFAULT_CONFIRMATION_EMAIL_TEMPLATE

  return normalizeCompanyEmailTemplates({
    received: normalizeReservationEmailTemplate(receivedRaw, DEFAULT_RECEIVED_EMAIL_TEMPLATE),
    confirmation: normalizeReservationEmailTemplate(confirmationRaw, DEFAULT_CONFIRMATION_EMAIL_TEMPLATE),
  })
}

export function emailTemplatesEqual(a: CompanyEmailTemplates, b: CompanyEmailTemplates): boolean {
  return JSON.stringify(normalizeCompanyEmailTemplates(a)) === JSON.stringify(normalizeCompanyEmailTemplates(b))
}

export const EMAIL_TEMPLATE_BOOLEAN_FIELDS: Array<{
  key: keyof ReservationEmailTemplate
  label: string
  hint?: string
}> = [
  { key: 'showRestaurantLogo', label: 'Logo del restaurante en cabecera' },
  { key: 'showRestaurantName', label: 'Nombre del restaurante en cabecera' },
  { key: 'showDate', label: 'Mostrar fecha' },
  { key: 'showTime', label: 'Mostrar hora' },
  { key: 'showPax', label: 'Mostrar comensales' },
  { key: 'showTable', label: 'Mostrar mesa' },
  { key: 'showPhone', label: 'Mostrar teléfono' },
  { key: 'showLocation', label: 'Mostrar dirección' },
  { key: 'showNotes', label: 'Mostrar notas del cliente' },
  { key: 'showWebsite', label: 'Mostrar web del restaurante' },
  { key: 'showContactEmail', label: 'Mostrar correo de contacto' },
  {
    key: 'showCancelButton',
    label: 'Botón cancelar reserva',
    hint: 'Enlace seguro para que el cliente cancele online.',
  },
  {
    key: 'showViewRestaurantButton',
    label: 'Botón ver restaurante',
    hint: 'Lleva a la ficha pública del local.',
  },
  {
    key: 'showPromotion',
    label: 'Bloque de promoción u oferta',
    hint: 'Solo puedes activar una promoción por plantilla.',
  },
]
