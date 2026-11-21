import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'

/**
 * Informes de clientes y productos: necesitan el año entero (clientes nuevos o que
 * repiten, evolución). Antes el panel lo leía directo con un tope de 800 reservas y
 * las cifras de un local con mucho movimiento salían cortas. Ahora lo lee el
 * servidor por páginas (hasta 10.000) y lo guarda 5 minutos por local y año.
 */
const router = Router()

const PAGE_SIZE = 1000
const MAX_ROWS = 10_000
const CACHE_MS = 5 * 60_000
const MAX_CACHE_ENTRIES = 200

type Row = Record<string, unknown>
const cache = new Map<string, { at: number; rows: Row[]; truncated: boolean }>()

// Solo lo que usan los informes (nunca el enlace de cancelar).
const FIELDS = [
  'companyId', 'tableId', 'clientName', 'clientEmail', 'clientPhone', 'pax', 'notes',
  'startTime', 'endTime', 'status', 'createdAt', 'customerUid', 'promotionId',
  'minimumSpendCents', 'promotionVisitStatus', 'minSpendVerification',
  'depositAmountCents', 'cancelledBy', 'noShow', 'depositStatus',
] as const

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(serialize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialize(item)]))
  }
  return value
}

async function loadYear(companyId: string, year: number): Promise<{ rows: Row[]; truncated: boolean }> {
  // 1 de enero a las 00:00 en España (UTC+1 en invierno), como el panel.
  const start = Timestamp.fromDate(new Date(Date.UTC(year, 0, 1) - 60 * 60_000))
  const end = Timestamp.fromDate(new Date(Date.UTC(year + 1, 0, 1) - 60 * 60_000))
  const rows: Row[] = []
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null
  for (;;) {
    let query = adminDb.collection('reservations')
      .where('companyId', '==', companyId)
      .where('startTime', '>=', start)
      .where('startTime', '<', end)
      .orderBy('startTime', 'asc')
      .select(...FIELDS)
      .limit(PAGE_SIZE)
    if (last) query = query.startAfter(last)
    const snap = await query.get()
    for (const docSnap of snap.docs) {
      rows.push({ id: docSnap.id, ...(serialize(docSnap.data()) as Row) })
    }
    if (snap.size < PAGE_SIZE || rows.length >= MAX_ROWS) {
      return { rows: rows.slice(0, MAX_ROWS), truncated: rows.length >= MAX_ROWS && snap.size === PAGE_SIZE }
    }
    last = snap.docs[snap.docs.length - 1]
  }
}

router.get('/:companyId/reports/reservations', async (req: Request<Record<string, string>>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const year = Number(req.query.year)
    const thisYear = new Date().getFullYear()
    if (!Number.isInteger(year) || year < 2020 || year > thisYear + 1) {
      res.status(400).json({ error: 'Año no válido.' })
      return
    }
    const key = `${companyId}:${year}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS && req.query.fresh !== '1') {
      res.json({ reservations: hit.rows, truncated: hit.truncated })
      return
    }
    const { rows, truncated } = await loadYear(companyId, year)
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string)
    cache.set(key, { at: Date.now(), rows, truncated })
    res.json({ reservations: rows, truncated })
  } catch (error) {
    console.error('company reports error:', error)
    res.status(500).json({ error: 'No se pudo cargar el informe.' })
  }
})

export default router
