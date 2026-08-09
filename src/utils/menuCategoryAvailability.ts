import type { MenuCategoryAvailability } from '../types/company'

export const DEFAULT_MENU_CATEGORY_AVAILABILITY: MenuCategoryAvailability = {
  enabled: false,
  start: '13:00',
  end: '16:00',
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function normalizeMenuCategoryAvailability(raw: unknown): MenuCategoryAvailability {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_MENU_CATEGORY_AVAILABILITY }
  }

  const value = raw as Partial<MenuCategoryAvailability>

  return {
    enabled: Boolean(value.enabled),
    start: typeof value.start === 'string' ? value.start : DEFAULT_MENU_CATEGORY_AVAILABILITY.start,
    end: typeof value.end === 'string' ? value.end : DEFAULT_MENU_CATEGORY_AVAILABILITY.end,
  }
}

export function isMenuCategoryAvailable(
  availability: MenuCategoryAvailability,
  at: Date = new Date(),
): boolean {
  if (!availability.enabled || !availability.start || !availability.end) {
    return true
  }

  const nowMinutes = at.getHours() * 60 + at.getMinutes()
  const startMinutes = timeToMinutes(availability.start)
  const endMinutes = timeToMinutes(availability.end)

  if (startMinutes === endMinutes) {
    return false
  }

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes
}

export function formatMenuCategoryAvailability(
  availability: MenuCategoryAvailability,
): string | null {
  if (!availability.enabled || !availability.start || !availability.end) {
    return null
  }

  return `${availability.start} – ${availability.end}`
}

export function validateMenuCategoryAvailability(
  availability: MenuCategoryAvailability,
  categoryName: string,
): string | null {
  if (!availability.enabled) {
    return null
  }

  const label = categoryName.trim() || 'la categoría'

  if (!availability.start || !availability.end) {
    return `Indica el horario de «${label}».`
  }

  if (availability.start === availability.end) {
    return `El horario de «${label}» no puede empezar y terminar a la misma hora.`
  }

  return null
}
