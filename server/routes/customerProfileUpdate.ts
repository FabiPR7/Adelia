import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'

/**
 * Cambios del propio perfil del cliente (nombre visible lo lleva /identity). La web y la
 * app ya no escriben en users/{uid}: mandan aquí lo que quieren cambiar y el servidor
 * valida cada campo antes de guardarlo.
 */
const router = Router()

class ProfileInputError extends Error {}

const SAFE_PHOTO = [/^https:\/\/res\.cloudinary\.com\//, /^https:\/\/[a-z0-9.-]*googleusercontent\.com\//]

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new ProfileInputError(`${field} no es válido.`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new ProfileInputError(`${field} es demasiado largo.`)
  return trimmed
}

function coordinate(value: unknown, field: string, limit: number): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    throw new ProfileInputError(`${field} no es válida.`)
  }
  return value
}

function stringList(value: unknown, field: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new ProfileInputError(`${field} no es válido.`)
  return [...new Set(value.map((item) => text(item, field, maxLength)).filter(Boolean))]
}

/** Valida solo los campos que llegan; los demás no se tocan. */
export function buildProfileUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  if (body.phone !== undefined) {
    const phone = text(body.phone, 'El teléfono', 30)
    if (phone && !/^\+?[\d\s().-]{7,30}$/.test(phone)) throw new ProfileInputError('El teléfono no es válido.')
    update.phone = phone
  }
  if (body.photoUrl !== undefined) {
    const url = text(body.photoUrl, 'La foto', 500)
    if (url && !SAFE_PHOTO.some((re) => re.test(url))) throw new ProfileInputError('La foto no es válida.')
    update.photoUrl = url
  }
  for (const key of ['homeCity', 'homeMunicipality', 'homeCountry'] as const) {
    if (body[key] !== undefined) update[key] = text(body[key], 'La ciudad', 80)
  }
  if (body.homePostalCode !== undefined) update.homePostalCode = text(body.homePostalCode, 'El código postal', 12)
  if (body.homeLatitude !== undefined) update.homeLatitude = coordinate(body.homeLatitude, 'La ubicación', 90)
  if (body.homeLongitude !== undefined) update.homeLongitude = coordinate(body.homeLongitude, 'La ubicación', 180)
  if (body.foodPreferences !== undefined) update.foodPreferences = stringList(body.foodPreferences, 'Tus gustos', 40, 60)
  if (body.savedPromotionIds !== undefined) {
    const ids = stringList(body.savedPromotionIds, 'Las promos guardadas', 200, 128)
    if (ids.some((id) => !/^[A-Za-z0-9_-]+$/.test(id))) throw new ProfileInputError('Las promos guardadas no son válidas.')
    update.savedPromotionIds = ids
  }
  if (body.onboardingCompleted !== undefined) {
    if (body.onboardingCompleted !== true) throw new ProfileInputError('Valor no válido.')
    update.onboardingCompleted = true
  }
  if (body.productTourCompleted !== undefined) {
    if (body.productTourCompleted !== true) throw new ProfileInputError('Valor no válido.')
    update.productTourCompleted = true
  }
  return update
}

router.post('/profile', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
    const update = buildProfileUpdate(body)
    if (Object.keys(update).length === 0) {
      res.status(400).json({ error: 'No hay nada que guardar.' })
      return
    }
    await adminDb.collection('users').doc(customer.uid).set(update, { merge: true })
    res.json({ ok: true, ...update })
  } catch (error) {
    if (error instanceof ProfileInputError) {
      res.status(400).json({ error: error.message })
      return
    }
    const message = error instanceof Error ? error.message : ''
    const unauthorized = /autorizado|cliente|Perfil no encontrado|sesión/.test(message)
    if (!unauthorized) console.error('Customer profile update error:', error)
    res.status(unauthorized ? 401 : 500).json({ error: unauthorized ? message : 'No se pudo guardar tu perfil.' })
  }
})

export default router
