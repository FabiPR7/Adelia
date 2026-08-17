import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { readGamificationFromDocs, userGamificationRef, writeGamification } from '../data/userGamification.ts'
import {
  appendClaimToState,
  ladderClaimDocId,
  readCurrentGamification,
  timeLimitedClaimDocId,
  writeClaimInTransaction,
} from '../data/promotionClaims.ts'
import { notifyPromotionClaimed } from '../notifications/reservationEvents.ts'
import {
  assertCustomerCanUsePromos,
  PROMO_LOCK_CLAIM_MESSAGE,
} from '../gamification/cancellationPenalty.ts'
import {
  applyInventoryGrants,
  claimSeasonPack,
  consumeInventoryItem,
  numberRecord,
  parsePendingTokenSpend,
  promoMinimumFromPromotionData,
  useInventoryConsumable,
} from '../gamification/inventory.ts'
import {
  getInventoryItem,
  isPromoSpendItem,
  spendCoverForItem,
  type SeasonPackKind,
} from '../gamification/inventoryItems.ts'
import { getLevelForXpFromCatalog } from '../data/gameCatalog.ts'

const router = Router()
const MAX_REWARD_DELTA = 500

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))]
    : []
}

function celebratedLevelValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.trunc(value)
}

function mergeCelebratedLevel(current: unknown, proposed: unknown): number | null {
  const currentLevel = celebratedLevelValue(current)
  const proposedLevel = celebratedLevelValue(proposed)

  if (currentLevel == null) {
    return proposedLevel
  }

  if (proposedLevel == null) {
    return currentLevel
  }

  return Math.max(currentLevel, proposedLevel)
}

function containsAll(next: string[], current: string[]): boolean {
  const set = new Set(next)
  return current.every((item) => set.has(item))
}

function validateMonotonicGamification(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
) {
  const currentXp = numberValue(current.xp)
  const currentAdelinas = numberValue(current.adelinas)
  const currentPenaltyTotal = numberValue(current.xpPenaltyTotal)
  const proposedPenaltyTotal = numberValue(proposed.xpPenaltyTotal)
  const penaltyGap = Math.max(0, currentPenaltyTotal - proposedPenaltyTotal)
  const proposedXp = numberValue(proposed.xp, currentXp)
  const xp = Math.max(currentXp, proposedXp - penaltyGap)
  const adelinas = currentAdelinas

  if (xp - currentXp > MAX_REWARD_DELTA) {
    throw new Error('La actualización de recompensas no es válida.')
  }

  const appendOnlyKeys = [
    'completedMissions',
    'visitedCompanyIds',
    'reviewedReservationIds',
    'reviewedCompanyIds',
    'awardedReservationXpIds',
  ]

  for (const key of appendOnlyKeys) {
    if (!containsAll(stringArray(proposed[key]), stringArray(current[key]))) {
      throw new Error('La actualización de progreso no es válida.')
    }
  }

  const currentClaims = Array.isArray(current.claimedPromotions) ? current.claimedPromotions : []
  const proposedClaims = Array.isArray(proposed.claimedPromotions) ? proposed.claimedPromotions : []
  if (proposedClaims.length !== currentClaims.length) {
    throw new Error('Los canjes solo pueden registrarse desde el flujo de validación.')
  }

  const strikeCount = numberValue(current.cancellationStrikeCount)
  const promoLocked = current.promoLocked === true || strikeCount >= 5

  return {
    ...current,
    ...proposed,
    xp,
    adelinas,
    claimedPromotions: currentClaims,
    redemptionsCount: numberValue(current.redemptionsCount),
    lastCelebratedLevel: mergeCelebratedLevel(current.lastCelebratedLevel, proposed.lastCelebratedLevel),
    celebratedMissionIds: [...new Set([
      ...stringArray(current.celebratedMissionIds),
      ...stringArray(proposed.celebratedMissionIds),
    ])],
    celebrationsBootstrapped:
      current.celebrationsBootstrapped === true || proposed.celebrationsBootstrapped === true,
    cancellationStrikeCount: strikeCount,
    cancelledReservationIds: stringArray(current.cancelledReservationIds),
    xpPenaltyTotal: currentPenaltyTotal,
    promoLocked,
    inventory: current.inventory && typeof current.inventory === 'object' ? current.inventory : {},
    grantedItemKeys: stringArray(current.grantedItemKeys),
    tokenCreditsByCompany:
      current.tokenCreditsByCompany && typeof current.tokenCreditsByCompany === 'object'
        ? current.tokenCreditsByCompany
        : {},
    pendingTokenSpend: Array.isArray(current.pendingTokenSpend) ? current.pendingTokenSpend : [],
  }
}

function levelForXp(xp: number): number {
  if (xp >= 10_000) return 7
  if (xp >= 6_000) return 6
  if (xp >= 3_200) return 5
  if (xp >= 1_600) return 4
  if (xp >= 800) return 3
  if (xp >= 300) return 2
  return 1
}

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const proposed = req.body?.gamification
    if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed)) {
      res.status(400).json({ error: 'Progreso no válido.' })
      return
    }

    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    await getLevelForXpFromCatalog(0).catch(() => 1)
    const next = await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const currentState = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      const validated = validateMonotonicGamification(
        currentState,
        proposed as Record<string, unknown>,
      )
      const withItems = await applyInventoryGrants(validated)
      writeGamification(transaction, customer.uid, withItems)
      return withItems
    })

    res.json({ gamification: next })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar el progreso.'
    const status = message.includes('cliente') ? 401 : message.includes('válid') ? 400 : 500
    res.status(status).json({ error: message })
  }
})

router.post('/acknowledge-level', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const requestedLevelRaw = Number(req.body?.level)
    const hasLevel = Number.isFinite(requestedLevelRaw) && requestedLevelRaw >= 1
    const missionIds = stringArray(req.body?.missionIds)
    const bootstrapped = req.body?.bootstrapped === true

    if (!hasLevel && missionIds.length === 0 && !bootstrapped) {
      res.status(400).json({ error: 'Celebración no válida.' })
      return
    }

    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    const result = await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const data = userSnap.data() ?? {}
      const gamification = readGamificationFromDocs(statsSnap.data(), data)
      const currentXp = numberValue(gamification.xp, numberValue(data.xp))
      const currentLevel = levelForXp(currentXp)
      const previous = celebratedLevelValue(gamification.lastCelebratedLevel) ?? 0
      const requestedLevel = hasLevel ? Math.trunc(requestedLevelRaw) : previous
      const nextLevel = Math.max(previous, Math.min(requestedLevel, currentLevel))
      const nextMissionIds = [...new Set([
        ...stringArray(gamification.celebratedMissionIds),
        ...missionIds,
      ])]
      const next = {
        ...gamification,
        lastCelebratedLevel: nextLevel > 0 ? nextLevel : (celebratedLevelValue(gamification.lastCelebratedLevel)),
        celebratedMissionIds: nextMissionIds,
        celebrationsBootstrapped:
          gamification.celebrationsBootstrapped === true
          || bootstrapped
          || nextMissionIds.length > 0
          || nextLevel >= currentLevel,
      }
      writeGamification(transaction, customer.uid, next)
      return {
        level: next.lastCelebratedLevel,
        missionIds: next.celebratedMissionIds,
        bootstrapped: next.celebrationsBootstrapped === true,
      }
    })

    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo confirmar la celebración.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

router.post('/claim-ladder', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const companyId = String(req.body?.companyId ?? '').trim()
    const promotionId = String(req.body?.promotionId ?? '').trim()
    if (!companyId || !promotionId) {
      res.status(400).json({ error: 'Canje no válido.' })
      return
    }

    const companyRef = adminDb.collection('companies').doc(companyId)
    const [companySnap, promotionSnap, ladderPromotionsSnap, reservationsSnap] = await Promise.all([
      companyRef.get(),
      companyRef.collection('promotions').doc(promotionId).get(),
      companyRef.collection('promotions')
        .where('active', '==', true)
        .get(),
      adminDb.collection('reservations').where('clientEmail', '==', customer.email).get(),
    ])
    const promotion = promotionSnap.data()
    if (
      !companySnap.exists
      || !promotionSnap.exists
      || promotion?.active !== true
      || promotion?.type !== 'reservation_ladder'
    ) {
      res.status(404).json({ error: 'Promoción no encontrada.' })
      return
    }

    const reservationCount = reservationsSnap.docs.filter((docSnap) => {
      const reservation = docSnap.data()
      return reservation.companyId === companyId && reservation.status === 'confirmed'
    }).length
    const required = Math.max(1, Math.trunc(numberValue(promotion.requiredReservations, 1)))

    const company = companySnap.data()!
    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    let claimId = ''
    let claimTitle = String(promotion.title ?? 'tu premio')
    await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      assertCustomerCanUsePromos(current)
      const tokenCredits = numberRecord(current.tokenCreditsByCompany)[companyId] ?? 0
      const confirmedCount = reservationCount + tokenCredits
      const claims = Array.isArray(current.claimedPromotions) ? current.claimedPromotions : []
      const priorClaims = claims.filter((item) => (
        item && typeof item === 'object'
        && (item as Record<string, unknown>).promotionId === promotionId
      )).length
      if (confirmedCount < required * (priorClaims + 1)) {
        throw new Error('Aún no has completado las reservas necesarias.')
      }
      const ladderIds = ladderPromotionsSnap.docs
        .filter((docSnap) => docSnap.data().type === 'reservation_ladder')
        .sort((left, right) => (
          numberValue(left.data().requiredReservations)
          - numberValue(right.data().requiredReservations)
        ))
        .map((docSnap) => docSnap.id)
      const promotionIndex = ladderIds.indexOf(promotionId)
      const nextPromotionId = ladderIds.length > 0
        ? ladderIds[(promotionIndex + 1) % ladderIds.length]
        : promotionId
      const baselines = current.ladderBaselinesByCompany
        && typeof current.ladderBaselinesByCompany === 'object'
        ? current.ladderBaselinesByCompany as Record<string, number>
        : {}
      const activePromotions = current.activeLadderPromotionByCompany
        && typeof current.activeLadderPromotionByCompany === 'object'
        ? current.activeLadderPromotionByCompany as Record<string, string>
        : {}
      const completions = current.ladderCompletionsByCompany
        && typeof current.ladderCompletionsByCompany === 'object'
        ? current.ladderCompletionsByCompany as Record<string, number>
        : {}

      const claim = {
        promotionId,
        companyId,
        companyName: String(company.name ?? 'Restaurante'),
        companySlug: String(company.slug ?? ''),
        title: String(promotion.title ?? ''),
        prizeLabel: String(promotion.offerHighlight ?? promotion.title ?? 'Promoción'),
        claimedAt: new Date().toISOString(),
        description: String(promotion.description ?? ''),
        photoUrl: String(promotion.photoUrl ?? ''),
        companyPhotoUrl: String(company.logoUrl ?? ''),
        promotionType: 'reservation_ladder',
      }
      claimTitle = claim.title || claimTitle
      claimId = ladderClaimDocId(customer.uid, promotionId, priorClaims + 1)
      const wrote = await writeClaimInTransaction(
        transaction,
        customer.uid,
        claimId,
        claim,
        {
          ...current,
          claimedPromotions: [...claims, claim],
          redemptionsCount: numberValue(current.redemptionsCount) + 1,
          ladderBaselinesByCompany: {
            ...baselines,
            [companyId]: confirmedCount,
          },
          activeLadderPromotionByCompany: {
            ...activePromotions,
            [companyId]: nextPromotionId,
          },
          ladderCompletionsByCompany: {
            ...completions,
            [companyId]: ladderIds.length > 0
              ? Math.floor((priorClaims + 1) / ladderIds.length)
              : 0,
          },
        },
      )
      if (!wrote) {
        throw new Error('Este premio ya fue canjeado para tus visitas actuales.')
      }
    })

    if (claimId) {
      await notifyPromotionClaimed(
        customer.uid,
        promotionId,
        companyId,
        claimTitle,
        undefined,
        claimId,
      ).catch(() => undefined)
    }

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar el canje.'
    const status = message.includes('cliente')
      ? 401
      : message === PROMO_LOCK_CLAIM_MESSAGE
        ? 403
        : message.includes('ya fue')
          ? 409
          : 500
    res.status(status).json({ error: message })
  }
})

router.post('/claim', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const reservationId = String(req.body?.reservationId ?? '').trim()
    const companyId = String(req.body?.companyId ?? '').trim()
    const promotionId = String(req.body?.promotionId ?? '').trim()
    if (!reservationId || !companyId || !promotionId) {
      res.status(400).json({ error: 'Canje no válido.' })
      return
    }

    const reservationRef = adminDb.collection('reservations').doc(reservationId)
    const companyRef = adminDb.collection('companies').doc(companyId)
    const promotionRef = companyRef.collection('promotions').doc(promotionId)
    const [reservationSnap, companySnap, promotionSnap] = await Promise.all([
      reservationRef.get(),
      companyRef.get(),
      promotionRef.get(),
    ])
    const reservation = reservationSnap.data()
    if (
      !reservationSnap.exists
      || reservation?.companyId !== companyId
      || String(reservation?.clientEmail ?? '').trim().toLowerCase() !== customer.email
      || reservation?.status !== 'confirmed'
    ) {
      res.status(403).json({ error: 'La reserva no permite este canje.' })
      return
    }
    if (
      !companySnap.exists
      || !promotionSnap.exists
      || promotionSnap.data()?.active !== true
      || promotionSnap.data()?.type !== 'time_limited'
      || reservation.promotionId !== promotionId
    ) {
      res.status(404).json({ error: 'Promoción no encontrada.' })
      return
    }
    if (
      promotionSnap.data()?.minimumSpendEnabled === true
      && reservation.minSpendVerification?.meetsMinimumSpend !== true
    ) {
      res.status(409).json({ error: 'Primero debes verificar el gasto mínimo.' })
      return
    }

    const company = companySnap.data()!
    const promotion = promotionSnap.data()!
    const claim = {
      promotionId,
      companyId,
      companyName: String(company.name ?? 'Restaurante'),
      companySlug: String(company.slug ?? ''),
      title: String(promotion.title ?? ''),
      prizeLabel: String(promotion.offerHighlight ?? promotion.title ?? 'Promoción'),
      claimedAt: new Date().toISOString(),
      description: String(promotion.description ?? ''),
      detail: '',
      photoUrl: String(promotion.photoUrl ?? ''),
      companyPhotoUrl: String(company.logoUrl ?? ''),
      promotionType: promotion.type,
      reservationId,
    }

    const claimId = timeLimitedClaimDocId(customer.uid, reservationId, promotionId)
    await adminDb.runTransaction(async (transaction) => {
      const current = await readCurrentGamification(transaction, customer.uid)
      assertCustomerCanUsePromos(current)
      await writeClaimInTransaction(
        transaction,
        customer.uid,
        claimId,
        claim,
        appendClaimToState(current, claim),
      )
    })

    await notifyPromotionClaimed(
      customer.uid,
      promotionId,
      companyId,
      String(promotion.title ?? 'tu premio'),
      reservationId,
      claimId,
    ).catch(() => undefined)

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar el canje.'
    const status = message.includes('cliente')
      ? 401
      : message === PROMO_LOCK_CLAIM_MESSAGE
        ? 403
        : 500
    res.status(status).json({ error: message })
  }
})

router.post('/inventory/apply-token', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const itemId = String(req.body?.itemId ?? '').trim()
    const companyId = String(req.body?.companyId ?? '').trim()
    const item = getInventoryItem(itemId)
    if (!companyId || !item || !isPromoSpendItem(item)) {
      res.status(400).json({ error: 'Carta no válida.' })
      return
    }

    const companyRef = adminDb.collection('companies').doc(companyId)
    const [companySnap, promotionsSnap] = await Promise.all([
      companyRef.get(),
      companyRef.collection('promotions').where('active', '==', true).get(),
    ])
    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const ladderDocs = promotionsSnap.docs
      .filter((docSnap) => docSnap.data().type === 'reservation_ladder')
      .sort((left, right) => (
        numberValue(left.data().requiredReservations) - numberValue(right.data().requiredReservations)
      ))
    if (ladderDocs.length === 0) {
      res.status(409).json({ error: 'Este restaurante no tiene promo de reservas para usar la carta.' })
      return
    }

    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    const applied = await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      assertCustomerCanUsePromos(current)

      const activePromos = current.activeLadderPromotionByCompany
        && typeof current.activeLadderPromotionByCompany === 'object'
        ? current.activeLadderPromotionByCompany as Record<string, string>
        : {}
      const activeId = activePromos[companyId]
      const activeDoc = ladderDocs.find((docSnap) => docSnap.id === activeId) ?? ladderDocs[0]
      const requiredCents = promoMinimumFromPromotionData(activeDoc.data() as Record<string, unknown>)
      const cover = spendCoverForItem(item, requiredCents)
      if (
        requiredCents > 0
        && item.kind === 'reservation_token'
        && !item.coversMinSpend
        && (item.spendBand ?? 0) <= 0
      ) {
        throw new Error('Las cartas sin gasto mínimo solo valen en promos sin mínimo. Usa una de 15€ o 40€.')
      }

      const consumed = consumeInventoryItem(current, itemId, 1)
      const visits = Math.max(1, Math.trunc(item.visitValue ?? 1))
      let next = consumed
      if (cover.coversFully) {
        const credits = numberRecord(consumed.tokenCreditsByCompany)
        credits[companyId] = (credits[companyId] ?? 0) + visits
        next = {
          ...consumed,
          tokenCreditsByCompany: credits,
        }
      } else {
        const pending = parsePendingTokenSpend(consumed.pendingTokenSpend)
        pending.push({
          id: `tok-${companyId.slice(0, 8)}-${Date.now().toString(36)}`,
          companyId,
          itemId,
          visits,
          coverCents: cover.coverCents,
          remainderCents: cover.remainderCents,
          requiredCents,
          createdAt: new Date().toISOString(),
        })
        next = {
          ...consumed,
          pendingTokenSpend: pending.slice(-20),
        }
      }

      writeGamification(transaction, customer.uid, next)
      return {
        visits,
        coverCents: cover.coverCents,
        remainderCents: cover.remainderCents,
        requiredCents,
        inventory: numberRecord(next.inventory),
        tokenCreditsByCompany: numberRecord(next.tokenCreditsByCompany),
        pendingTokenSpend: parsePendingTokenSpend(next.pendingTokenSpend),
      }
    })

    res.json(applied)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo usar la carta.'
    const status = message.includes('cliente')
      ? 401
      : message === PROMO_LOCK_CLAIM_MESSAGE
        || message.includes('gasto mínimo')
        || message.includes('sin mínimo')
        || message.includes('quedan cartas')
        ? 403
        : 500
    res.status(status).json({ error: message })
  }
})

router.post('/inventory/use', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const itemId = String(req.body?.itemId ?? '').trim()
    if (!itemId) {
      res.status(400).json({ error: 'Ítem no válido.' })
      return
    }

    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    const used = await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      const result = useInventoryConsumable(current, itemId)
      writeGamification(transaction, customer.uid, result.state)
      return {
        xpGained: result.xpGained,
        message: result.message,
        inventory: numberRecord(result.state.inventory),
        xp: typeof result.state.xp === 'number' ? result.state.xp : 0,
        cancellationStrikeCount: typeof result.state.cancellationStrikeCount === 'number'
          ? result.state.cancellationStrikeCount
          : 0,
        promoLocked: result.state.promoLocked === true,
      }
    })

    res.json(used)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo usar el ítem.'
    const status = message.includes('cliente')
      ? 401
      : message.includes('quedan cartas')
        || message.includes('no se puede')
        || message.includes('no válido')
        || message.includes('bloqueadas')
        || message.includes('otro sitio')
        ? 403
        : 500
    res.status(status).json({ error: message })
  }
})

router.post('/inventory/claim-pack', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const pack = String(req.body?.pack ?? '').trim() as SeasonPackKind
    if (pack !== 'weekly_bonus' && pack !== 'weekly_clear' && pack !== 'monthly_clear') {
      res.status(400).json({ error: 'Pack no válido.' })
      return
    }

    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    const claimed = await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      const result = claimSeasonPack(current, pack)
      writeGamification(transaction, customer.uid, result.state)
      return {
        grants: result.grants,
        inventory: numberRecord(result.state.inventory),
        grantedItemKeys: Array.isArray(result.state.grantedItemKeys)
          ? result.state.grantedItemKeys
          : [],
      }
    })

    res.json(claimed)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo reclamar el pack.'
    const status = message.includes('cliente')
      ? 401
      : message.includes('Completa')
        || message.includes('Ya has reclamado')
        || message.includes('periodo')
        ? 403
        : 500
    res.status(status).json({ error: message })
  }
})

export default router
