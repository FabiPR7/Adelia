import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { getUserRoleWithRest, verifyIdTokenWithRest } from '../rest-firebase.ts'
import {
  applyDuePromotionPinRotation,
  defaultPromotionPinSettings,
  mapPromotionPin,
  normalizePromotionPinCode,
  type PromotionPinSettings,
} from '../utils/promotionPin.ts'
import { recordTimeLimitedPromotionClaimForVerification } from '../utils/recordTimeLimitedClaim.ts'

const router = Router()

interface ProductSelectionInput {
  nodeId: string
  quantity: number
}

function serializePromotionPin(settings: PromotionPinSettings) {
  return {
    code: settings.code,
    rotation: settings.rotation,
    nextRotationAt: settings.nextRotationAt ? Timestamp.fromDate(settings.nextRotationAt) : null,
    lastRotatedAt: settings.lastRotatedAt ? Timestamp.fromDate(settings.lastRotatedAt) : null,
    updatedAt: Timestamp.now(),
  }
}

async function resolveCompanyPromotionPin(
  companyRef: FirebaseFirestore.DocumentReference,
  companyData: FirebaseFirestore.DocumentData,
): Promise<string> {
  const stored = mapPromotionPin(companyData.promotionPin as Record<string, unknown> | undefined)
  const base = stored ?? defaultPromotionPinSettings()
  const { settings, rotated } = applyDuePromotionPinRotation(base)

  if (rotated) {
    await companyRef.update({
      promotionPin: serializePromotionPin(settings),
    })
  }

  return settings.code
}

async function verifyCustomerSession(req: Request): Promise<{ uid: string; email: string } | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return null
  }

  const token = header.slice(7)

  if (canUseAdminSdk) {
    const decoded = await adminAuth.verifyIdToken(token)
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()

    if (!userSnap.exists || userSnap.data()?.role !== 'customer') {
      return null
    }

    const email = typeof userSnap.data()?.email === 'string' ? userSnap.data()?.email.trim() : ''
    if (!email) {
      return null
    }

    return { uid: decoded.uid, email }
  }

  const decoded = await verifyIdTokenWithRest(token)
  const role = await getUserRoleWithRest(token, decoded.uid)

  if (role !== 'customer') {
    return null
  }

  const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
  const email = typeof userSnap.data()?.email === 'string' ? userSnap.data()?.email.trim() : ''
  if (!email) {
    return null
  }

  return { uid: decoded.uid, email }
}

router.post('/:reservationId/verify-minimum-spend', async (req: Request, res: Response) => {
  try {
    const customerSession = await verifyCustomerSession(req)
    if (!customerSession) {
      res.status(401).json({ error: 'Debes iniciar sesión como cliente.' })
      return
    }

    const { uid: customerUid, email: customerEmail } = customerSession

    const reservationId = String(req.params.reservationId ?? '').trim()
    if (!reservationId) {
      res.status(400).json({ error: 'Reserva no válida.' })
      return
    }

    const {
      pin,
      mode,
      declaredTotalCents,
      productSelections,
    } = req.body as {
      pin?: string
      mode?: string
      declaredTotalCents?: number
      productSelections?: ProductSelectionInput[]
    }

    const normalizedPin = normalizePromotionPinCode(String(pin ?? ''))
    if (normalizedPin.length !== 4) {
      res.status(400).json({ error: 'El código PIN debe tener 4 dígitos.' })
      return
    }

    if (mode !== 'total' && mode !== 'products') {
      res.status(400).json({ error: 'Modo de verificación no válido.' })
      return
    }

    const reservationRef = adminDb.collection('reservations').doc(reservationId)
    const reservationSnap = await reservationRef.get()

    if (!reservationSnap.exists) {
      res.status(404).json({ error: 'Reserva no encontrada.' })
      return
    }

    const reservation = reservationSnap.data()!
    const reservationEmail = typeof reservation.clientEmail === 'string'
      ? reservation.clientEmail.trim().toLowerCase()
      : ''

    if (reservationEmail !== customerEmail.toLowerCase()) {
      res.status(403).json({ error: 'Esta reserva no pertenece a tu cuenta.' })
      return
    }

    if (reservation.status !== 'confirmed') {
      res.status(409).json({ error: 'La asistencia aún no está confirmada por el restaurante.' })
      return
    }

    const minimumSpendCents = typeof reservation.minimumSpendCents === 'number'
      ? reservation.minimumSpendCents
      : 0

    if (minimumSpendCents <= 0) {
      res.status(409).json({ error: 'Esta reserva no requiere verificación de gasto mínimo.' })
      return
    }

    if (reservation.minSpendVerification) {
      res.status(409).json({ error: 'El gasto mínimo ya fue verificado.' })
      return
    }

    const companyId = reservation.companyId as string
    const companyRef = adminDb.collection('companies').doc(companyId)
    const companySnap = await companyRef.get()

    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const currentPin = await resolveCompanyPromotionPin(companyRef, companySnap.data()!)
    if (currentPin !== normalizedPin) {
      res.status(403).json({ error: 'Código PIN incorrecto. Pídeselo de nuevo al empleado.' })
      return
    }

    let totalCents = 0
    const lineItems: Array<{
      nodeId: string
      name: string
      quantity: number
      unitPriceCents: number
      lineTotalCents: number
    }> = []

    if (mode === 'total') {
      const total = Number(declaredTotalCents)
      if (!Number.isFinite(total) || total < 0) {
        res.status(400).json({ error: 'Indica un importe total válido.' })
        return
      }

      totalCents = Math.round(total)
    } else {
      const selections = Array.isArray(productSelections) ? productSelections : []
      if (selections.length === 0) {
        res.status(400).json({ error: 'Selecciona al menos un producto.' })
        return
      }

      const nodesSnapshot = await companyRef.collection('menuNodes')
        .where('active', '==', true)
        .get()

      const productMap = new Map<string, FirebaseFirestore.DocumentData>()
      nodesSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data()
        if (data.nodeType === 'product') {
          productMap.set(docSnap.id, data)
        }
      })

      for (const selection of selections) {
        const nodeId = typeof selection.nodeId === 'string' ? selection.nodeId.trim() : ''
        const quantity = Math.trunc(Number(selection.quantity))

        if (!nodeId || quantity < 1) {
          continue
        }

        const product = productMap.get(nodeId)
        if (!product) {
          res.status(400).json({ error: 'Algún producto seleccionado ya no está disponible.' })
          return
        }

        const unitPriceCents = typeof product.priceCents === 'number' ? product.priceCents : null
        if (unitPriceCents == null || unitPriceCents < 0) {
          res.status(400).json({ error: `El producto «${product.name ?? nodeId}» no tiene precio.` })
          return
        }

        const lineTotalCents = unitPriceCents * quantity
        totalCents += lineTotalCents
        lineItems.push({
          nodeId,
          name: (product.name as string) ?? 'Producto',
          quantity,
          unitPriceCents,
          lineTotalCents,
        })
      }

      if (lineItems.length === 0) {
        res.status(400).json({ error: 'Selecciona al menos un producto válido.' })
        return
      }
    }

    if (totalCents < minimumSpendCents) {
      res.status(400).json({ error: 'El consumo indicado no alcanza el gasto mínimo requerido.' })
      return
    }

    const meetsMinimumSpend = true
    const promotionVisitStatus = 'eligible'
    const verifiedAt = Timestamp.now()

    const minSpendVerification = {
      mode,
      totalCents,
      lineItems,
      verifiedAt,
      meetsMinimumSpend,
    }

    await reservationRef.update({
      minSpendVerification,
      promotionVisitStatus,
    })

    await companyRef.collection('verifiedConsumptions').doc(reservationId).set({
      reservationId,
      companyId,
      clientName: typeof reservation.clientName === 'string' ? reservation.clientName : '',
      clientEmail: reservationEmail,
      pax: typeof reservation.pax === 'number' ? reservation.pax : 0,
      reservationStartTime: reservation.startTime ?? verifiedAt,
      promotionId: typeof reservation.promotionId === 'string' ? reservation.promotionId : null,
      minimumSpendCents,
      mode,
      totalCents,
      lineItems,
      verifiedAt,
      meetsMinimumSpend,
    })

    const promotionId = typeof reservation.promotionId === 'string' ? reservation.promotionId.trim() : ''
    if (promotionId) {
      try {
        await recordTimeLimitedPromotionClaimForVerification(
          customerUid,
          reservationId,
          companyId,
          promotionId,
        )
      } catch (claimError) {
        console.error('Record time-limited promotion claim error:', claimError)
      }
    }

    res.json({
      meetsMinimumSpend,
      promotionVisitStatus,
      totalCents,
      minimumSpendCents,
      minSpendVerification: {
        ...minSpendVerification,
        verifiedAt: verifiedAt.toDate().toISOString(),
      },
    })
  } catch (error) {
    console.error('Verify minimum spend error:', error)
    res.status(500).json({ error: 'No se pudo verificar el gasto mínimo.' })
  }
})

export default router
