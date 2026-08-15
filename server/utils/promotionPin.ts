export type PromotionPinRotation = 'daily' | 'weekly' | 'monthly' | 'manual'

export interface PromotionPinSettings {
  code: string
  rotation: PromotionPinRotation
  nextRotationAt: Date | null
  lastRotatedAt: Date | null
  updatedAt: Date
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

export function mapPromotionPin(data: Record<string, unknown> | undefined): PromotionPinSettings | null {
  if (!data || typeof data.code !== 'string') {
    return null
  }

  const rotation = data.rotation as PromotionPinRotation
  const validRotations: PromotionPinRotation[] = ['daily', 'weekly', 'monthly', 'manual']

  const toDate = (value: unknown): Date | null => {
    if (value instanceof Date) {
      return value
    }

    if (value && typeof value === 'object' && 'toDate' in value) {
      const maybeDate = (value as { toDate?: () => Date }).toDate?.()
      return maybeDate instanceof Date ? maybeDate : null
    }

    return null
  }

  return {
    code: normalizePromotionPinCode(data.code),
    rotation: validRotations.includes(rotation) ? rotation : 'manual',
    nextRotationAt: toDate(data.nextRotationAt),
    lastRotatedAt: toDate(data.lastRotatedAt),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  }
}
