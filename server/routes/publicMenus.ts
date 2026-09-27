import { Router, type Request, type Response } from 'express'
import { listPublicCompanyMenu } from '../data/publicMenu.ts'
import { allowPublicCache } from '../security/httpCache.ts'
import { asId } from '../security/validate.ts'

const router = Router()

router.get('/:companyId', async (req: Request, res: Response) => {
  try {
    const companyId = asId(req.params.companyId, 'Restaurante')
    const boardIdRaw = typeof req.query.boardId === 'string' ? req.query.boardId.trim() : ''
    const boardId = boardIdRaw && boardIdRaw.length <= 80 ? boardIdRaw : undefined
    const menu = await listPublicCompanyMenu(companyId, boardId)
    allowPublicCache(res, 45, 90)
    res.json(menu)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar la carta.'
    res.status(message.includes('Restaurante') ? 400 : 500).json({ error: message })
  }
})

export default router
