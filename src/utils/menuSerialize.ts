// Cómo se guarda una carta y sus productos. Lo usan el panel (para pintar) y el
// servidor (para guardar): mismas reglas en los dos lados.
import { defaultMenuTemplate, normalizeMenuBackgroundImageOpacity } from '../data/menuTemplates'
import { normalizeMenuCategoryAvailability } from './menuCategoryAvailability'
import type { MenuBoardInput, MenuNodeInput, MenuTemplateConfig } from '../types/company'

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export function normalizeMenuTemplate(data: Record<string, unknown>): MenuTemplateConfig {
  const fallback = defaultMenuTemplate()
  const color = (value: unknown, fallbackValue: string) => (typeof value === 'string' && value.length <= 40 ? value : fallbackValue)

  return {
    templateId: typeof data.templateId === 'string' ? data.templateId.slice(0, 40) : fallback.templateId,
    backgroundColor: color(data.backgroundColor, fallback.backgroundColor),
    backgroundImageUrl: typeof data.backgroundImageUrl === 'string' ? data.backgroundImageUrl.slice(0, 600) : '',
    backgroundImageOpacity: normalizeMenuBackgroundImageOpacity(
      data.backgroundImageOpacity ?? fallback.backgroundImageOpacity,
    ),
    fontFamily: typeof data.fontFamily === 'string' ? data.fontFamily.slice(0, 80) : fallback.fontFamily,
    titleColor: color(data.titleColor, fallback.titleColor),
    textColor: color(data.textColor, fallback.textColor),
    accentColor: color(data.accentColor, fallback.accentColor),
    familyColor: color(data.familyColor ?? data.accentColor, fallback.familyColor),
    subfamilyColor: color(data.subfamilyColor ?? data.textColor, fallback.subfamilyColor),
    priceColor: color(data.priceColor, fallback.priceColor),
    layout: data.layout === 'grid' ? 'grid' : 'list',
    showPhotos: data.showPhotos !== false,
    showAllergens: data.showAllergens !== false,
    showDescriptions: data.showDescriptions !== false,
    tagline: typeof data.tagline === 'string' ? data.tagline.slice(0, 80) : '',
    showCategoryNav: data.showCategoryNav !== false,
    showSearch: data.showSearch !== false,
    cardStyle: data.cardStyle === 'outline' || data.cardStyle === 'plain' ? data.cardStyle : 'soft',
    density: data.density === 'compact' ? 'compact' : 'comfortable',
    headerAlign: data.headerAlign === 'left' ? 'left' : 'center',
    photoShape: data.photoShape === 'square' || data.photoShape === 'circle' ? data.photoShape : 'rounded',
  }
}

/** Datos de una carta tal y como se guardan (sin fechas: las pone quien guarda). */
export function serializeMenuBoard(companyId: string, input: MenuBoardInput) {
  return {
    companyId,
    name: text(input.name, 80),
    active: input.active !== false,
    sortOrder: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
    template: normalizeMenuTemplate((input.template ?? {}) as unknown as Record<string, unknown>),
    pdfUrl: text(input.pdfUrl, 600),
    pdfFileName: text(input.pdfFileName, 160),
    pdfPages: typeof input.pdfPages === 'number' && input.pdfPages > 0 ? Math.min(200, Math.trunc(input.pdfPages)) : 0,
  }
}

/** Datos de un apartado o producto tal y como se guardan (sin fechas). */
export function serializeMenuNode(companyId: string, input: MenuNodeInput) {
  const isProduct = input.nodeType === 'product'
  const price = typeof input.priceCents === 'number' && Number.isFinite(input.priceCents)
    ? Math.max(0, Math.min(100_000_00, Math.round(input.priceCents)))
    : null
  return {
    companyId,
    boardId: text(input.boardId, 80),
    nodeType: isProduct ? 'product' : 'family',
    parentId: typeof input.parentId === 'string' && input.parentId.trim() ? input.parentId.trim().slice(0, 80) : null,
    sortOrder: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
    name: text(input.name, 120),
    description: text(input.description, 600),
    allergens: Array.isArray(input.allergens)
      ? input.allergens.filter((item): item is string => typeof item === 'string').slice(0, 20).map((item) => item.slice(0, 40))
      : [],
    priceCents: isProduct ? price : null,
    priceCurrency: isProduct && typeof input.priceCurrency === 'string' && input.priceCurrency.trim()
      ? input.priceCurrency.trim().toUpperCase().slice(0, 3)
      : 'EUR',
    photoUrl: isProduct ? text(input.photoUrl, 600) : '',
    active: input.active !== false,
    availability: isProduct
      ? { enabled: false, start: '', end: '' }
      : normalizeMenuCategoryAvailability(input.availability),
  }
}
