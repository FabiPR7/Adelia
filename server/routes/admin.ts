import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { verifySignedInUser } from '../auth/verifyRequest.ts'
import { ensureRemoteCatalog, getRemoteCatalog } from '../data/remoteCatalog.ts'
import { readGamificationFromDocs, userGamificationRef, writeGamification } from '../data/userGamification.ts'
import { loadDailyStats } from '../admin/dailyStats.ts'
import { computeAdminAnalytics, computeAdminGeography, parseAnalyticsRange } from '../admin/analytics.ts'

/**
 * Panel de administración (todas las rutas pasan antes por verifyAdmin).
 * Los totales salen de recuentos del servidor (1 lectura por cada 1000
 * documentos) y las series de `adminStats`, así el panel cuesta lo mismo con
 * 100 que con un millón de usuarios. Todo cambio queda en `adminAuditLog`.
 */
const router = Router()

export const AUDIT_COLLECTION = 'adminAuditLog'
const PLAN_IDS = ['free', 'basic', 'premium', 'premium_plus'] as const
const FALLBACK_PRICE: Record<string, number> = { basic: 39.99, premium: 59.99, premium_plus: 59.99 }
const STATS_CACHE_MS = 60_000
const MAX_BROADCAST = 5000

let statsCache: { key: string; at: number; body: unknown } | null = null

async function count(query: FirebaseFirestore.Query): Promise<number> {
  try {
    const snap = await query.count().get()
    return snap.data().count
  } catch (error) {
    console.error('admin count error:', error)
    return 0
  }
}

async function audit(req: Request, action: string, target: string, detail: Record<string, unknown>) {
  let actorUid = ''
  try {
    actorUid = (await verifySignedInUser(req)).uid
  } catch {
    actorUid = ''
  }
  await adminDb.collection(AUDIT_COLLECTION).add({
    action,
    target,
    detail,
    actorUid,
    createdAt: FieldValue.serverTimestamp(),
  }).catch((error) => console.error('audit error:', error))
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanInt(value: unknown, min: number, max: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(min, Math.min(max, Math.trunc(number)))
}

function planPrice(planId: string, period: 'monthly' | 'annual'): number {
  const plan = getRemoteCatalog().plans?.get(planId)
  if (period === 'annual') {
    const annual = plan?.priceAnnual
    if (typeof annual === 'number' && annual > 0) return annual / 12
  }
  const monthly = plan?.priceMonthly
  return typeof monthly === 'number' && monthly > 0 ? monthly : (FALLBACK_PRICE[planId] ?? 0)
}

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return null
}

/* ───────────── Indicadores ───────────── */

router.get('/stats', async (req: Request, res: Response) => {
  const days = cleanInt(req.query.days ?? 30, 7, 365)
  const key = String(days)
  if (statsCache && statsCache.key === key && Date.now() - statsCache.at < STATS_CACHE_MS) {
    res.json(statsCache.body)
    return
  }
  try {
    await ensureRemoteCatalog()
    const users = adminDb.collection('users')
    const companies = adminDb.collection('companies')
    const reservations = adminDb.collection('reservations')
    const now = Timestamp.now()

    const [
      customers, blockedCustomers, phoneVerified, companyCount, deactivated, featured,
      reservationsTotal, confirmed, completed, cancelled, upcoming,
      promotionClaims, reviews, subscriptionsPending,
    ] = await Promise.all([
      count(users.where('role', '==', 'customer')),
      count(users.where('role', '==', 'customer').where('blocked', '==', true)),
      count(users.where('role', '==', 'customer').where('phoneVerified', '==', true)),
      count(companies),
      count(companies.where('deactivated', '==', true)),
      count(companies.where('discoveryFeatured', '==', true)),
      count(reservations),
      count(reservations.where('status', '==', 'confirmed')),
      count(reservations.where('status', '==', 'completed')),
      count(reservations.where('status', '==', 'cancelled')),
      count(reservations.where('status', '==', 'confirmed').where('startTime', '>=', now)),
      count(adminDb.collection('promotionClaims')),
      count(adminDb.collection('reviewIndex')),
      count(companies.where('lemonSqueezyPending', '==', true)),
    ])

    const plans = await Promise.all(PLAN_IDS.map(async (planId) => {
      const [total, monthly, annual, perpetual] = await Promise.all([
        count(companies.where('planId', '==', planId)),
        planId === 'free' ? 0 : count(companies.where('planId', '==', planId).where('planBilling', '==', 'monthly')),
        planId === 'free' ? 0 : count(companies.where('planId', '==', planId).where('planBilling', '==', 'annual')),
        planId === 'free' ? 0 : count(companies.where('planId', '==', planId).where('planBilling', '==', 'perpetual')),
      ])
      const name = getRemoteCatalog().plans?.get(planId)?.name ?? planId
      const mrr = monthly * planPrice(planId, 'monthly') + annual * planPrice(planId, 'annual')
      return { planId, name, total, monthly, annual, perpetual, mrr: Math.round(mrr * 100) / 100 }
    }))

    const series = await loadDailyStats(days)

    // Nombre de los locales que más reservan en el periodo.
    const topTotals = new Map<string, number>()
    for (const day of series) {
      for (const [companyId, value] of Object.entries(day.topCompanies)) {
        topTotals.set(companyId, (topTotals.get(companyId) ?? 0) + value)
      }
    }
    const topIds = [...topTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const topSnaps = topIds.length > 0
      ? await adminDb.getAll(...topIds.map(([id]) => companies.doc(id)))
      : []
    const topCompanies = topIds.map(([id, reservationsCount], index) => {
      const data = topSnaps[index]?.data() ?? {}
      return {
        id,
        name: typeof data.name === 'string' ? data.name : 'Local',
        municipality: typeof data.municipality === 'string' ? data.municipality : '',
        planId: typeof data.planId === 'string' ? data.planId : 'free',
        reservations: reservationsCount,
      }
    })

    const paidCompanies = plans.filter((plan) => plan.planId !== 'free').reduce((sum, plan) => sum + plan.total, 0)
    // Un local sin planId guardado también es de plan gratuito: así «Mesa» cuadra con el total.
    const freePlan = plans.find((plan) => plan.planId === 'free')
    if (freePlan) freePlan.total = Math.max(freePlan.total, companyCount - paidCompanies)
    const body = {
      generatedAt: new Date().toISOString(),
      totals: {
        customers,
        blockedCustomers,
        phoneVerified,
        companies: companyCount,
        activeCompanies: companyCount - deactivated,
        deactivatedCompanies: deactivated,
        featuredCompanies: featured,
        paidCompanies,
        subscriptionsPending,
        reservations: reservationsTotal,
        confirmed,
        completed,
        cancelled,
        upcoming,
        promotionClaims,
        reviews,
      },
      revenue: {
        mrr: Math.round(plans.reduce((sum, plan) => sum + plan.mrr, 0) * 100) / 100,
        perpetual: plans.reduce((sum, plan) => sum + plan.perpetual, 0),
        conversion: companyCount > 0 ? paidCompanies / companyCount : 0,
      },
      plans,
      series,
      topCompanies,
    }
    statsCache = { key, at: Date.now(), body }
    res.json(body)
  } catch (error) {
    console.error('admin stats error:', error)
    res.status(500).json({ error: 'No se pudieron calcular las estadísticas.' })
  }
})

/* ───────────── Informes entre fechas ───────────── */

const analyticsCache = new Map<string, { at: number; body: unknown }>()

router.get('/analytics', async (req: Request, res: Response) => {
  const range = parseAnalyticsRange(req.query.from, req.query.to)
  if (!range) {
    res.status(400).json({ error: 'Elige unas fechas válidas (como mucho dos años).' })
    return
  }
  const includeTest = req.query.test === '1'
  const key = `${range.from}|${range.to}|${includeTest}`
  const cached = analyticsCache.get(key)
  if (cached && Date.now() - cached.at < STATS_CACHE_MS) {
    res.json(cached.body)
    return
  }
  try {
    const body = await computeAdminAnalytics(range, includeTest)
    if (analyticsCache.size > 50) analyticsCache.clear()
    analyticsCache.set(key, { at: Date.now(), body })
    res.json(body)
  } catch (error) {
    console.error('admin analytics error:', error)
    res.status(500).json({ error: 'No se pudieron calcular los informes.' })
  }
})

let geoCache: { at: number; body: unknown } | null = null

router.get('/geography', async (_req: Request, res: Response) => {
  if (geoCache && Date.now() - geoCache.at < 5 * 60_000) {
    res.json(geoCache.body)
    return
  }
  try {
    const body = await computeAdminGeography()
    geoCache = { at: Date.now(), body }
    res.json(body)
  } catch (error) {
    console.error('admin geography error:', error)
    res.status(500).json({ error: 'No se pudo calcular el mapa de usuarios.' })
  }
})

/* ───────────── Clientes ───────────── */

router.get('/customers/:uid', async (req: Request, res: Response) => {
  const uid = cleanText(req.params.uid, 128)
  try {
    const [userSnap, gameSnap, reservationsSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).get(),
      userGamificationRef(uid).get(),
      adminDb.collection('reservations').where('customerUid', '==', uid).limit(60).get(),
    ])
    if (!userSnap.exists) {
      res.status(404).json({ error: 'Cliente no encontrado.' })
      return
    }
    const user = userSnap.data() ?? {}
    const state = readGamificationFromDocs(gameSnap.data(), user)
    const inventory = state.inventory && typeof state.inventory === 'object'
      ? Object.entries(state.inventory as Record<string, unknown>)
          .filter(([, qty]) => typeof qty === 'number' && qty > 0)
          .map(([itemId, qty]) => ({ itemId, quantity: qty as number }))
      : []
    const reservationRows = reservationsSnap.docs
      .map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          companyId: typeof data.companyId === 'string' ? data.companyId : '',
          status: typeof data.status === 'string' ? data.status : '',
          pax: typeof data.pax === 'number' ? data.pax : 0,
          startTime: toIso(data.startTime),
          createdAt: toIso(data.createdAt),
        }
      })
      .sort((a, b) => String(b.startTime).localeCompare(String(a.startTime)))
      .slice(0, 25)
    res.json({
      uid,
      displayName: cleanText(user.displayName, 120),
      email: cleanText(user.email, 200),
      loginName: cleanText(user.loginName, 80),
      phone: cleanText(user.phone, 40),
      phoneVerified: user.phoneVerified === true,
      blocked: user.blocked === true,
      municipality: cleanText(user.municipality, 120),
      createdAt: toIso(user.createdAt),
      onboardingCompleted: user.onboardingCompleted === true,
      xp: typeof state.xp === 'number' ? state.xp : 0,
      level: typeof gameSnap.data()?.level === 'number' ? gameSnap.data()?.level : null,
      adelinas: typeof state.adelinas === 'number' ? state.adelinas : 0,
      cancellationStrikes: typeof state.cancellationStrikes === 'number' ? state.cancellationStrikes : 0,
      inventory,
      reservations: reservationRows,
    })
  } catch (error) {
    console.error('admin customer detail error:', error)
    res.status(500).json({ error: 'No se pudo cargar el cliente.' })
  }
})

router.post('/customers/:uid/adjust', async (req: Request, res: Response) => {
  const uid = cleanText(req.params.uid, 128)
  const xpDelta = cleanInt(req.body?.xpDelta, -1_000_000, 1_000_000)
  const adelinasDelta = cleanInt(req.body?.adelinasDelta, -1_000_000, 1_000_000)
  const reason = cleanText(req.body?.reason, 300)
  const items = Array.isArray(req.body?.items)
    ? (req.body.items as unknown[]).slice(0, 20).flatMap((entry) => {
        const raw = entry as Record<string, unknown> | null
        const itemId = cleanText(raw?.itemId, 80)
        const quantity = cleanInt(raw?.quantity, -999, 999)
        return itemId && quantity !== 0 ? [{ itemId, quantity }] : []
      })
    : []
  if (!reason) {
    res.status(400).json({ error: 'Escribe el motivo del ajuste.' })
    return
  }
  if (xpDelta === 0 && adelinasDelta === 0 && items.length === 0) {
    res.status(400).json({ error: 'No hay nada que ajustar.' })
    return
  }
  try {
    await ensureRemoteCatalog()
    const knownItems = getRemoteCatalog().items
    for (const item of items) {
      if (knownItems && !knownItems.has(item.itemId)) {
        res.status(400).json({ error: `El objeto «${item.itemId}» no existe en el catálogo.` })
        return
      }
    }
    const result = await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(uid)
      const [userSnap, gameSnap] = await Promise.all([transaction.get(userRef), transaction.get(userGamificationRef(uid))])
      if (!userSnap.exists) {
        throw new Error('Cliente no encontrado.')
      }
      const state = { ...readGamificationFromDocs(gameSnap.data(), userSnap.data()) }
      const xp = Math.max(0, (typeof state.xp === 'number' ? state.xp : 0) + xpDelta)
      const adelinas = Math.max(0, (typeof state.adelinas === 'number' ? state.adelinas : 0) + adelinasDelta)
      const inventory = { ...((state.inventory as Record<string, number> | undefined) ?? {}) }
      for (const item of items) {
        const next = Math.max(0, (inventory[item.itemId] ?? 0) + item.quantity)
        if (next > 0) inventory[item.itemId] = next
        else delete inventory[item.itemId]
      }
      const next = { ...state, xp, adelinas, inventory }
      writeGamification(transaction, uid, next)
      return { xp, adelinas }
    })
    await audit(req, 'customer.adjust', uid, { xpDelta, adelinasDelta, items, reason })
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'No se pudo ajustar.' })
  }
})

router.post('/customers/:uid/block', async (req: Request, res: Response) => {
  const uid = cleanText(req.params.uid, 128)
  const blocked = req.body?.blocked === true
  try {
    const ref = adminDb.collection('users').doc(uid)
    const snap = await ref.get()
    if (!snap.exists || snap.get('role') === 'admin') {
      res.status(404).json({ error: 'Cliente no encontrado.' })
      return
    }
    await ref.set({ blocked, blockedAt: blocked ? FieldValue.serverTimestamp() : null }, { merge: true })
    await audit(req, blocked ? 'customer.block' : 'customer.unblock', uid, { reason: cleanText(req.body?.reason, 300) })
    res.json({ ok: true, blocked })
  } catch (error) {
    console.error('admin block error:', error)
    res.status(500).json({ error: 'No se pudo cambiar el bloqueo.' })
  }
})

/* ───────────── Restaurantes ───────────── */

router.get('/companies/:id/summary', async (req: Request, res: Response) => {
  const id = cleanText(req.params.id, 128)
  try {
    const reservations = adminDb.collection('reservations').where('companyId', '==', id)
    const now = Timestamp.now()
    const [companySnap, indexSnap, total, confirmed, completed, cancelled, upcoming, recentSnap, claims] = await Promise.all([
      adminDb.collection('companies').doc(id).get(),
      adminDb.collection('restaurantIndex').doc(id).get(),
      count(reservations),
      count(reservations.where('status', '==', 'confirmed')),
      count(reservations.where('status', '==', 'completed')),
      count(reservations.where('status', '==', 'cancelled')),
      count(reservations.where('status', '==', 'confirmed').where('startTime', '>=', now)),
      reservations.orderBy('startTime', 'desc').limit(10).get().catch(() => null),
      count(adminDb.collection('promotionClaims').where('companyId', '==', id)),
    ])
    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }
    const company = companySnap.data() ?? {}
    const index = indexSnap.data() ?? {}
    const reviewCount = typeof index.reviewCount === 'number' ? index.reviewCount : 0
    const ratingSum = typeof index.reviewRatingSum === 'number' ? index.reviewRatingSum : 0
    res.json({
      id,
      reservations: { total, confirmed, completed, cancelled, upcoming },
      promotionClaims: claims,
      reviews: { count: reviewCount, average: reviewCount > 0 ? ratingSum / reviewCount : null },
      billing: {
        planId: typeof company.planId === 'string' ? company.planId : 'free',
        planBilling: typeof company.planBilling === 'string' ? company.planBilling : null,
        planStartedAt: toIso(company.planStartedAt),
        planLastPaidAt: toIso(company.planLastPaidAt),
        pendingPlanId: typeof company.pendingPlanId === 'string' ? company.pendingPlanId : null,
        lemonSubscriptionId: typeof company.lemonSqueezySubscriptionId === 'string' ? company.lemonSqueezySubscriptionId : null,
        lemonPortalUrl: typeof company.lemonSqueezyPortalUrl === 'string' ? company.lemonSqueezyPortalUrl : null,
        lemonPending: company.lemonSqueezyPending === true,
      },
      slug: typeof index.slug === 'string' ? index.slug : '',
      deactivated: company.deactivated === true,
      recent: (recentSnap?.docs ?? []).map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          clientName: cleanText(data.clientName, 80),
          pax: typeof data.pax === 'number' ? data.pax : 0,
          status: typeof data.status === 'string' ? data.status : '',
          startTime: toIso(data.startTime),
        }
      }),
    })
  } catch (error) {
    console.error('admin company summary error:', error)
    res.status(500).json({ error: 'No se pudo cargar el resumen.' })
  }
})

router.post('/companies/:id/status', async (req: Request, res: Response) => {
  const id = cleanText(req.params.id, 128)
  const deactivated = req.body?.deactivated === true
  try {
    const ref = adminDb.collection('companies').doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }
    // deactivatedByAdmin impide que el propio restaurante se reactive desde su panel.
    const patch = {
      deactivated,
      deactivatedByAdmin: deactivated,
      deactivatedAt: deactivated ? FieldValue.serverTimestamp() : null,
    }
    await ref.set(patch, { merge: true })
    // El listado público lee restaurantIndex: se oculta o se vuelve a mostrar.
    await adminDb.collection('restaurantIndex').doc(id).set({ deactivated }, { merge: true }).catch(() => undefined)
    await audit(req, deactivated ? 'company.deactivate' : 'company.activate', id, { reason: cleanText(req.body?.reason, 300) })
    res.json({ ok: true, deactivated })
  } catch (error) {
    console.error('admin company status error:', error)
    res.status(500).json({ error: 'No se pudo cambiar el estado.' })
  }
})

/* ───────────── Comunicación ───────────── */

type BroadcastTarget = 'customer' | 'company' | 'allCustomers' | 'allCompanies'

router.post('/notify', async (req: Request, res: Response) => {
  const target = cleanText(req.body?.target, 20) as BroadcastTarget
  const id = cleanText(req.body?.id, 128)
  const title = cleanText(req.body?.title, 90)
  const body = cleanText(req.body?.body, 500)
  const actionUrl = cleanText(req.body?.actionUrl, 300)
  if (!['customer', 'company', 'allCustomers', 'allCompanies'].includes(target)) {
    res.status(400).json({ error: 'Elige a quién va el aviso.' })
    return
  }
  if (!title || !body) {
    res.status(400).json({ error: 'El aviso necesita título y texto.' })
    return
  }
  if (actionUrl && !actionUrl.startsWith('/')) {
    res.status(400).json({ error: 'El enlace debe ser una ruta de Adelia que empiece por «/».' })
    return
  }
  if ((target === 'customer' || target === 'company') && !id) {
    res.status(400).json({ error: 'Falta el destinatario.' })
    return
  }

  const sentAt = Date.now()
  const dedupeKey = `admin_${sentAt}`
  const now = Timestamp.now()
  const customerDoc = {
    type: 'admin_message',
    title,
    body,
    icon: '📣',
    read: false,
    readAt: null,
    createdAt: now,
    actionUrl: actionUrl || null,
    actionLabel: actionUrl ? 'Ver' : null,
    data: {},
    dedupeKey,
  }
  const companyDoc = { ...customerDoc, actionTab: 'reservations', actionLabel: null }

  try {
    let sent = 0
    if (target === 'customer') {
      const batch = adminDb.batch()
      batch.set(adminDb.collection('users').doc(id).collection('notifications').doc(dedupeKey), customerDoc)
      batch.set(adminDb.collection('users').doc(id), { notificationUnreadCount: FieldValue.increment(1) }, { merge: true })
      await batch.commit()
      sent = 1
    } else if (target === 'company') {
      const batch = adminDb.batch()
      batch.set(adminDb.collection('companies').doc(id).collection('notifications').doc(dedupeKey), companyDoc)
      batch.set(adminDb.collection('companyGamification').doc(id), { unreadCount: FieldValue.increment(1) }, { merge: true })
      await batch.commit()
      sent = 1
    } else {
      const isCustomers = target === 'allCustomers'
      let last: FirebaseFirestore.QueryDocumentSnapshot | null = null
      while (sent < MAX_BROADCAST) {
        let page = isCustomers
          ? adminDb.collection('users').where('role', '==', 'customer').orderBy('__name__').limit(200)
          : adminDb.collection('companies').orderBy('__name__').limit(200)
        if (last) page = page.startAfter(last)
        const snap = await page.select().get()
        if (snap.empty) break
        const batch = adminDb.batch()
        for (const doc of snap.docs) {
          if (isCustomers) {
            batch.set(doc.ref.collection('notifications').doc(dedupeKey), customerDoc)
            batch.set(doc.ref, { notificationUnreadCount: FieldValue.increment(1) }, { merge: true })
          } else {
            batch.set(doc.ref.collection('notifications').doc(dedupeKey), companyDoc)
            batch.set(adminDb.collection('companyGamification').doc(doc.id), { unreadCount: FieldValue.increment(1) }, { merge: true })
          }
        }
        await batch.commit()
        sent += snap.size
        last = snap.docs[snap.docs.length - 1]
      }
    }
    await audit(req, 'notify', target === 'customer' || target === 'company' ? `${target}:${id}` : target, { title, sent })
    res.json({ ok: true, sent, capped: sent >= MAX_BROADCAST })
  } catch (error) {
    console.error('admin notify error:', error)
    res.status(500).json({ error: 'No se pudo enviar el aviso.' })
  }
})

/* ───────────── Registro de cambios ───────────── */

router.get('/audit', async (req: Request, res: Response) => {
  const limit = cleanInt(req.query.limit ?? 60, 1, 200)
  try {
    const snap = await adminDb.collection(AUDIT_COLLECTION).orderBy('createdAt', 'desc').limit(limit).get()
    res.json({
      entries: snap.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          action: cleanText(data.action, 60),
          target: cleanText(data.target, 160),
          detail: data.detail && typeof data.detail === 'object' ? data.detail : {},
          createdAt: toIso(data.createdAt),
        }
      }),
    })
  } catch (error) {
    console.error('admin audit error:', error)
    res.status(500).json({ error: 'No se pudo cargar el registro.' })
  }
})

/** El panel apunta aquí los cambios que hace directamente en la base (catálogo, planes...). */
router.post('/audit', async (req: Request, res: Response) => {
  const action = cleanText(req.body?.action, 60)
  const target = cleanText(req.body?.target, 160)
  if (!action) {
    res.status(400).json({ error: 'Falta la acción.' })
    return
  }
  const raw = req.body?.detail && typeof req.body.detail === 'object' ? JSON.stringify(req.body.detail) : '{}'
  const detail = raw.length <= 4000 ? JSON.parse(raw) as Record<string, unknown> : { resumen: raw.slice(0, 4000) }
  await audit(req, action, target, detail)
  res.status(204).end()
})

export default router
