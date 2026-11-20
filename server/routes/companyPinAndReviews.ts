import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'
import {
  applyDuePromotionPinRotation,
  computeNextPromotionPinRotation,
  defaultPromotionPinSettings,
  generatePromotionPinCode,
  normalizePromotionPinCode,
  validatePromotionPinCode,
} from '../../src/utils/promotionPin.ts'
import { MAX_REVIEW_REPLY_LENGTH, MIN_REVIEW_REPLY_LENGTH } from '../../src/types/review.ts'
import type { PromotionPinRotation, PromotionPinSettings } from '../../src/types/company.ts'

// PIN de promociones y respuestas a reseñas desde el panel. El servidor comprueba
// que eres el dueño del local y guarda; el navegador ya no escribe en la base de datos.

const router = Router()
type Params = Record<string, string>

const ROTATIONS: PromotionPinRotation[] = ['daily', 'weekly', 'monthly', 'manual']
const toDate = (value: unknown): Date | null => (value as { toDate?: () => Date } | null | undefined)?.toDate?.() ?? null

function mapPin(data: Record<string, unknown> | undefined): PromotionPinSettings | null {
  if (!data || typeof data.code !== 'string') return null
  const rotation = data.rotation as PromotionPinRotation
  return {
    code: normalizePromotionPinCode(data.code),
    rotation: ROTATIONS.includes(rotation) ? rotation : 'manual',
    nextRotationAt: toDate(data.nextRotationAt),
    lastRotatedAt: toDate(data.lastRotatedAt),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  }
}

function serializePin(settings: PromotionPinSettings) {
  return {
    code: settings.code,
    rotation: settings.rotation,
    nextRotationAt: settings.nextRotationAt ? Timestamp.fromDate(settings.nextRotationAt) : null,
    lastRotatedAt: settings.lastRotatedAt ? Timestamp.fromDate(settings.lastRotatedAt) : null,
    updatedAt: FieldValue.serverTimestamp(),
  }
}

function pinResponse(settings: PromotionPinSettings) {
  return {
    code: settings.code,
    rotation: settings.rotation,
    nextRotationAt: settings.nextRotationAt?.toISOString() ?? null,
    lastRotatedAt: settings.lastRotatedAt?.toISOString() ?? null,
    updatedAt: settings.updatedAt.toISOString(),
  }
}

/** Lee el PIN (y lo rota si ya tocaba, o lo crea la primera vez). */
router.get('/:companyId/promotion-pin', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const companyRef = adminDb.collection('companies').doc(companyId)
    const privateRef = companyRef.collection('private').doc('promotionPin')
    const [privateSnap, companySnap] = await Promise.all([privateRef.get(), companyRef.get()])
    const stored = mapPin(privateSnap.data())
    const legacy = mapPin(companySnap.data()?.promotionPin as Record<string, unknown> | undefined)

    if (!stored && legacy) {
      const migrated = applyDuePromotionPinRotation(legacy).settings
      await privateRef.set(serializePin(migrated))
      await companyRef.update({ promotionPin: FieldValue.delete() })
      res.json(pinResponse(migrated))
      return
    }
    const { settings, rotated } = applyDuePromotionPinRotation(stored ?? defaultPromotionPinSettings())
    if (rotated || !stored) {
      await privateRef.set(serializePin(settings))
    }
    res.json(pinResponse(settings))
  } catch (error) {
    console.error('Company promotion PIN read error:', error)
    res.status(500).json({ error: 'No se pudo cargar el PIN.' })
  }
})

/** Guarda el PIN (o genera uno nuevo) y cada cuánto cambia. */
router.put('/:companyId/promotion-pin', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const { code, rotation, regenerate } = req.body as { code?: unknown; rotation?: unknown; regenerate?: unknown }
    if (typeof rotation !== 'string' || !ROTATIONS.includes(rotation as PromotionPinRotation)) {
      res.status(400).json({ error: 'Elige cada cuánto cambia el PIN.' })
      return
    }
    const nextCode = regenerate === true ? generatePromotionPinCode() : normalizePromotionPinCode(String(code ?? ''))
    const validationError = validatePromotionPinCode(nextCode)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }
    const now = new Date()
    const settings: PromotionPinSettings = {
      code: nextCode,
      rotation: rotation as PromotionPinRotation,
      nextRotationAt: rotation === 'manual' ? null : computeNextPromotionPinRotation(now, rotation as PromotionPinRotation),
      lastRotatedAt: now,
      updatedAt: now,
    }
    await adminDb.collection('companies').doc(companyId).collection('private').doc('promotionPin').set(serializePin(settings))
    res.json(pinResponse(settings))
  } catch (error) {
    console.error('Company promotion PIN save error:', error)
    res.status(500).json({ error: 'No se pudo guardar el PIN.' })
  }
})

/** Responder (o editar la respuesta) a una reseña. */
router.put('/:companyId/reviews/:reviewId/reply', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId, reviewId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(reviewId ?? '')) {
      res.status(400).json({ error: 'Reseña no válida.' })
      return
    }
    const { text, edit } = req.body as { text?: unknown; edit?: unknown }
    const trimmed = typeof text === 'string' ? text.trim() : ''
    if (trimmed.length < MIN_REVIEW_REPLY_LENGTH) {
      res.status(400).json({ error: `Escribe al menos ${MIN_REVIEW_REPLY_LENGTH} caracteres en tu respuesta.` })
      return
    }
    if (trimmed.length > MAX_REVIEW_REPLY_LENGTH) {
      res.status(400).json({ error: `La respuesta no puede superar ${MAX_REVIEW_REPLY_LENGTH} caracteres.` })
      return
    }
    const ref = adminDb.collection('companies').doc(companyId).collection('reviews').doc(reviewId)
    const snap = await ref.get()
    if (!snap.exists) {
      res.status(404).json({ error: 'No encontramos la reseña para responder.' })
      return
    }
    const current = snap.data()?.ownerReply as { text?: unknown; createdAt?: unknown } | undefined
    const hasReply = Boolean(current && typeof current.text === 'string' && current.text.trim())
    if (hasReply && edit !== true) {
      res.status(409).json({ error: 'Esta reseña ya tiene una respuesta. Puedes editarla, pero no añadir otra.' })
      return
    }
    const createdAt = hasReply ? (current?.createdAt ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp()
    await ref.update({
      ownerReply: { text: trimmed, createdAt, updatedAt: FieldValue.serverTimestamp() },
    })
    res.json({ ok: true, text: trimmed })
  } catch (error) {
    console.error('Company review reply error:', error)
    res.status(500).json({ error: 'No se pudo guardar la respuesta.' })
  }
})

export default router
