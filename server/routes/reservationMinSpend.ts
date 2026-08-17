import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { createRateLimit } from '../middleware/rateLimit.ts'
import { resolveCompanyPromotionPin } from '../utils/companyPromotionPin.ts'
import { normalizePromotionPinCode } from '../utils/promotionPin.ts'
import { recordTimeLimitedPromotionClaimForVerification } from '../utils/recordTimeLimitedClaim.ts'
import { readGamificationFromDocs, userGamificationRef, writeGamification } from '../data/userGamification.ts'
import { findPendingTokenSpend, settlePendingTokenSpend } from '../gamification/inventory.ts'

const router = Router()
const verifySpendRateLimit = createRateLimit(10, 60_000)

interface ProductSelectionInput {
  nodeId: string
  quantity: number
}

router.post(
  '/:reservationId/verify-minimum-spend',
  verifySpendRateLimit,
  async (req: Request, res: Response) => {
  try {
    const { uid: customerUid, email: customerEmail } = await verifyCustomerUid(req)

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

    if (reservation.minSpendVerification) {
      res.status(409).json({ error: 'El gasto mínimo ya fue verificado.' })
      return
    }

    const companyId = reservation.companyId as string
    const userRef = adminDb.collection('users').doc(customerUid)
    const statsRef = userGamificationRef(customerUid)
    const [userSnap, statsSnap] = await Promise.all([
      userRef.get(),
      statsRef.get(),
    ])
    const gamification = readGamificationFromDocs(statsSnap.data(), userSnap.data())
    const pendingToken = findPendingTokenSpend(gamification, companyId)
    const requiredCents = pendingToken && pendingToken.remainderCents > 0
      ? pendingToken.remainderCents
      : minimumSpendCents

    if (requiredCents <= 0) {
      res.status(409).json({ error: 'Esta reserva no requiere verificación de gasto mínimo.' })
      return
    }
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

    if (totalCents < requiredCents) {
      res.status(400).json({
        error: pendingToken
          ? `El consumo indicado no cubre los ${Math.round(requiredCents / 100)}€ que faltan tras la carta.`
          : 'El consumo indicado no alcanza el gasto mínimo requerido.',
      })
      return
    }

    const settledPreview = settlePendingTokenSpend(
      gamification,
      companyId,
      totalCents,
      minimumSpendCents,
    )
    const meetsMinimumSpend = settledPreview.reservationEligible
    const promotionVisitStatus = meetsMinimumSpend ? 'eligible' : 'pending'
    const verifiedAt = Timestamp.now()

    const minSpendVerification = {
      mode,
      totalCents,
      lineItems,
      verifiedAt,
      meetsMinimumSpend,
      cardCoverCents: pendingToken?.coverCents ?? 0,
      remainderCents: pendingToken?.remainderCents ?? 0,
    }

    await adminDb.runTransaction(async (transaction) => {
      const [freshUserSnap, freshStatsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const freshState = readGamificationFromDocs(freshStatsSnap.data(), freshUserSnap.data())
      const settled = settlePendingTokenSpend(
        freshState,
        companyId,
        totalCents,
        minimumSpendCents,
      )
      if (settled.settled) {
        writeGamification(transaction, customerUid, settled.state)
      }
      transaction.update(reservationRef, {
        minSpendVerification,
        promotionVisitStatus,
      })
    })

    await companyRef.collection('verifiedConsumptions').doc(reservationId).set({
      reservationId,
      companyId,
      customerUid,
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

    await adminDb.collection('productClaims').doc(`${customerUid}_${reservationId}`).set({
      customerUid,
      companyId,
      reservationId,
      clientName: typeof reservation.clientName === 'string' ? reservation.clientName : '',
      promotionId: typeof reservation.promotionId === 'string' ? reservation.promotionId : null,
      mode,
      totalCents,
      lineItems,
      verifiedAt,
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
    const unauthorized = error instanceof Error && error.message.includes('cliente')
    res.status(unauthorized ? 401 : 500).json({
      error: unauthorized ? error.message : 'No se pudo verificar el gasto mínimo.',
    })
  }
})

export default router
