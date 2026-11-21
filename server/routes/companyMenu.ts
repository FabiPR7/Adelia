import { Router, type Request, type Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'
import { forgetPublicCompanyMenu } from '../data/publicMenu.ts'
import { serializeMenuBoard, serializeMenuNode } from '../../src/utils/menuSerialize.ts'
import type { MenuBoardInput, MenuNodeInput } from '../../src/types/company.ts'

// La carta del local desde el panel: cartas (menuBoards) y apartados/productos
// (menuNodes). El servidor comprueba que eres el dueño y guarda con las mismas
// reglas que la web (src/utils/menuSerialize.ts).

const router = Router()
type Params = Record<string, string>

// Al cambiar la carta, la copia pública guardada en memoria se olvida.
router.use('/:companyId/menu', (req: Request<Params>, res: Response, next) => {
  if (req.method !== 'GET') {
    const companyId = req.params.companyId
    res.on('finish', () => {
      if (res.statusCode < 400 && idOk(companyId)) forgetPublicCompanyMenu(companyId)
    })
  }
  next()
})

const MAX_BOARDS = 40
const MAX_NODES_PER_REQUEST = 2000
const idOk = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)

const boards = (companyId: string) => adminDb.collection('companies').doc(companyId).collection('menuBoards')
const nodes = (companyId: string) => adminDb.collection('companies').doc(companyId).collection('menuNodes')

function fail(res: Response, error: unknown, label: string) {
  console.error(`Company menu ${label} error:`, error)
  res.status(500).json({ error: 'No se pudo guardar la carta.' })
}

async function commitInChunks(writes: Array<(batch: FirebaseFirestore.WriteBatch) => void>) {
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = adminDb.batch()
    writes.slice(offset, offset + 400).forEach((write) => write(batch))
    await batch.commit()
  }
}

// ----- Cartas -----

router.post('/:companyId/menu/boards', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const count = await boards(companyId).count().get()
    if (count.data().count >= MAX_BOARDS) {
      res.status(409).json({ error: 'Has llegado al máximo de cartas.' })
      return
    }
    const data = serializeMenuBoard(companyId, req.body as MenuBoardInput)
    if (!data.name) {
      res.status(400).json({ error: 'Ponle un nombre a la carta.' })
      return
    }
    const ref = await boards(companyId).add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.status(201).json({ id: ref.id })
  } catch (error) {
    fail(res, error, 'board create')
  }
})

router.put('/:companyId/menu/boards/:boardId', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId, boardId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    if (!idOk(boardId)) {
      res.status(400).json({ error: 'Carta no válida.' })
      return
    }
    const data = serializeMenuBoard(companyId, req.body as MenuBoardInput)
    await boards(companyId).doc(boardId).update({ ...data, updatedAt: FieldValue.serverTimestamp() })
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 'board update')
  }
})

router.patch('/:companyId/menu/boards/:boardId/active', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId, boardId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const { active } = req.body as { active?: unknown }
    if (!idOk(boardId) || typeof active !== 'boolean') {
      res.status(400).json({ error: 'Datos no válidos.' })
      return
    }
    await boards(companyId).doc(boardId).update({ active, updatedAt: FieldValue.serverTimestamp() })
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 'board active')
  }
})

router.delete('/:companyId/menu/boards/:boardId', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId, boardId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    if (!idOk(boardId)) {
      res.status(400).json({ error: 'Carta no válida.' })
      return
    }
    const boardNodes = await nodes(companyId).where('boardId', '==', boardId).get()
    await commitInChunks([
      ...boardNodes.docs.map((item) => (batch: FirebaseFirestore.WriteBatch) => batch.delete(item.ref)),
      (batch) => batch.delete(boards(companyId).doc(boardId)),
    ])
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 'board delete')
  }
})

router.put('/:companyId/menu/boards-order', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const ids = (req.body as { boardIds?: unknown }).boardIds
    if (!Array.isArray(ids) || ids.length > MAX_BOARDS || !ids.every(idOk)) {
      res.status(400).json({ error: 'Orden no válido.' })
      return
    }
    await commitInChunks(
      ids.map((boardId, index) => (batch: FirebaseFirestore.WriteBatch) =>
        batch.update(boards(companyId).doc(boardId), { sortOrder: index, updatedAt: FieldValue.serverTimestamp() })),
    )
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 'boards order')
  }
})

// ----- Apartados y productos -----

router.post('/:companyId/menu/nodes', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const data = serializeMenuNode(companyId, req.body as MenuNodeInput)
    if (!data.name || !idOk(data.boardId)) {
      res.status(400).json({ error: 'Falta el nombre o la carta.' })
      return
    }
    const ref = await nodes(companyId).add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.status(201).json({ id: ref.id })
  } catch (error) {
    fail(res, error, 'node create')
  }
})

/** Alta de muchos a la vez (importar o duplicar una carta). Cada uno trae su id. */
router.post('/:companyId/menu/nodes/batch', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const inputs = (req.body as { nodes?: unknown }).nodes
    if (!Array.isArray(inputs) || inputs.length > MAX_NODES_PER_REQUEST) {
      res.status(400).json({ error: 'Lista de productos no válida.' })
      return
    }
    const rows = inputs.map((item) => item as MenuNodeInput & { id?: unknown })
    if (!rows.every((row) => idOk(row.id))) {
      res.status(400).json({ error: 'Lista de productos no válida.' })
      return
    }
    await commitInChunks(
      rows.map((row) => (batch: FirebaseFirestore.WriteBatch) =>
        batch.set(nodes(companyId).doc(row.id as string), {
          ...serializeMenuNode(companyId, row),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })),
    )
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 'nodes batch')
  }
})

router.put('/:companyId/menu/nodes/:nodeId', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId, nodeId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    if (!idOk(nodeId)) {
      res.status(400).json({ error: 'Producto no válido.' })
      return
    }
    const data = serializeMenuNode(companyId, req.body as MenuNodeInput)
    await nodes(companyId).doc(nodeId).update({ ...data, updatedAt: FieldValue.serverTimestamp() })
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 'node update')
  }
})

router.post('/:companyId/menu/nodes/delete', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const ids = (req.body as { nodeIds?: unknown }).nodeIds
    if (!Array.isArray(ids) || ids.length > MAX_NODES_PER_REQUEST || !ids.every(idOk)) {
      res.status(400).json({ error: 'Lista no válida.' })
      return
    }
    await commitInChunks(ids.map((nodeId) => (batch: FirebaseFirestore.WriteBatch) => batch.delete(nodes(companyId).doc(nodeId))))
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 'nodes delete')
  }
})

router.put('/:companyId/menu/nodes-order', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const updates = (req.body as { updates?: unknown }).updates
    if (!Array.isArray(updates) || updates.length > MAX_NODES_PER_REQUEST) {
      res.status(400).json({ error: 'Orden no válido.' })
      return
    }
    const rows = updates.map((item) => (item ?? {}) as { nodeId?: unknown; sortOrder?: unknown; parentId?: unknown })
    if (!rows.every((row) => idOk(row.nodeId) && Number.isFinite(Number(row.sortOrder)))) {
      res.status(400).json({ error: 'Orden no válido.' })
      return
    }
    await commitInChunks(
      rows.map((row) => (batch: FirebaseFirestore.WriteBatch) => {
        const payload: Record<string, unknown> = {
          sortOrder: Math.trunc(Number(row.sortOrder)),
          updatedAt: FieldValue.serverTimestamp(),
        }
        if (row.parentId !== undefined) {
          payload.parentId = row.parentId === null ? null : idOk(row.parentId) ? row.parentId : null
        }
        batch.update(nodes(companyId).doc(row.nodeId as string), payload)
      }),
    )
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 'nodes order')
  }
})

export default router
