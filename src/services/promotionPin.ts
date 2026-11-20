import type { PromotionPinRotation, PromotionPinSettings } from '../types/company'
import {
  getDemoPinSettings,
  isDemoCompanyId,
  rejectIfDemoCompanyWrite,
} from '../data/companyPanelDemo'
import { callCompanyApi } from './companyApi'

// El PIN de promociones vive en el servidor: el panel lo lee y lo cambia por la API
// (antes lo escribía directamente en la base de datos).

export interface PromotionPinSaveInput {
  code: string
  rotation: PromotionPinRotation
}

interface PinPayload {
  code: string
  rotation: PromotionPinRotation
  nextRotationAt: string | null
  lastRotatedAt: string | null
  updatedAt: string
}

function fromPayload(data: PinPayload): PromotionPinSettings {
  return {
    code: data.code,
    rotation: data.rotation,
    nextRotationAt: data.nextRotationAt ? new Date(data.nextRotationAt) : null,
    lastRotatedAt: data.lastRotatedAt ? new Date(data.lastRotatedAt) : null,
    updatedAt: new Date(data.updatedAt),
  }
}

const pinPath = (companyId: string) => `/${encodeURIComponent(companyId)}/promotion-pin`

export async function getPromotionPinSettings(companyId: string): Promise<PromotionPinSettings> {
  if (isDemoCompanyId(companyId)) {
    return getDemoPinSettings()
  }
  return fromPayload(await callCompanyApi<PinPayload>(pinPath(companyId), 'GET', undefined, 'No se pudo cargar el PIN.'))
}

export async function savePromotionPinSettings(
  companyId: string,
  input: PromotionPinSaveInput,
  options?: { regenerate?: boolean },
): Promise<PromotionPinSettings> {
  rejectIfDemoCompanyWrite(companyId)
  return fromPayload(
    await callCompanyApi<PinPayload>(
      pinPath(companyId),
      'PUT',
      { code: input.code, rotation: input.rotation, regenerate: options?.regenerate === true },
      'No se pudo guardar el PIN.',
    ),
  )
}
