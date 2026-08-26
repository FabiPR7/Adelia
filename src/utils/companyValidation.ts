import {
  COMPANY_CHARACTERISTIC_OPTIONS,
  MAX_COMPANY_CHARACTERISTICS,
  MAX_COMPANY_PHOTOS,
  MAX_COMPANY_VIDEOS,
} from '../data/companyCharacteristics'
import {
  MAX_COMPANY_VENUE_TYPES,
  sanitizeCompanyAmenities,
  sanitizeCompanyPriceRange,
  sanitizeCompanyVenueTypes,
} from '../data/companyProfileFacilities'
import type { CompanySchedule, CompanySettingsPayload, ServiceTurn } from '../types'
import { withFloorPlans } from '../types/company'
import { isValidMapCoordinates } from './mapCoordinates'
import { normalizeMainPhotoIndex } from './companyPhotos'
import {
  formatSpanishPhoneForStorage,
  isValidEmail,
  isValidSpanishPhone,
} from './helpers'
import {
  normalizeCompanySchedule,
  validateCompanyScheduleDetailed,
} from './schedule'
import {
  DEFAULT_DEPOSIT_CANCELLATION_HOURS,
  MAX_DEPOSIT_CANCELLATION_HOURS,
} from './reservationDeposit'
import { parseCompanyReservationMode } from '../data/companyReservationMode'

const ALLOWED_CHARACTERISTICS = new Set<string>(COMPANY_CHARACTERISTIC_OPTIONS)

const SPAIN_COUNTRY_NAMES = new Set(['españa', 'espana', 'spain', 'es'])

const MAX_DESCRIPTION_LENGTH = 2000
const MIN_DESCRIPTION_LENGTH = 10

function hasEnoughLetters(value: string, minimum = 2): boolean {
  return (value.match(/\p{L}/gu)?.length ?? 0) >= minimum
}

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function isValidRestaurantName(input: string): boolean {
  const trimmed = normalizeSpaces(input)

  if (trimmed.length < 2 || trimmed.length > 100) {
    return false
  }

  return hasEnoughLetters(trimmed, 2)
}

export function isValidContactEmail(input: string): boolean {
  const trimmed = input.trim()
  return !trimmed || isValidEmail(trimmed)
}

export function isValidWebsite(input: string): boolean {
  const trimmed = input.trim()

  if (!trimmed) {
    return true
  }

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isValidAddress(input: string): boolean {
  const trimmed = normalizeSpaces(input)

  if (trimmed.length < 5 || trimmed.length > 200) {
    return false
  }

  return hasEnoughLetters(trimmed, 3)
}

export function isValidMunicipality(input: string): boolean {
  const trimmed = normalizeSpaces(input)

  if (!trimmed) {
    return true
  }

  if (trimmed.length < 2 || trimmed.length > 80) {
    return false
  }

  return /^[\p{L}\d\s'.-]+$/u.test(trimmed) && hasEnoughLetters(trimmed, 2)
}

export function isValidCountry(input: string): boolean {
  const trimmed = normalizeSpaces(input)

  if (!trimmed) {
    return true
  }

  if (trimmed.length < 2 || trimmed.length > 60) {
    return false
  }

  return /^[\p{L}\s'.-]+$/u.test(trimmed) && hasEnoughLetters(trimmed, 2)
}

export function isValidPostalCode(input: string, country: string): boolean {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, '')

  if (!trimmed) {
    return true
  }

  const countryKey = country.trim().toLowerCase()

  if (SPAIN_COUNTRY_NAMES.has(countryKey) || !countryKey) {
    return /^\d{5}$/.test(trimmed)
  }

  return /^[A-Z0-9-]{3,10}$/i.test(trimmed)
}

export function isValidCompanyDescription(input: string): boolean {
  const trimmed = input.trim()

  if (!trimmed) {
    return true
  }

  return trimmed.length >= MIN_DESCRIPTION_LENGTH && trimmed.length <= MAX_DESCRIPTION_LENGTH
}

export function isValidMediaUrl(input: string): boolean {
  const trimmed = input.trim()

  if (!trimmed) {
    return false
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function sanitizeCompanyCharacteristics(input: string[]): string[] {
  return [...new Set(input.filter((item) => ALLOWED_CHARACTERISTICS.has(item)))].slice(
    0,
    MAX_COMPANY_CHARACTERISTICS,
  )
}

export function sanitizeMediaUrls(input: string[], maxItems: number): string[] {
  return input
    .map((item) => item.trim())
    .filter((item) => isValidMediaUrl(item))
    .slice(0, maxItems)
}

export function validateCompanyContact(payload: Pick<
  CompanySettingsPayload,
  'name' | 'contactEmail' | 'phone' | 'location' | 'website' | 'logoUrl'
>): string | null {
  if (!isValidRestaurantName(payload.name)) {
    return 'Indica un nombre de restaurante válido (2-100 letras).'
  }

  if (!payload.phone.trim()) {
    return 'Indica el teléfono.'
  }

  if (!isValidSpanishPhone(payload.phone)) {
    return 'Indica un teléfono válido de España (9 dígitos, p. ej. 612 345 678).'
  }

  if (!isValidAddress(payload.location)) {
    return 'Indica una dirección válida (mínimo 5 caracteres).'
  }

  if (!isValidContactEmail(payload.contactEmail)) {
    return 'Indica un correo electrónico de contacto válido.'
  }

  if (!isValidWebsite(payload.website)) {
    return 'Indica una web válida (p. ej. https://turestaurante.com).'
  }

  if (payload.logoUrl.trim() && !isValidMediaUrl(payload.logoUrl)) {
    return 'La URL del logo no es válida.'
  }

  return null
}

export function validateCompanyProfile(payload: Pick<
  CompanySettingsPayload,
  'municipality' | 'country' | 'postalCode' | 'description' | 'photos' | 'videos' | 'characteristics' | 'venueTypes' | 'amenities' | 'priceRange' | 'latitude' | 'longitude'
>): string | null {
  if (!isValidMunicipality(payload.municipality)) {
    return 'Indica un municipio válido.'
  }

  if (!isValidCountry(payload.country)) {
    return 'Indica un país válido.'
  }

  if (!isValidPostalCode(payload.postalCode, payload.country)) {
    return 'Indica un código postal válido (5 dígitos en España).'
  }

  if (!isValidCompanyDescription(payload.description)) {
    return `La descripción debe tener entre ${MIN_DESCRIPTION_LENGTH} y ${MAX_DESCRIPTION_LENGTH} caracteres.`
  }

  if (payload.photos.length > MAX_COMPANY_PHOTOS) {
    return `Puedes subir como máximo ${MAX_COMPANY_PHOTOS} fotos.`
  }

  if (payload.videos.length > MAX_COMPANY_VIDEOS) {
    return `Puedes subir como máximo ${MAX_COMPANY_VIDEOS} vídeos.`
  }

  if (payload.photos.some((url) => !isValidMediaUrl(url))) {
    return 'Una o más fotos no tienen una URL válida.'
  }

  if (payload.videos.some((url) => !isValidMediaUrl(url))) {
    return 'Uno o más vídeos no tienen una URL válida.'
  }

  if (payload.characteristics.length > MAX_COMPANY_CHARACTERISTICS) {
    return `Puedes elegir como máximo ${MAX_COMPANY_CHARACTERISTICS} características.`
  }

  const invalidCharacteristic = payload.characteristics.find(
    (item) => !ALLOWED_CHARACTERISTICS.has(item),
  )

  if (invalidCharacteristic) {
    return 'Hay características no válidas. Elige opciones de la lista.'
  }

  if (payload.venueTypes.length > MAX_COMPANY_VENUE_TYPES) {
    return `Puedes elegir como máximo ${MAX_COMPANY_VENUE_TYPES} tipos de local.`
  }

  if (sanitizeCompanyVenueTypes(payload.venueTypes).length !== payload.venueTypes.length) {
    return 'Hay tipos de local no válidos.'
  }

  if (sanitizeCompanyAmenities(payload.amenities).length !== payload.amenities.length) {
    return 'Hay servicios no válidos.'
  }

  if (sanitizeCompanyPriceRange(payload.priceRange) !== payload.priceRange) {
    return 'El rango de precio no es válido.'
  }

  if (!isValidMapCoordinates(payload.latitude, payload.longitude)) {
    return 'Marca la ubicación exacta de tu local en el mapa.'
  }

  return null
}

export function validateServiceTurns(turns: ServiceTurn[]): string | null {
  for (const turn of turns) {
    const name = turn.name.trim()

    if (!name) {
      continue
    }

    if (name.length < 2 || name.length > 40) {
      return 'Indica un nombre válido para cada turno (2-40 caracteres).'
    }

    if (!turn.start || !turn.end) {
      return `Completa la hora de inicio y fin del turno «${name}».`
    }

    if (turn.start >= turn.end) {
      return `El turno «${name}» debe terminar después de la hora de inicio.`
    }
  }

  return null
}

export function validateCompanySchedule(schedule: CompanySchedule): string | null {
  return validateCompanyScheduleDetailed(normalizeCompanySchedule(schedule))
}

const MAX_DEPOSIT_MIN_PAX = 500
const MAX_DEPOSIT_PER_GUEST_CENTS = 500_00

export function normalizeDepositMinPax(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }

  const rounded = Math.trunc(value)

  if (rounded <= 0) {
    return null
  }

  return Math.min(MAX_DEPOSIT_MIN_PAX, rounded)
}

export function normalizeDepositPerGuestCents(
  depositMinPax: number | null | undefined,
  value: number | null | undefined,
): number | null {
  const threshold = normalizeDepositMinPax(depositMinPax)

  if (threshold == null) {
    return null
  }

  if (value == null || !Number.isFinite(value)) {
    return null
  }

  const rounded = Math.trunc(value)

  if (rounded <= 0) {
    return null
  }

  return Math.min(MAX_DEPOSIT_PER_GUEST_CENTS, rounded)
}

export function normalizeDepositCancellationHours(
  depositEnabled: boolean,
  depositMinPax: number | null | undefined,
  value: number | null | undefined,
): number | null {
  if (!depositEnabled || normalizeDepositMinPax(depositMinPax) == null) {
    return null
  }

  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_DEPOSIT_CANCELLATION_HOURS
  }

  const rounded = Math.trunc(value)

  if (rounded <= 0) {
    return null
  }

  return Math.min(MAX_DEPOSIT_CANCELLATION_HOURS, rounded)
}

export function validateReservationDepositSettings(
  depositEnabled: boolean,
  depositMinPax: number | null | undefined,
  depositPerGuestCents: number | null | undefined,
  depositCancellationHours: number | null | undefined,
): string | null {
  if (!depositEnabled) {
    return null
  }

  const threshold = normalizeDepositMinPax(depositMinPax)
  const perGuest = normalizeDepositPerGuestCents(depositMinPax, depositPerGuestCents)

  if (threshold == null) {
    return null
  }

  if (perGuest == null) {
    return 'Indica el importe de fianza por comensal cuando defines a partir de cuántos comensales se pide.'
  }

  const cancellationHours = normalizeDepositCancellationHours(
    depositEnabled,
    depositMinPax,
    depositCancellationHours,
  )

  if (cancellationHours == null) {
    return 'Indica con cuántas horas de antelación se puede cancelar sin perder la fianza.'
  }

  return null
}

export function normalizeCompanySettingsPayload(
  payload: CompanySettingsPayload,
): CompanySettingsPayload {
  const reservationMode = parseCompanyReservationMode(payload.reservationMode)
  const depositEnabled = reservationMode !== 'none' && payload.depositEnabled === true

  return {
    ...payload,
    name: normalizeSpaces(payload.name),
    contactEmail: payload.contactEmail.trim(),
    phone: isValidSpanishPhone(payload.phone)
      ? formatSpanishPhoneForStorage(payload.phone)
      : payload.phone.trim(),
    website: payload.website.trim(),
    location: normalizeSpaces(payload.location),
    municipality: normalizeSpaces(payload.municipality),
    country: normalizeSpaces(payload.country) || 'España',
    postalCode: payload.postalCode.trim().toUpperCase().replace(/\s+/g, ''),
    latitude: payload.latitude,
    longitude: payload.longitude,
    description: payload.description.trim(),
    logoUrl: payload.logoUrl.trim(),
    photos: sanitizeMediaUrls(payload.photos, MAX_COMPANY_PHOTOS),
    mainPhotoIndex: normalizeMainPhotoIndex(
      payload.mainPhotoIndex,
      sanitizeMediaUrls(payload.photos, MAX_COMPANY_PHOTOS).length,
    ),
    videos: sanitizeMediaUrls(payload.videos, MAX_COMPANY_VIDEOS),
    characteristics: sanitizeCompanyCharacteristics(payload.characteristics),
    venueTypes: sanitizeCompanyVenueTypes(payload.venueTypes),
    amenities: sanitizeCompanyAmenities(payload.amenities),
    priceRange: sanitizeCompanyPriceRange(payload.priceRange),
    reservationMode,
    depositEnabled,
    depositMinPax: depositEnabled ? normalizeDepositMinPax(payload.depositMinPax) : null,
    depositPerGuestCents: depositEnabled
      ? normalizeDepositPerGuestCents(payload.depositMinPax, payload.depositPerGuestCents)
      : null,
    depositCancellationHours: depositEnabled
      ? normalizeDepositCancellationHours(
        true,
        payload.depositMinPax,
        payload.depositCancellationHours,
      )
      : null,
    turns: payload.turns.map((turn) => ({
      name: normalizeSpaces(turn.name),
      start: turn.start,
      end: turn.end,
    })),
    schedule: normalizeCompanySchedule(payload.schedule),
    ...withFloorPlans(
      payload.floorPlans?.length
        ? payload.floorPlans
        : payload.floorPlan
          ? [payload.floorPlan]
          : [],
    ),
  }
}

export function validateCompanySettingsPayload(payload: CompanySettingsPayload): string | null {
  return (
    validateCompanyContact(payload) ??
    validateCompanyProfile(payload)
  )
}
