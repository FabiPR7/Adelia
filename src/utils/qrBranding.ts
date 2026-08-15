import { ADELIA_LOGO_URL } from '../constants/brand'
import type { CompanyQrBranding, QrBrandingConfig, QrBrandingKind, QrLogoMode } from '../types/company'
import type { BrandedQrRenderOptions } from './bookingQr'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from './cloudinaryUrl'

const DEFAULT_DARK_COLOR = '#5c4a3a'
const DEFAULT_SUBTITLE_COLOR = '#8b7355'

export function defaultQrBrandingConfig(): QrBrandingConfig {
  return {
    logoMode: 'adelia',
    title: '',
    subtitle: '',
    showTitle: true,
    showSubtitle: true,
    darkColor: DEFAULT_DARK_COLOR,
  }
}

export function defaultCompanyQrBranding(): CompanyQrBranding {
  return {
    booking: defaultQrBrandingConfig(),
    menu: defaultQrBrandingConfig(),
  }
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function normalizeLogoMode(value: unknown): QrLogoMode {
  if (value === 'restaurant' || value === 'none') {
    return value
  }

  return 'adelia'
}

export function parseQrBrandingConfig(value: unknown): QrBrandingConfig {
  if (!value || typeof value !== 'object') {
    return defaultQrBrandingConfig()
  }

  const data = value as Partial<QrBrandingConfig>
  const darkColor =
    typeof data.darkColor === 'string' && isValidHexColor(data.darkColor)
      ? data.darkColor
      : DEFAULT_DARK_COLOR

  return {
    logoMode: normalizeLogoMode(data.logoMode),
    title: typeof data.title === 'string' ? data.title.slice(0, 60) : '',
    subtitle: typeof data.subtitle === 'string' ? data.subtitle.slice(0, 80) : '',
    showTitle: data.showTitle !== false,
    showSubtitle: data.showSubtitle !== false,
    darkColor,
  }
}

export function parseCompanyQrBranding(value: unknown): CompanyQrBranding {
  if (!value || typeof value !== 'object') {
    return defaultCompanyQrBranding()
  }

  const data = value as Partial<CompanyQrBranding>

  return {
    booking: parseQrBrandingConfig(data.booking),
    menu: parseQrBrandingConfig(data.menu),
  }
}

export function normalizeQrBrandingConfig(config: QrBrandingConfig): QrBrandingConfig {
  return {
    logoMode: normalizeLogoMode(config.logoMode),
    title: config.title.trim().slice(0, 60),
    subtitle: config.subtitle.trim().slice(0, 80),
    showTitle: config.showTitle,
    showSubtitle: config.showSubtitle,
    darkColor: isValidHexColor(config.darkColor) ? config.darkColor : DEFAULT_DARK_COLOR,
  }
}

export function serializeCompanyQrBranding(branding: CompanyQrBranding) {
  return {
    booking: normalizeQrBrandingConfig(branding.booking),
    menu: normalizeQrBrandingConfig(branding.menu),
  }
}

export interface ResolveQrBrandingContext {
  companyName: string
  companyLogoUrl: string
  menuBoardName?: string
}

export function resolveDefaultSubtitle(
  kind: QrBrandingKind,
  context: ResolveQrBrandingContext,
): string {
  if (kind === 'menu') {
    return context.menuBoardName?.trim() || context.companyName.trim()
  }

  return context.companyName.trim()
}

export function resolveRestaurantLogoUrl(companyLogoUrl: string): string | null {
  const trimmed = companyLogoUrl.trim()

  if (!trimmed) {
    return null
  }

  return optimizeCloudinaryUrl(trimmed, CLOUDINARY_DISPLAY.logo)
}

export function resolveBrandedQrOptions(
  config: QrBrandingConfig,
  kind: QrBrandingKind,
  context: ResolveQrBrandingContext,
): BrandedQrRenderOptions {
  const normalized = normalizeQrBrandingConfig(config)
  const defaultSubtitle = resolveDefaultSubtitle(kind, context)

  let logoUrl: string | null = null

  if (normalized.logoMode === 'adelia') {
    logoUrl = ADELIA_LOGO_URL
  } else if (normalized.logoMode === 'restaurant') {
    logoUrl = resolveRestaurantLogoUrl(context.companyLogoUrl)
  }

  return {
    logoUrl,
    title: normalized.showTitle ? normalized.title || 'Adelia' : null,
    subtitle: normalized.showSubtitle
      ? normalized.subtitle || defaultSubtitle || null
      : null,
    darkColor: normalized.darkColor,
    subtitleColor: DEFAULT_SUBTITLE_COLOR,
  }
}

export const QR_BRANDING_KIND_LABELS: Record<QrBrandingKind, string> = {
  booking: 'Enlace de reservas',
  menu: 'Carta digital',
}
