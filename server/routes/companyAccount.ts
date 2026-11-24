import { Router, type Request, type Response } from 'express'
import { adminAuth } from '../firebase-admin.ts'
import { ensureCompanyOwner, verifySignedInUser } from '../auth/verifyRequest.ts'

/**
 * Ajustes → Cuenta del panel del restaurante.
 * POST /:companyId/account/sign-out-everywhere: cierra la sesión del dueño en todos
 * sus dispositivos (los demás dejan de poder renovarla; como mucho dura una hora).
 */
const router = Router()

router.post('/:companyId/account/sign-out-everywhere', async (req: Request<Record<string, string>>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const user = await verifySignedInUser(req)
    await adminAuth.revokeRefreshTokens(user.uid)
    res.json({ ok: true })
  } catch (error) {
    console.error('company sign-out everywhere error:', error)
    res.status(500).json({ error: 'No se pudieron cerrar las sesiones.' })
  }
})

export default router
