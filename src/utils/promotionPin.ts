import type { PromotionPinRotation, PromotionPinSettings } from '../types/company'

export const PROMOTION_PIN_ROTATION_LABELS: Record<PromotionPinRotation, string> = {
  daily: 'Cada día',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  manual: 'Indefinidamente (manual)',
}

const PIN_LENGTH = 4

export function generatePromotionPinCode(): string {
  const min = 10 ** (PIN_LENGTH - 1)
  const max = 10 ** PIN_LENGTH - 1
  return String(Math.floor(min + Math.random() * (max - min + 1)))
}

export function normalizePromotionPinCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, PIN_LENGTH)
}

export function validatePromotionPinCode(code: string): string | null {
  const normalized = normalizePromotionPinCode(code)

  if (normalized.length !== PIN_LENGTH) {
    return `El código debe tener exactamente ${PIN_LENGTH} dígitos.`
  }

  return null
}

export function computeNextPromotionPinRotation(
  from: Date,
  rotation: PromotionPinRotation,
): Date | null {
  if (rotation === 'manual') {
    return null
  }

  const next = new Date(from)

  if (rotation === 'daily') {
    next.setDate(next.getDate() + 1)
    return next
  }

  if (rotation === 'weekly') {
    next.setDate(next.getDate() + 7)
    return next
  }

  const day = next.getDate()
  next.setMonth(next.getMonth() + 1)
  if (next.getDate() !== day) {
    next.setDate(0)
  }

  return next
}

export function defaultPromotionPinSettings(now = new Date()): PromotionPinSettings {
  return {
    code: generatePromotionPinCode(),
    rotation: 'manual',
    nextRotationAt: null,
    lastRotatedAt: now,
    updatedAt: now,
  }
}

export function applyDuePromotionPinRotation(
  settings: PromotionPinSettings,
  now = new Date(),
): { settings: PromotionPinSettings; rotated: boolean } {
  if (
    settings.rotation === 'manual'
    || !settings.nextRotationAt
    || settings.nextRotationAt.getTime() > now.getTime()
  ) {
    return { settings, rotated: false }
  }

  const code = generatePromotionPinCode()
  const lastRotatedAt = now
  const nextRotationAt = computeNextPromotionPinRotation(now, settings.rotation)

  return {
    settings: {
      ...settings,
      code,
      lastRotatedAt,
      nextRotationAt,
      updatedAt: now,
    },
    rotated: true,
  }
}

export function formatPromotionPinRotationHint(
  rotation: PromotionPinRotation,
  nextRotationAt: Date | null,
): string | null {
  if (rotation === 'manual') {
    return 'Solo cambia cuando tú lo actualices.'
  }

  if (!nextRotationAt) {
    return 'Se generará el próximo cambio al guardar.'
  }

  const formatted = nextRotationAt.toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `Próximo cambio automático: ${formatted}.`
}
