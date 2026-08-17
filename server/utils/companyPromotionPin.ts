import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import {
  applyDuePromotionPinRotation,
  defaultPromotionPinSettings,
  mapPromotionPin,
  type PromotionPinSettings,
} from './promotionPin.ts'

function serializePromotionPin(settings: PromotionPinSettings) {
  return {
    code: settings.code,
    rotation: settings.rotation,
    nextRotationAt: settings.nextRotationAt ? Timestamp.fromDate(settings.nextRotationAt) : null,
    lastRotatedAt: settings.lastRotatedAt ? Timestamp.fromDate(settings.lastRotatedAt) : null,
    updatedAt: Timestamp.now(),
  }
}

export async function resolveCompanyPromotionPin(
  companyRef: FirebaseFirestore.DocumentReference,
  companyData: FirebaseFirestore.DocumentData,
): Promise<string> {
  const privateRef = companyRef.collection('private').doc('promotionPin')
  const privateSnap = await privateRef.get()
  const privatePin = mapPromotionPin(privateSnap.data() as Record<string, unknown> | undefined)
  const legacyPin = mapPromotionPin(
    companyData.promotionPin as Record<string, unknown> | undefined,
  )
  const base = privatePin ?? legacyPin ?? defaultPromotionPinSettings()
  const { settings, rotated } = applyDuePromotionPinRotation(base)

  if (!privatePin || rotated || legacyPin) {
    const batch = companyRef.firestore.batch()
    batch.set(privateRef, serializePromotionPin(settings))
    if ('promotionPin' in companyData) {
      batch.update(companyRef, { promotionPin: FieldValue.delete() })
    }
    await batch.commit()
  }

  return settings.code
}
