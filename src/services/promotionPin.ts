import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { PromotionPinRotation, PromotionPinSettings } from '../types/company'
import {
  applyDuePromotionPinRotation,
  computeNextPromotionPinRotation,
  defaultPromotionPinSettings,
  generatePromotionPinCode,
  normalizePromotionPinCode,
  validatePromotionPinCode,
} from '../utils/promotionPin'

export interface PromotionPinSaveInput {
  code: string
  rotation: PromotionPinRotation
}

function mapPromotionPin(data: Record<string, unknown> | undefined): PromotionPinSettings | null {
  if (!data || typeof data.code !== 'string') {
    return null
  }

  const rotation = data.rotation as PromotionPinRotation
  const validRotations: PromotionPinRotation[] = ['daily', 'weekly', 'monthly', 'manual']

  return {
    code: normalizePromotionPinCode(data.code),
    rotation: validRotations.includes(rotation) ? rotation : 'manual',
    nextRotationAt: (data.nextRotationAt as { toDate?: () => Date } | null | undefined)?.toDate?.() ?? null,
    lastRotatedAt: (data.lastRotatedAt as { toDate?: () => Date } | null | undefined)?.toDate?.() ?? null,
    updatedAt: (data.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date(),
  }
}

function serializePromotionPin(settings: PromotionPinSettings) {
  return {
    code: settings.code,
    rotation: settings.rotation,
    nextRotationAt: settings.nextRotationAt,
    lastRotatedAt: settings.lastRotatedAt,
    updatedAt: serverTimestamp(),
  }
}

async function persistPromotionPin(
  companyId: string,
  settings: PromotionPinSettings,
): Promise<PromotionPinSettings> {
  const companyRef = doc(db, 'companies', companyId)
  await updateDoc(companyRef, {
    promotionPin: serializePromotionPin(settings),
  })

  return settings
}

export async function getPromotionPinSettings(companyId: string): Promise<PromotionPinSettings> {
  const companyRef = doc(db, 'companies', companyId)
  const snapshot = await getDoc(companyRef)
  const stored = mapPromotionPin(snapshot.data()?.promotionPin as Record<string, unknown> | undefined)
  const base = stored ?? defaultPromotionPinSettings()
  const { settings, rotated } = applyDuePromotionPinRotation(base)

  if (rotated) {
    return persistPromotionPin(companyId, settings)
  }

  return settings
}

export async function savePromotionPinSettings(
  companyId: string,
  input: PromotionPinSaveInput,
  options?: { regenerate?: boolean },
): Promise<PromotionPinSettings> {
  const code = options?.regenerate
    ? generatePromotionPinCode()
    : normalizePromotionPinCode(input.code)

  const validationError = validatePromotionPinCode(code)
  if (validationError) {
    throw new Error(validationError)
  }

  const now = new Date()
  const nextRotationAt = input.rotation === 'manual'
    ? null
    : computeNextPromotionPinRotation(now, input.rotation)

  const settings: PromotionPinSettings = {
    code,
    rotation: input.rotation,
    nextRotationAt,
    lastRotatedAt: now,
    updatedAt: now,
  }

  return persistPromotionPin(companyId, settings)
}
