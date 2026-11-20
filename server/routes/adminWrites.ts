import { Router, type Request, type Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { verifySignedInUser } from '../auth/verifyRequest.ts'
import { AUDIT_COLLECTION } from './admin.ts'
import { slugify, slugToAuthEmail } from '../../src/utils/helpers.ts'
import { computeReviewAdelinas } from '../../src/types/review.ts'

// Escrituras del panel de administración. Antes el navegador del admin escribía
// directamente en la base de datos; ahora pasa por aquí (ya protegido con verifyAdmin
// al montar /api/admin) y queda apuntado en el registro de acciones del admin.

const router = Router()

/** Documentos que el admin puede cambiar desde los catálogos (nada más). */
const ALLOWED_PATHS: RegExp[] = [
  /^planCatalog\/[A-Za-z0-9_-]{1,40}$/,
  /^appConfig\/(planCapabilities|billing)$/,
  /^inventoryItems\/[A-Za-z0-9_-]{1,80}$/,
  /^gameConfig\/(rewards|penalties|company|adelia)$/,
  /^companyLevelCatalog\/[0-9]{1,3}$/,
  /^companyMissionCatalog\/[A-Za-z0-9_-]{1,80}$/,
  /^levelCatalog\/[0-9]{1,3}$/,
  /^missionCatalog\/[A-Za-z0-9_-]{1,80}$/,
]
const MAX_OPS = 400

interface CatalogOp {
  type: 'set' | 'delete'
  path: string
  data?: Record<string, unknown>
  merge?: boolean
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
  }).catch(() => undefined)
}

/** Guarda catálogos (planes, ítems, juego…) en un solo lote. */
router.post('/catalog/batch', async (req: Request, res: Response) => {
  try {
    const ops = (req.body as { ops?: unknown }).ops
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > MAX_OPS) {
      res.status(400).json({ error: 'Cambios no válidos.' })
      return
    }
    const parsed: CatalogOp[] = []
    for (const raw of ops) {
      const op = (raw ?? {}) as Partial<CatalogOp>
      if ((op.type !== 'set' && op.type !== 'delete') || typeof op.path !== 'string' || !ALLOWED_PATHS.some((re) => re.test(op.path!))) {
        res.status(400).json({ error: `Ruta no permitida: ${String(op.path ?? '')}` })
        return
      }
      if (op.type === 'set' && (!op.data || typeof op.data !== 'object' || Array.isArray(op.data))) {
        res.status(400).json({ error: 'Datos no válidos.' })
        return
      }
      parsed.push({ type: op.type, path: op.path, data: op.data, merge: op.merge === true })
    }
    const batch = adminDb.batch()
    for (const op of parsed) {
      const ref = adminDb.doc(op.path)
      if (op.type === 'delete') {
        batch.delete(ref)
      } else {
        const data = { ...op.data, updatedAt: FieldValue.serverTimestamp() }
        if (op.merge) batch.set(ref, data, { merge: true })
        else batch.set(ref, data)
      }
    }
    await batch.commit()
    await audit(req, 'catalog.write', parsed.map((op) => op.path).slice(0, 20).join(', '), { count: parsed.length })
    res.json({ ok: true })
  } catch (error) {
    console.error('admin catalog batch error:', error)
    res.status(500).json({ error: 'No se pudo guardar el catálogo.' })
  }
})

/** Borra una reseña (y descuenta su nota del restaurante, solo si existía). */
router.post('/reviews/delete', async (req: Request, res: Response) => {
  try {
    const { companyId, customerUid, indexId } = req.body as Record<string, unknown>
    const idOk = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
    if (!idOk(companyId) || !idOk(customerUid)) {
      res.status(400).json({ error: 'Reseña no válida.' })
      return
    }
    const reviewRef = adminDb.collection('companies').doc(companyId).collection('reviews').doc(customerUid)
    const indexRef = idOk(indexId) ? adminDb.collection('reviewIndex').doc(indexId) : null
    const snap = await reviewRef.get()
    if (!snap.exists) {
      if (indexRef) await indexRef.delete().catch(() => undefined)
      res.json({ ok: true, deleted: false })
      return
    }
    const data = snap.data() ?? {}
    const rating = typeof data.rating === 'number' ? data.rating : 0
    const hasPhoto = data.hasPhoto === true
    const mediaItems = Array.isArray(data.mediaItems) ? data.mediaItems : []
    const adelinas = typeof data.adelinasEarned === 'number'
      ? data.adelinasEarned
      : computeReviewAdelinas(rating, hasPhoto, mediaItems as { type: 'image' | 'video'; url: string }[])
    await reviewRef.delete()
    if (indexRef) await indexRef.delete().catch(() => undefined)
    await adminDb.collection('companies').doc(companyId).update({
      reviewCount: FieldValue.increment(-1),
      reviewRatingSum: FieldValue.increment(-rating),
      reviewAdelinas: FieldValue.increment(-adelinas),
    }).catch(() => undefined)
    await audit(req, 'review.delete', `${companyId}/${customerUid}`, { rating })
    res.json({ ok: true, deleted: true })
  } catch (error) {
    console.error('admin review delete error:', error)
    res.status(500).json({ error: 'No se pudo borrar la reseña.' })
  }
})

/** Obliga al restaurante a cambiar la contraseña al entrar. */
router.post('/companies/:id/must-change-password', async (req: Request, res: Response) => {
  try {
    const companyId = String(req.params.id ?? '').trim()
    const ownerUid = typeof req.body?.ownerUid === 'string' ? req.body.ownerUid.trim() : ''
    if (!companyId || !ownerUid) {
      res.status(400).json({ error: 'Datos no válidos.' })
      return
    }
    const companySnap = await adminDb.collection('companies').doc(companyId).get()
    if (!companySnap.exists || companySnap.data()?.ownerUid !== ownerUid) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }
    await adminDb.collection('users').doc(ownerUid).update({ mustChangePassword: true })
    await adminDb.collection('companyCredentials').doc(companyId).set(
      { mustChangePassword: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    await audit(req, 'company.must-change-password', companyId, {})
    res.json({ ok: true })
  } catch (error) {
    console.error('admin must-change-password error:', error)
    res.status(500).json({ error: 'No se pudo marcar el cambio de contraseña.' })
  }
})

/** Repara el índice de acceso de todos los locales y borra contraseñas antiguas en claro. */
router.post('/login-index/sync', async (req: Request, res: Response) => {
  try {
    const [companiesSnap, credentialsSnap] = await Promise.all([
      adminDb.collection('companies').limit(500).get(),
      adminDb.collection('companyCredentials').limit(500).get(),
    ])
    const credentials = new Map(credentialsSnap.docs.map((item) => [item.id, item]))
    let synced = 0
    let cleaned = 0
    for (const companyDoc of companiesSnap.docs) {
      const cred = credentials.get(companyDoc.id)
      const credData = cred?.data() ?? {}
      if (cred && ('loginPassword' in credData || 'password' in credData)) {
        await cred.ref.update({ loginPassword: FieldValue.delete(), password: FieldValue.delete() })
        cleaned += 1
      }
      const loginName = (credData.loginName as string | undefined) ?? (companyDoc.data().name as string | undefined)
      const authEmail = (credData.authEmail as string | undefined) ?? slugToAuthEmail(String(companyDoc.data().slug ?? ''))
      const loginId = loginName ? slugify(loginName) : ''
      if (loginId && authEmail) {
        await adminDb.collection('logins').doc(loginId).set({
          loginName: loginName!.trim(),
          authEmail,
          role: 'company',
          companyId: companyDoc.id,
        })
        synced += 1
      }
    }
    await audit(req, 'login-index.sync', 'all', { synced, cleaned })
    res.json({ ok: true, synced, cleaned })
  } catch (error) {
    console.error('admin login index sync error:', error)
    res.status(500).json({ error: 'No se pudo sincronizar el acceso.' })
  }
})

export default router
