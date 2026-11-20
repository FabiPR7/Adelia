import { Router, type Request, type Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'
import { mapPromotion, serializePromotion } from '../../src/utils/promotionSerialize.ts'
import { buildPromotionProductRefs } from '../../src/utils/promotionOffer.ts'
import { validatePromotionInput } from '../../src/types/company.ts'
import type { MenuNode, PromotionInput } from '../../src/types/company.ts'

// Promociones del local desde el panel. El servidor comprueba que eres el dueño,
// valida con las MISMAS reglas que el panel y saca los productos de la carta del
// propio local (no se fía de lo que mande el navegador).

const router = Router()
type Params = Record<string, string>

const MAX_PROMOTIONS = 80
const idOk = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)
const promotions = (companyId: string) => adminDb.collection('companies').doc(companyId).collection('promotions')

async function loadMenuProducts(companyId: string): Promise<MenuNode[]> {
  const snap = await adminDb.collection('companies').doc(companyId).collection('menuNodes')
    .where('nodeType', '==', 'product').limit(2000).get()
  return snap.docs.map((item) => {
    const data = item.data()
    return {
      id: item.id,
      name: String(data.name ?? ''),
      photoUrl: String(data.photoUrl ?? ''),
    } as unknown as MenuNode
  })
}

function parseInput(body: unknown): PromotionInput | null {
  if (!body || typeof body !== 'object') return null
  const row = body as Partial<PromotionInput>
  if (row.type !== 'reservation_ladder' && row.type !== 'time_limited' && row.type !== 'attendance') return null
  const numOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
  return {
    type: row.type,
    title: typeof row.title === 'string' ? row.title.slice(0, 120) : '',
    description: typeof row.description === 'string' ? row.description.slice(0, 1500) : '',
    photoUrl: typeof row.photoUrl === 'string' ? row.photoUrl.slice(0, 600) : '',
    offer: (row.offer ?? { kind: 'custom', bundleGet: null, bundlePay: null, discountPercent: null, fixedPriceCents: null, customLabel: '' }) as PromotionInput['offer'],
    productIds: Array.isArray(row.productIds) ? row.productIds.filter(idOk).slice(0, 60) : [],
    active: row.active === true,
    requiresReservation: row.requiresReservation === true,
    requiredReservations: numOrNull(row.requiredReservations),
    minimumSpendEnabled: row.minimumSpendEnabled === true,
    minimumSpendCents: numOrNull(row.minimumSpendCents),
    activeFromTime: typeof row.activeFromTime === 'string' ? row.activeFromTime.slice(0, 5) : '',
    activeToTime: typeof row.activeToTime === 'string' ? row.activeToTime.slice(0, 5) : '',
    maxRedemptions: numOrNull(row.maxRedemptions),
    arrivalWindowMinutes: numOrNull(row.arrivalWindowMinutes),
    maxClaimsPerCustomer: numOrNull(row.maxClaimsPerCustomer),
    claimWindowEnabled: row.claimWindowEnabled === true,
  }
}

async function validate(companyId: string, input: PromotionInput, editingId: string | null): Promise<string | null> {
  const snap = await promotions(companyId).limit(MAX_PROMOTIONS + 1).get()
  if (!editingId && snap.size >= MAX_PROMOTIONS) return 'Has llegado al máximo de promociones.'
  const existing = snap.docs.map((item) => mapPromotion(item.id, companyId, item.data() as Record<string, unknown>))
  return validatePromotionInput(input, existing, editingId)
}

router.post('/:companyId/promotions', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const input = parseInput(req.body)
    if (!input) {
      res.status(400).json({ error: 'Promoción no válida.' })
      return
    }
    const error = await validate(companyId, input, null)
    if (error) {
      res.status(400).json({ error })
      return
    }
    const productRefs = buildPromotionProductRefs(input.productIds, await loadMenuProducts(companyId))
    const ref = await promotions(companyId).add({
      ...serializePromotion(companyId, input, productRefs),
      currentRedemptions: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.status(201).json({ id: ref.id })
  } catch (error) {
    console.error('Company promotion create error:', error)
    res.status(500).json({ error: 'No se pudo crear la promoción.' })
  }
})

router.put('/:companyId/promotions/:promotionId', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId, promotionId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const input = parseInput(req.body)
    if (!input || !idOk(promotionId)) {
      res.status(400).json({ error: 'Promoción no válida.' })
      return
    }
    const ref = promotions(companyId).doc(promotionId)
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'Promoción no encontrada.' })
      return
    }
    const error = await validate(companyId, input, promotionId)
    if (error) {
      res.status(400).json({ error })
      return
    }
    const productRefs = buildPromotionProductRefs(input.productIds, await loadMenuProducts(companyId))
    await ref.update({ ...serializePromotion(companyId, input, productRefs), updatedAt: FieldValue.serverTimestamp() })
    res.json({ ok: true })
  } catch (error) {
    console.error('Company promotion update error:', error)
    res.status(500).json({ error: 'No se pudo guardar la promoción.' })
  }
})

router.patch('/:companyId/promotions/:promotionId/active', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId, promotionId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const { active } = req.body as { active?: unknown }
    if (!idOk(promotionId) || typeof active !== 'boolean') {
      res.status(400).json({ error: 'Datos no válidos.' })
      return
    }
    await promotions(companyId).doc(promotionId).update({ active, updatedAt: FieldValue.serverTimestamp() })
    res.json({ ok: true })
  } catch (error) {
    console.error('Company promotion active error:', error)
    res.status(500).json({ error: 'No se pudo cambiar la promoción.' })
  }
})

router.delete('/:companyId/promotions/:promotionId', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId, promotionId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    if (!idOk(promotionId)) {
      res.status(400).json({ error: 'Promoción no válida.' })
      return
    }
    await promotions(companyId).doc(promotionId).delete()
    res.json({ ok: true })
  } catch (error) {
    console.error('Company promotion delete error:', error)
    res.status(500).json({ error: 'No se pudo borrar la promoción.' })
  }
})

export default router
