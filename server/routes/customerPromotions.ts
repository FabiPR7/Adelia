import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { readGamificationFromDocs, userGamificationRef } from '../data/userGamification.ts'
import { isPromoLockedFromState } from '../gamification/cancellationPenalty.ts'
import { loadActivePromotionPayloads } from './publicPromotions.ts'
import {
  countCustomerPromotionUses,
  getPromotionAvailability,
  type PromotionAvailability,
} from '../promotions/promotionAvailability.ts'
import { buildLadderState, reservationCountsForLadder, type LadderState } from '../promotions/ladderProgress.ts'
import { numberRecord } from '../gamification/inventory.ts'
import { claimWindowError, countClaimsForPromotion, customerLimitMessage, isPromotionSoldOut } from '../promotions/customerPromotionRules.ts'

/** Estado de un premio del mapa de fidelidad para reclamarlo ahora. */
interface LadderClaimStatus {
  soldOut: boolean
  limitReached: boolean
  windowClosed: boolean
  /** Por qué no se puede reclamar ahora (null si se puede). */
  message: string | null
}

const router = Router()

interface ReservationLite {
  id: string
  promotionId?: unknown
  status?: unknown
  start: Date | null
}

function toDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

async function loadPromotionReservations(customer: { uid: string; email: string; emailVerified: boolean }) {
  const reservations = adminDb.collection('reservations')
  const fields = ['promotionId', 'status', 'startTime'] as const
  const [byUid, byEmail] = await Promise.all([
    reservations.where('customerUid', '==', customer.uid).select(...fields).limit(2000).get(),
    customer.emailVerified && customer.email
      ? reservations.where('clientEmail', '==', customer.email).select(...fields).limit(2000).get()
      : Promise.resolve(null),
  ])
  const seen = new Set<string>()
  const list: ReservationLite[] = []
  for (const doc of [...byUid.docs, ...(byEmail?.docs ?? [])]) {
    if (seen.has(doc.id)) continue
    seen.add(doc.id)
    const promotionId = doc.get('promotionId')
    if (typeof promotionId !== 'string' || !promotionId) continue
    list.push({ id: doc.id, promotionId, status: doc.get('status'), start: toDate(doc.get('startTime')) })
  }
  return list
}

/**
 * Estado de cada promo activa para este cliente: bloqueos, plazas, límite por cliente,
 * franja horaria (hora de España) y avisos. La web y la app solo lo pintan.
 */
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const [promotions, reservations, userSnap, statsSnap] = await Promise.all([
      loadActivePromotionPayloads(),
      loadPromotionReservations(customer),
      adminDb.collection('users').doc(customer.uid).get(),
      userGamificationRef(customer.uid).get(),
    ])
    const state = readGamificationFromDocs(statsSnap.data(), userSnap.data())
    const claims = Array.isArray(state.claimedPromotions)
      ? (state.claimedPromotions as Array<{ promotionId?: unknown; reservationId?: unknown }>)
      : []
    const promoLocked = isPromoLockedFromState(state)
    const now = new Date()

    const availability: Record<string, PromotionAvailability> = {}
    const ladder: Record<string, LadderClaimStatus> = {}
    for (const promotion of promotions) {
      // Los premios del mapa de fidelidad: agotado, límite por cliente y franja para reclamar.
      if (promotion.type === 'reservation_ladder' && (promotion.requiredReservations ?? 0) > 0) {
        const limit = promotion.maxClaimsPerCustomer
        const soldOut = isPromotionSoldOut(promotion)
        const limitReached = limit != null && countClaimsForPromotion(claims, promotion.id) >= limit
        const windowMessage = claimWindowError(promotion, now)
        ladder[promotion.id] = {
          soldOut,
          limitReached,
          windowClosed: windowMessage != null,
          message: soldOut
            ? 'Esta promoción ya no tiene plazas.'
            : limitReached && limit != null
              ? customerLimitMessage(limit)
              : windowMessage,
        }
        continue
      }
      const upcoming = reservations
        .filter((item) => item.promotionId === promotion.id && item.status !== 'cancelled' && item.start && item.start >= now)
        .sort((left, right) => (left.start as Date).getTime() - (right.start as Date).getTime())[0]
      availability[promotion.id] = getPromotionAvailability(promotion, {
        now,
        promoLocked,
        customerUses: countCustomerPromotionUses(promotion.id, claims, reservations),
        upcomingReservationStart: upcoming?.start ?? null,
      })
    }

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({ availability, ladder, promoLocked })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/sesión|autoriz|Perfil no encontrado|cliente/i.test(message)) {
      res.status(401).json({ error: message || 'Debes iniciar sesión.' })
      return
    }
    console.error('Customer promotion availability error:', error)
    res.status(500).json({ error: 'No se pudo cargar el estado de las promociones.' })
  }
})

/**
 * Tus mapas de premios: en qué escalón vas, cuántas visitas llevas, cuál puedes
 * reclamar y si hay reservas a la espera de confirmar. Mismas reglas que el canje.
 * Con ?companyId= solo ese local.
 */
router.get('/ladders', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const onlyCompany = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : ''
    const reservationsBase = adminDb.collection('reservations')
    const [promotions, reservationsSnap, userSnap, statsSnap] = await Promise.all([
      loadActivePromotionPayloads(),
      (customer.emailVerified && customer.email
        ? reservationsBase.where('clientEmail', '==', customer.email)
        : reservationsBase.where('customerUid', '==', customer.uid))
        .select('companyId', 'status', 'minimumSpendCents', 'promotionVisitStatus')
        .limit(2000)
        .get(),
      adminDb.collection('users').doc(customer.uid).get(),
      userGamificationRef(customer.uid).get(),
    ])
    const state = readGamificationFromDocs(statsSnap.data(), userSnap.data())
    const tokenCredits = numberRecord(state.tokenCreditsByCompany)
    const baselines = numberRecord(state.ladderBaselinesByCompany)
    const completions = numberRecord(state.ladderCompletionsByCompany)
    const active = state.activeLadderPromotionByCompany && typeof state.activeLadderPromotionByCompany === 'object'
      ? state.activeLadderPromotionByCompany as Record<string, unknown>
      : {}

    const confirmedByCompany = new Map<string, number>()
    const pendingByCompany = new Map<string, number>()
    for (const doc of reservationsSnap.docs) {
      const data = doc.data()
      const companyId = typeof data.companyId === 'string' ? data.companyId : ''
      if (!companyId) continue
      if (reservationCountsForLadder(data)) confirmedByCompany.set(companyId, (confirmedByCompany.get(companyId) ?? 0) + 1)
      if (data.status === 'completed') pendingByCompany.set(companyId, (pendingByCompany.get(companyId) ?? 0) + 1)
    }

    const stepsByCompany = new Map<string, Array<{ id: string; requiredReservations: number | null }>>()
    for (const promotion of promotions) {
      if (promotion.type !== 'reservation_ladder' || (promotion.requiredReservations ?? 0) <= 0) continue
      if (onlyCompany && promotion.companyId !== onlyCompany) continue
      const list = stepsByCompany.get(promotion.companyId) ?? []
      list.push({ id: promotion.id, requiredReservations: promotion.requiredReservations })
      stepsByCompany.set(promotion.companyId, list)
    }

    const ladders: Record<string, LadderState> = {}
    for (const [companyId, steps] of stepsByCompany) {
      ladders[companyId] = buildLadderState({
        companyId,
        steps,
        activePromotionId: typeof active[companyId] === 'string' ? active[companyId] as string : null,
        confirmedCount: (confirmedByCompany.get(companyId) ?? 0) + (tokenCredits[companyId] ?? 0),
        baseline: baselines[companyId] ?? 0,
        pendingCount: pendingByCompany.get(companyId) ?? 0,
        completions: completions[companyId] ?? 0,
      })
    }

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({ ladders })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/sesión|autoriz|Perfil no encontrado|cliente/i.test(message)) {
      res.status(401).json({ error: message || 'Debes iniciar sesión.' })
      return
    }
    console.error('Customer ladders error:', error)
    res.status(500).json({ error: 'No se pudieron cargar tus mapas de premios.' })
  }
})

export default router
