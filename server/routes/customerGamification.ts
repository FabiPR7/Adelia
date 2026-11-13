import { PIN_ATTEMPTS_MESSAGE, takePromotionPinAttempt } from '../security/rateLimit.ts'
import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { readGamificationFromDocs, userGamificationRef, writeGamification } from '../data/userGamification.ts'
import { computeCustomerXpCeiling } from '../gamification/customerXpCeiling.ts'
import {
  appendClaimToState,
  ladderClaimDocId,
  promotionClaimRef,
  readCurrentGamification,
  timeLimitedClaimDocId,
  writeClaimInTransaction,
} from '../data/promotionClaims.ts'
import { notifyPromotionClaimed } from '../notifications/reservationEvents.ts'
import {
  assertCustomerCanUsePromos,
  PROMO_LOCK_CLAIM_MESSAGE,
} from '../gamification/cancellationPenalty.ts'
import { promoLockStrikes } from '../gamification/penaltyConfig.ts'
import { checkLadderClaim } from '../data/ladderRules.ts'
import {
  applyInventoryGrants,
  claimProductTourReward,
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
  walkInCooldownHours,
  type SeasonPackKind,
} from '../gamification/inventoryItems.ts'
import { getLevelForXpFromCatalog, listMissionCatalogEntries } from '../data/gameCatalog.ts'
import { getWeekKey, getMonthKey } from '../gamification/companyProgress.ts'
import { createRateLimit } from '../middleware/rateLimit.ts'
import { resolveCompanyPromotionPin } from '../utils/companyPromotionPin.ts'
import { normalizePromotionPinCode } from '../utils/promotionPin.ts'
import { parseCompanyReservationMode } from '../utils.ts'
import { resolveConsumptionCapture } from '../utils/consumptionCapture.ts'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import {
  evaluateWalkInConsumption,
  mapVerifiedConsumptionDoc,
  resolveCompanyCardFields,
} from '../utils/verifiedConsumption.ts'
import { mergeAppendOnlyIds, mergeMonotonicIds } from '../gamification/syncMerge.ts'
import {
  claimWindowError,
  countClaimsForPromotion,
  customerLimitMessage,
  readMaxClaimsPerCustomer,
} from '../promotions/customerPromotionUses.ts'

const router = Router()

/** Error con el código HTTP que debe recibir el cliente. */
class ClaimError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

const MAX_REWARD_DELTA = 8000
// Tope de XP que se puede ganar a través de /sync en un mismo día (UTC).
// El navegador propone la XP de misiones; sin este tope, repetir la llamada
// permite inflar XP sin límite. Ajustable por si el catálogo de misiones crece.
const SYNC_XP_DAILY_CEILING = Math.max(
  500,
  Number(process.env.SYNC_XP_DAILY_CEILING ?? 5000) || 5000,
)
const registerConsumptionRateLimit = createRateLimit(10, 60_000, 'register-consumption')

function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

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

const MAX_NEW_HISTORICAL_MISSIONS_PER_SYNC = 3
const MAX_NEW_WEEKLY_MISSIONS_PER_SYNC = 2
const MAX_NEW_MONTHLY_MISSIONS_PER_SYNC = 2

/** Qué se ha recortado de una sincronización: no es un error, pero conviene verlo en el registro. */
interface SyncAdjustments {
  deferredMissions: string[]
  unknownMissions: string[]
  catalogUnavailable: boolean
  xpClamped: boolean
}

export async function validateMonotonicGamification(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
  xpCeiling: number | null = null,
) {
  const currentXp = numberValue(current.xp)
  const currentAdelinas = numberValue(current.adelinas)
  const adelinas = currentAdelinas

  const catalog = await listMissionCatalogEntries()
  const historicalAllowed = new Set(
    [...catalog.entries()].filter(([, entry]) => entry.cadence === 'historical' || entry.cadence == null).map(([id]) => id),
  )
  const weeklyAllowed = new Set(
    [...catalog.entries()].filter(([, entry]) => entry.cadence === 'weekly').map(([id]) => id),
  )
  const monthlyAllowed = new Set(
    [...catalog.entries()].filter(([, entry]) => entry.cadence === 'monthly').map(([id]) => id),
  )

  const serverWeekKey = getWeekKey()
  const serverMonthKey = getMonthKey()
  const sameWeek = (typeof current.weekKey === 'string' ? current.weekKey : '') === serverWeekKey
  const sameMonth = (typeof current.monthKey === 'string' ? current.monthKey : '') === serverMonthKey

  const completedMerge = mergeAppendOnlyIds(
    stringArray(current.completedMissions),
    stringArray(proposed.completedMissions),
    historicalAllowed,
    MAX_NEW_HISTORICAL_MISSIONS_PER_SYNC,
  )
  const weeklyMerge = mergeAppendOnlyIds(
    sameWeek ? stringArray(current.weeklyCompleted) : [],
    stringArray(proposed.weeklyCompleted),
    weeklyAllowed,
    MAX_NEW_WEEKLY_MISSIONS_PER_SYNC,
  )
  const monthlyMerge = mergeAppendOnlyIds(
    sameMonth ? stringArray(current.monthlyCompleted) : [],
    stringArray(proposed.monthlyCompleted),
    monthlyAllowed,
    MAX_NEW_MONTHLY_MISSIONS_PER_SYNC,
  )
  const merges = [completedMerge, weeklyMerge, monthlyMerge]
  const catalogUnavailable = catalog.size === 0
  const unknownMissions = merges.flatMap((merge) => merge.unknown)

  // Una misión fuera del catálogo no se puede guardar ni se sabe cuánta XP vale.
  // Si se aceptara la XP propuesta, el navegador volvería a sumarla en cada carga:
  // no se aplica nada hasta publicar el catálogo (scripts/seed-game-catalog.ts).
  const frozen = catalogUnavailable || unknownMissions.length > 0
  const deferredMissions = frozen ? [] : merges.flatMap((merge) => merge.deferred)

  // El navegador ya ha sumado la XP de las misiones aplazadas: se resta aquí y
  // entra junto a su misión en la siguiente llamada, para no contarla dos veces.
  const deferredXp = deferredMissions.reduce((total, id) => total + (catalog.get(id)?.xp ?? 0), 0)
  const currentPenaltyTotal = numberValue(current.xpPenaltyTotal)
  const proposedPenaltyTotal = numberValue(proposed.xpPenaltyTotal)
  const penaltyGap = Math.max(0, currentPenaltyTotal - proposedPenaltyTotal)
  const proposedXp = numberValue(proposed.xp, currentXp)
  const uncappedXp = frozen
    ? currentXp
    : Math.max(currentXp, proposedXp - penaltyGap - deferredXp)
  const xpClamped = uncappedXp - currentXp > MAX_REWARD_DELTA

  const today = utcDayKey()
  const priorDayKey = typeof current.syncXpDayKey === 'string' ? current.syncXpDayKey : ''
  const syncXpUsedToday = priorDayKey === today ? numberValue(current.syncXpToday) : 0
  const requestedGain = Math.min(MAX_REWARD_DELTA, Math.max(0, uncappedXp - currentXp))
  const allowedGain = Math.max(0, Math.min(requestedGain, SYNC_XP_DAILY_CEILING - syncXpUsedToday))
  const dailyCappedXp = currentXp + allowedGain
  const xp = xpCeiling != null
    ? Math.min(dailyCappedXp, Math.max(currentXp, xpCeiling))
    : dailyCappedXp

  // Los canjes solo se registran en su flujo de validación: los que proponga el
  // navegador se ignoran y siempre se guardan los del servidor.
  const currentClaims = Array.isArray(current.claimedPromotions) ? current.claimedPromotions : []

  const strikeCount = numberValue(current.cancellationStrikeCount)
  const promoLocked = current.promoLocked === true || strikeCount >= promoLockStrikes()

  const adjustments: SyncAdjustments = {
    deferredMissions,
    unknownMissions,
    catalogUnavailable,
    xpClamped,
  }

  const missionIds = (merged: { ids: string[] }, base: unknown) => (frozen ? stringArray(base) : merged.ids)
  const progressIds = (key: 'visitedCompanyIds' | 'reviewedReservationIds' | 'reviewedCompanyIds' | 'awardedReservationXpIds') => (
    frozen
      ? stringArray(current[key])
      : mergeMonotonicIds(stringArray(current[key]), stringArray(proposed[key]))
  )

  // No se hace spread de `proposed`: solo campos de progreso acotados y
  // week/month keys del servidor (evita inventar periodos para farmear loot).
  return {
    adjustments,
    state: {
      ...current,
      xp,
      adelinas,
      weekKey: serverWeekKey,
      monthKey: serverMonthKey,
      completedMissions: missionIds(completedMerge, current.completedMissions),
      weeklyCompleted: missionIds(weeklyMerge, sameWeek ? current.weeklyCompleted : []),
      monthlyCompleted: missionIds(monthlyMerge, sameMonth ? current.monthlyCompleted : []),
      visitedCompanyIds: progressIds('visitedCompanyIds'),
      reviewedReservationIds: progressIds('reviewedReservationIds'),
      reviewedCompanyIds: progressIds('reviewedCompanyIds'),
      awardedReservationXpIds: progressIds('awardedReservationXpIds'),
      favoriteSlugs: Array.isArray(proposed.favoriteSlugs)
        ? stringArray(proposed.favoriteSlugs).slice(0, 200)
        : stringArray(current.favoriteSlugs),
      syncXpDayKey: today,
      syncXpToday: syncXpUsedToday + allowedGain,
      claimedPromotions: currentClaims,
      redemptionsCount: numberValue(current.redemptionsCount),
      lastCelebratedLevel: mergeCelebratedLevel(current.lastCelebratedLevel, proposed.lastCelebratedLevel),
      celebratedMissionIds: [...new Set([
        ...stringArray(current.celebratedMissionIds),
        ...stringArray(proposed.celebratedMissionIds),
      ])].slice(0, 400),
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
    },
  }
}

/**
 * Reservas del cliente en un local. Con el correo verificado cuentan también las
 * que hizo como invitado con ese correo; sin verificar, solo las de su cuenta
 * (si no, cualquiera podría registrarse con el correo de otra persona).
 */
function customerReservationsQuery(
  customer: { uid: string; email: string; emailVerified: boolean },
  companyId: string,
) {
  const base = adminDb.collection('reservations').where('companyId', '==', companyId)
  return customer.emailVerified
    ? base.where('clientEmail', '==', customer.email)
    : base.where('customerUid', '==', customer.uid)
}

function reservationBelongsToCustomer(
  reservation: FirebaseFirestore.DocumentData | undefined,
  customer: { uid: string; email: string; emailVerified: boolean },
): boolean {
  if (!reservation) return false
  if (reservation.customerUid === customer.uid) return true
  return customer.emailVerified
    && String(reservation.clientEmail ?? '').trim().toLowerCase() === customer.email
}

router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const scope = req.query.scope === 'country' ? 'country' : 'world'
    const statsSnap = await adminDb
      .collection('userGamification')
      .orderBy('xp', 'desc')
      .limit(80)
      .get()
    const userRefs = statsSnap.docs.map((docSnap) => adminDb.collection('users').doc(docSnap.id))
    const userSnaps = userRefs.length > 0
      ? await adminDb.getAll(...userRefs)
      : []
    const [selfSnap, selfStatsSnap] = await Promise.all([
      adminDb.collection('users').doc(customer.uid).get(),
      adminDb.collection('userGamification').doc(customer.uid).get(),
    ])
    const selfCountry = String(selfSnap.data()?.homeCountry ?? selfSnap.data()?.country ?? 'España')

    const entries = statsSnap.docs.flatMap((docSnap, index) => {
      const userSnap = userSnaps[index]
      const userData = userSnap?.data()
      if (!userSnap?.exists || userData?.role !== 'customer' || userData?.blocked === true) {
        return []
      }
      const country = String(userData.homeCountry ?? userData.country ?? 'España')
      if (scope === 'country' && country !== selfCountry) {
        return []
      }
      const xp = numberValue(docSnap.data().xp)
      return [{
        uid: docSnap.id,
        displayName: String(userData.displayName ?? 'Foodie'),
        xp,
        photoUrl: typeof userData.photoUrl === 'string' ? userData.photoUrl : '',
        homeCountry: country,
        homeCity: typeof userData.homeCity === 'string' ? userData.homeCity : '',
        isYou: docSnap.id === customer.uid,
      }]
    })

    if (!entries.some((entry) => entry.isYou)) {
      // El mismo XP que usa el ranking (userGamification), no el copiado en users.
      const selfXp = numberValue(selfStatsSnap.exists ? selfStatsSnap.data()?.xp : selfSnap.data()?.xp)
      entries.push({
        uid: customer.uid,
        displayName: String(selfSnap.data()?.displayName ?? 'Tú'),
        xp: selfXp,
        photoUrl: typeof selfSnap.data()?.photoUrl === 'string' ? selfSnap.data()?.photoUrl : '',
        homeCountry: selfCountry,
        homeCity: typeof selfSnap.data()?.homeCity === 'string' ? selfSnap.data()?.homeCity : '',
        isYou: true,
      })
      entries.sort((left, right) => right.xp - left.xp)
    }

    res.json({
      scope,
      entries: entries.slice(0, 50).map((entry, index) => ({
        ...entry,
        rank: index + 1,
        level: 0,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el ranking.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

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

    // Techo de XP calculado fuera de la transacción (solo lecturas agregadas).
    const xpCeiling = await computeCustomerXpCeiling({
      uid: customer.uid,
      // Las reservas de invitado con su correo solo cuentan si lo ha verificado.
      email: customer.emailVerified ? customer.email : '',
      createdAt: customer.data.createdAt,
    }).catch(() => null)

    const next = await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const currentState = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      const validated = await validateMonotonicGamification(
        currentState,
        proposed as Record<string, unknown>,
        xpCeiling,
      )
      const granted = await applyInventoryGrants(validated.state)
      writeGamification(transaction, customer.uid, granted.state)
      return { ...granted, adjustments: validated.adjustments }
    })

    const { deferredMissions, unknownMissions, catalogUnavailable, xpClamped } = next.adjustments
    if (deferredMissions.length > 0 || unknownMissions.length > 0 || catalogUnavailable || xpClamped) {
      console.warn('Gamification sync ajustado:', {
        uid: customer.uid,
        deferredMissions,
        unknownMissions,
        catalogUnavailable,
        xpClamped,
      })
    }

    res.json({
      gamification: next.state,
      newItemGrantBatches: next.newGrantBatches,
      deferred: deferredMissions.length > 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar el progreso.'
    const status = message.includes('cliente') ? 401 : message.includes('válid') ? 400 : 500
    if (status !== 401) {
      console.error('Gamification sync error:', error)
    }
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
      const currentLevel = await getLevelForXpFromCatalog(currentXp)
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

/** Progreso del mapa de premios de un local (visitas, baseline, reclamadas). */
router.get('/ladder-progress', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const companyId = String(req.query?.companyId ?? '').trim()
    if (!companyId) {
      res.status(400).json({ error: 'Restaurante no válido.' })
      return
    }

    const [userSnap, statsSnap, reservationsSnap] = await Promise.all([
      adminDb.collection('users').doc(customer.uid).get(),
      userGamificationRef(customer.uid).get(),
      customerReservationsQuery(customer, companyId)
        .limit(200)
        .get(),
    ])

    const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
    const tokenCredits = numberRecord(current.tokenCreditsByCompany)[companyId] ?? 0
    // Misma regla que la app (countsForPromotionProgress): una reserva con gasto
    // mínimo solo suma si se validó que llegó a ese gasto.
    const reservationCount = reservationsSnap.docs.filter((docSnap) => {
      const reservation = docSnap.data()
      if (reservation.companyId !== companyId || reservation.status !== 'confirmed') return false
      const needsMinimum = typeof reservation.minimumSpendCents === 'number' && reservation.minimumSpendCents > 0
      return !needsMinimum || reservation.promotionVisitStatus === 'eligible'
    }).length
    const confirmedCount = reservationCount + tokenCredits

    const baselines = numberRecord(current.ladderBaselinesByCompany)
    const completions = numberRecord(current.ladderCompletionsByCompany)
    const activeMap = current.activeLadderPromotionByCompany
      && typeof current.activeLadderPromotionByCompany === 'object'
      && !Array.isArray(current.activeLadderPromotionByCompany)
      ? current.activeLadderPromotionByCompany as Record<string, string>
      : {}

    const claimedPromotions = (Array.isArray(current.claimedPromotions) ? current.claimedPromotions : [])
      .flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const row = item as Record<string, unknown>
        const promotionId = typeof row.promotionId === 'string' ? row.promotionId : ''
        const rowCompanyId = typeof row.companyId === 'string' ? row.companyId : ''
        const claimedAt = typeof row.claimedAt === 'string' ? row.claimedAt : ''
        if (!promotionId || !rowCompanyId) return []
        return [{ promotionId, companyId: rowCompanyId, claimedAt }]
      })

    res.json({
      companyId,
      confirmedCount,
      reservationCount,
      tokenCredits,
      baseline: baselines[companyId] ?? 0,
      completions: completions[companyId] ?? 0,
      activePromotionId: typeof activeMap[companyId] === 'string' ? activeMap[companyId] : null,
      claimedPromotions,
    })
  } catch (error) {
    console.error('Ladder progress error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo cargar el progreso.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

router.post('/claim-ladder', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const companyId = String(req.body?.companyId ?? '').trim()
    const promotionId = String(req.body?.promotionId ?? '').trim()
    const pin = normalizePromotionPinCode(String(req.body?.pin ?? ''))
    if (!companyId || !promotionId) {
      res.status(400).json({ error: 'Canje no válido.' })
      return
    }
    if (pin.length !== 4) {
      res.status(400).json({ error: 'Pide el código PIN al empleado del restaurante.' })
      return
    }

    const companyRef = adminDb.collection('companies').doc(companyId)
    // Sin el PIN del local no hay premio: antes se comprobaba en otra llamada y
    // esta se podía pedir directamente sin estar en el restaurante.
    if (!(await takePromotionPinAttempt(customer.uid, companyId))) {
      res.status(429).json({ error: PIN_ATTEMPTS_MESSAGE })
      return
    }
    const pinCompanySnap = await companyRef.get()
    if (!pinCompanySnap.exists || (await resolveCompanyPromotionPin(companyRef, pinCompanySnap.data() ?? {})) !== pin) {
      res.status(403).json({ error: 'Código PIN incorrecto. Pídeselo de nuevo al empleado.' })
      return
    }

    const [companySnap, promotionSnap, ladderPromotionsSnap, reservationsSnap] = await Promise.all([
      companyRef.get(),
      companyRef.collection('promotions').doc(promotionId).get(),
      companyRef.collection('promotions')
        .where('active', '==', true)
        .limit(40)
        .get(),
      customerReservationsQuery(customer, companyId)
        .orderBy('startTime', 'desc')
        .limit(200)
        .get()
        .catch(() => customerReservationsQuery(customer, companyId)
          .limit(200)
          .get()),
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

    // Misma regla que la app (countsForPromotionProgress): una reserva con gasto
    // mínimo solo suma si se validó que llegó a ese gasto.
    const reservationCount = reservationsSnap.docs.filter((docSnap) => {
      const reservation = docSnap.data()
      if (reservation.companyId !== companyId || reservation.status !== 'confirmed') return false
      const needsMinimum = typeof reservation.minimumSpendCents === 'number' && reservation.minimumSpendCents > 0
      return !needsMinimum || reservation.promotionVisitStatus === 'eligible'
    }).length
    const required = Math.max(1, Math.trunc(numberValue(promotion.requiredReservations, 1)))

    const company = companySnap.data()!
    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    let claimId = ''
    let claimTitle = String(promotion.title ?? 'tu premio')
    await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap, freshPromotionSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
        transaction.get(promotionSnap.ref),
      ])
      const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      assertCustomerCanUsePromos(current)

      // Las plazas se comprueban dentro de la transacción: dos canjes a la vez no pueden pasarse del máximo.
      const freshPromotion = freshPromotionSnap.data() ?? {}
      const maxRedemptions = typeof freshPromotion.maxRedemptions === 'number' ? freshPromotion.maxRedemptions : null
      const currentRedemptions = typeof freshPromotion.currentRedemptions === 'number' ? freshPromotion.currentRedemptions : 0
      if (maxRedemptions != null && maxRedemptions > 0 && currentRedemptions >= maxRedemptions) {
        throw new ClaimError(409, 'Esta promoción ya no tiene plazas.')
      }

      const tokenCredits = numberRecord(current.tokenCreditsByCompany)[companyId] ?? 0
      const confirmedCount = reservationCount + tokenCredits
      const claims = Array.isArray(current.claimedPromotions) ? current.claimedPromotions : []
      const ladderClaimLimit = readMaxClaimsPerCustomer(freshPromotion)
      if (ladderClaimLimit != null && countClaimsForPromotion(claims, promotionId) >= ladderClaimLimit) {
        throw new ClaimError(409, customerLimitMessage(ladderClaimLimit))
      }
      const windowError = claimWindowError(freshPromotion)
      if (windowError) {
        throw new ClaimError(409, windowError)
      }
      const ladderIds = ladderPromotionsSnap.docs
        .filter((docSnap) => docSnap.data().type === 'reservation_ladder')
        .sort((left, right) => (
          numberValue(left.data().requiredReservations)
          - numberValue(right.data().requiredReservations)
        ))
        .map((docSnap) => docSnap.id)
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

      // Mismas reglas que el mapa que ve el cliente (ver data/ladderRules.ts).
      const baseline = numberValue(baselines[companyId])
      const check = checkLadderClaim({
        promotionId,
        ladderIds,
        activePromotionId: activePromotions[companyId],
        required,
        confirmedCount,
        baseline,
      })
      if (!check.ok) {
        throw new ClaimError(check.status, check.error)
      }
      const nextPromotionId = check.nextPromotionId

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
      claimId = ladderClaimDocId(customer.uid, promotionId, baseline)
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
            // El mapa se completa al canjear su último escalón: ahí vuelve a empezar de cero.
            [companyId]: numberValue(completions[companyId]) + (check.completesMap ? 1 : 0),
          },
        },
      )
      if (!wrote) {
        throw new ClaimError(409, 'Este premio ya fue canjeado para tus visitas actuales.')
      }
      transaction.update(promotionSnap.ref, {
        currentRedemptions: FieldValue.increment(1),
      })
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
    const status = error instanceof ClaimError
      ? error.status
      : message.includes('cliente')
        ? 401
        : message === PROMO_LOCK_CLAIM_MESSAGE
          ? 403
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
      || !reservationBelongsToCustomer(reservation, customer)
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
    const claimed = await adminDb.runTransaction(async (transaction) => {
      const [current, freshPromotionSnap, existingClaim] = await Promise.all([
        readCurrentGamification(transaction, customer.uid),
        transaction.get(promotionRef),
        transaction.get(promotionClaimRef(claimId)),
      ])
      assertCustomerCanUsePromos(current)

      // Repetir el canje de la misma reserva no hace nada: ya está reclamado.
      if (existingClaim.exists) {
        return false
      }

      const freshPromotion = freshPromotionSnap.data() ?? {}
      const maxRedemptions = typeof freshPromotion.maxRedemptions === 'number' ? freshPromotion.maxRedemptions : null
      const currentRedemptions = typeof freshPromotion.currentRedemptions === 'number' ? freshPromotion.currentRedemptions : 0
      if (maxRedemptions != null && maxRedemptions > 0 && currentRedemptions >= maxRedemptions) {
        throw new ClaimError(409, 'Esta promoción ya no tiene plazas.')
      }
      const claimLimit = readMaxClaimsPerCustomer(freshPromotion)
      if (
        claimLimit != null
        && countClaimsForPromotion(current.claimedPromotions, promotionId, reservationId) >= claimLimit
      ) {
        throw new ClaimError(409, customerLimitMessage(claimLimit))
      }

      const wrote = await writeClaimInTransaction(
        transaction,
        customer.uid,
        claimId,
        claim,
        appendClaimToState(current, claim),
      )
      if (wrote) {
        transaction.update(promotionRef, { currentRedemptions: FieldValue.increment(1) })
      }
      return wrote
    })

    if (claimed) {
      await notifyPromotionClaimed(
        customer.uid,
        promotionId,
        companyId,
        String(promotion.title ?? 'tu premio'),
        reservationId,
        claimId,
      ).catch(() => undefined)
    }

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar el canje.'
    const status = error instanceof ClaimError
      ? error.status
      : message.includes('cliente')
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
      companyRef.collection('promotions').where('active', '==', true).limit(40).get(),
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
      if (!cover.coversFully) {
        throw new Error('Esta carta no cubre el gasto mínimo de la oferta. No se ha gastado ninguna carta.')
      }
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
      const credits = numberRecord(consumed.tokenCreditsByCompany)
      credits[companyId] = (credits[companyId] ?? 0) + visits
      const next: Record<string, unknown> = {
        ...consumed,
        tokenCreditsByCompany: credits,
      }

      writeGamification(transaction, customer.uid, next)
      return {
        visits,
        coverCents: cover.coverCents,
        remainderCents: 0,
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
        || message.includes('cubre el gasto')
        || message.includes('quedan cartas')
        ? 403
        : 500
    res.status(status).json({ error: message })
  }
})

router.get('/consumptions', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const snapshot = await adminDb.collectionGroup('verifiedConsumptions')
      .where('customerUid', '==', customer.uid)
      .orderBy('verifiedAt', 'desc')
      .limit(200)
      .get()

    const items = snapshot.docs.map((docSnap) => mapVerifiedConsumptionDoc(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
      docSnap.ref.parent.parent?.id ?? '',
    ))

    const missingCompanyIds = [...new Set(
      items
        .filter((item) => item.companyId && (!item.photoUrl || item.companyName === 'Restaurante'))
        .map((item) => item.companyId),
    )]

    if (missingCompanyIds.length > 0) {
      const companySnaps = await Promise.all(
        missingCompanyIds.map((id) => adminDb.collection('companies').doc(id).get()),
      )
      const cardsById = new Map(
        companySnaps
          .filter((snap) => snap.exists)
          .map((snap) => [snap.id, resolveCompanyCardFields(snap.data())]),
      )

      for (const item of items) {
        const card = cardsById.get(item.companyId)
        if (!card) {
          continue
        }
        if (item.companyName === 'Restaurante') {
          item.companyName = card.companyName
        }
        if (!item.companySlug) {
          item.companySlug = card.companySlug
        }
        if (!item.photoUrl) {
          item.photoUrl = card.photoUrl
        }
      }
    }

    res.json({ consumptions: items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el consumo.'
    const status = message.includes('cliente') ? 401 : 500
    res.status(status).json({ error: message })
  }
})

router.post('/promotions/register-consumption', registerConsumptionRateLimit, async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const companyId = String(req.body?.companyId ?? '').trim()
    const promotionId = String(req.body?.promotionId ?? '').trim()
    const pin = normalizePromotionPinCode(String(req.body?.pin ?? ''))

    if (!companyId) {
      res.status(400).json({ error: 'Restaurante no válido.' })
      return
    }

    if (pin.length !== 4) {
      res.status(400).json({ error: 'El código PIN debe tener 4 dígitos.' })
      return
    }

    const companyRef = adminDb.collection('companies').doc(companyId)
    const [companySnap, promotionsSnap] = await Promise.all([
      companyRef.get(),
      companyRef.collection('promotions').where('active', '==', true).limit(40).get(),
    ])
    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const companyData = companySnap.data()!
    const reservationRequired = parseCompanyReservationMode(companyData.reservationMode) === 'required'
    const ladderDocs = promotionsSnap.docs
      .filter((docSnap) => docSnap.data().type === 'reservation_ladder')
      .sort((left, right) => (
        numberValue(left.data().requiredReservations) - numberValue(right.data().requiredReservations)
      ))

    // Si piden una promo concreta, léela por ID (el limit(40) puede no incluirla).
    let targetPromotionData: Record<string, unknown> | null = null
    if (promotionId) {
      const fromList = promotionsSnap.docs.find((docSnap) => docSnap.id === promotionId)
      if (fromList) {
        targetPromotionData = fromList.data() as Record<string, unknown>
      } else {
        const directSnap = await companyRef.collection('promotions').doc(promotionId).get()
        if (directSnap.exists && directSnap.data()?.active === true) {
          targetPromotionData = directSnap.data() as Record<string, unknown>
        }
      }
    } else if (ladderDocs[0]) {
      targetPromotionData = ladderDocs[0].data() as Record<string, unknown>
    }

    const eligiblePromotionIds = [
      ...new Set([
        ...promotionsSnap.docs.map((docSnap) => docSnap.id),
        ...(promotionId && targetPromotionData ? [promotionId] : []),
      ]),
    ]

    const requiredCents = targetPromotionData
      ? promoMinimumFromPromotionData(targetPromotionData)
      : 0

    const capture = await resolveConsumptionCapture({
      companyRef,
      mode: req.body?.mode,
      declaredTotalCents: req.body?.declaredTotalCents,
      productSelections: req.body?.productSelections,
      requireDetails: requiredCents > 0,
    })
    if (!(await takePromotionPinAttempt(customer.uid, companyId))) {
      res.status(429).json({ error: PIN_ATTEMPTS_MESSAGE })
      return
    }
    const currentPin = await resolveCompanyPromotionPin(companyRef, companyData)
    const decision = evaluateWalkInConsumption({
      pinMatches: currentPin === pin,
      reservationRequired,
      ladderPromotionIds: ladderDocs.map((docSnap) => docSnap.id),
      // Cualquier promo activa del local se puede verificar con PIN.
      eligiblePromotionIds,
      requestedPromotionId: promotionId,
      captureError: 'error' in capture ? capture.error : null,
      requiredCents,
      totalCents: 'error' in capture ? 0 : capture.totalCents,
    })

    if (!decision.ok) {
      res.status(decision.status).json({ error: decision.error })
      return
    }

    if ('error' in capture) {
      res.status(400).json({ error: capture.error })
      return
    }

    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    const card = resolveCompanyCardFields(companyData)
    const promotionTitle = typeof targetPromotionData?.title === 'string'
      ? String(targetPromotionData.title).trim()
      : ''

    let registered: { visits: number; tokenCreditsByCompany: Record<string, number> }

    if (decision.grantCredit) {
      registered = await adminDb.runTransaction(async (transaction) => {
        const [userSnap, statsSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(statsRef),
        ])
        const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
        assertCustomerCanUsePromos(current)
        // Sin este tope, quien tenga el PIN podría sumar visitas sin parar y completar el mapa.
        const lastCredits = current.walkInCreditAtByCompany
          && typeof current.walkInCreditAtByCompany === 'object'
          ? current.walkInCreditAtByCompany as Record<string, string>
          : {}
        const lastAt = Date.parse(String(lastCredits[companyId] ?? ''))
        const cooldownMs = walkInCooldownHours() * 60 * 60 * 1000
        if (Number.isFinite(lastAt) && Date.now() - lastAt < cooldownMs) {
          const hoursLeft = Math.max(1, Math.ceil((cooldownMs - (Date.now() - lastAt)) / (60 * 60 * 1000)))
          throw new ClaimError(
            429,
            `Ya registraste un consumo en este restaurante hace poco. Podrás registrar otro en unas ${hoursLeft} h.`,
          )
        }
        const credits = numberRecord(current.tokenCreditsByCompany)
        credits[companyId] = (credits[companyId] ?? 0) + 1
        const next = {
          ...current,
          tokenCreditsByCompany: credits,
          walkInCreditAtByCompany: { ...lastCredits, [companyId]: new Date().toISOString() },
        }
        writeGamification(transaction, customer.uid, next)
        return {
          visits: 1,
          tokenCreditsByCompany: credits,
        }
      })
    } else {
      const [userSnap, statsSnap] = await Promise.all([userRef.get(), statsRef.get()])
      const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      registered = {
        visits: 0,
        tokenCreditsByCompany: numberRecord(current.tokenCreditsByCompany),
      }
    }

    const verifiedAt = Timestamp.now()
    const consumptionId = `consume-${customer.uid.slice(0, 8)}-${Date.now().toString(36)}`
    const clientName = typeof customer.data.displayName === 'string'
      ? customer.data.displayName
      : ''
    await companyRef.collection('verifiedConsumptions').doc(consumptionId).set({
      reservationId: consumptionId,
      companyId,
      customerUid: customer.uid,
      clientName,
      clientEmail: customer.email,
      pax: 0,
      reservationStartTime: verifiedAt,
      promotionId: decision.promotionId,
      promotionTitle: promotionTitle || null,
      minimumSpendCents: requiredCents,
      mode: capture.mode,
      totalCents: capture.totalCents,
      lineItems: capture.lineItems,
      verifiedAt,
      meetsMinimumSpend: requiredCents <= 0 || capture.totalCents >= requiredCents,
      source: 'walk_in',
      companyName: card.companyName,
      companySlug: card.companySlug,
      photoUrl: card.photoUrl,
    })

    res.json(registered)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar el consumo.'
    const status = error instanceof ClaimError
      ? error.status
      : message.includes('cliente')
        ? 401
        : message === PROMO_LOCK_CLAIM_MESSAGE
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

router.post('/inventory/claim-tour-reward', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)

    const claimed = await adminDb.runTransaction(async (transaction) => {
      const [userSnap, statsSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      const current = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      const result = claimProductTourReward(current)
      writeGamification(transaction, customer.uid, result.state)
      transaction.set(userRef, { productTourCompleted: true }, { merge: true })
      return {
        grants: result.grants,
        alreadyClaimed: result.alreadyClaimed,
        inventory: numberRecord(result.state.inventory),
        grantedItemKeys: Array.isArray(result.state.grantedItemKeys)
          ? result.state.grantedItemKeys
          : [],
      }
    })

    res.json(claimed)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo reclamar la recompensa.'
    const status = message.includes('cliente') ? 401 : 500
    res.status(status).json({ error: message })
  }
})

export default router
