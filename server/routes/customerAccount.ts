import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { deleteCustomerAccount } from '../data/deleteCustomerAccount.ts'
import {
  IdentityError,
  cleanDisplayName,
  displayNameError,
  isUsernameTaken,
  normalizeUsername,
  updateCustomerIdentity,
  usernameError,
} from '../data/usernames.ts'
import { takeUsernameChange } from '../security/rateLimit.ts'

const router = Router()

function authStatus(message: string): number | null {
  return /autorizado|cliente|Perfil no encontrado/.test(message) ? 401 : null
}

/** ¿Está libre este @usuario? Para comprobarlo mientras se escribe. */
router.get('/username-available', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const username = normalizeUsername(req.query.u)
    const error = usernameError(username)
    if (error) {
      res.json({ available: false, username, error })
      return
    }
    const taken = await isUsernameTaken(username, customer.uid)
    res.json({ available: !taken, username, error: taken ? `@${username} ya está cogido.` : null })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    res.status(authStatus(message) ?? 500).json({ error: authStatus(message) ? message : 'No se pudo comprobar.' })
  }
})

/** Cambiar nombre visible y/o @usuario. */
router.post('/identity', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const input: { displayName?: string; username?: string } = {}

    if (req.body?.displayName !== undefined) {
      const name = cleanDisplayName(req.body.displayName)
      const nameError = displayNameError(name)
      if (nameError) {
        res.status(400).json({ error: nameError })
        return
      }
      input.displayName = name
    }

    if (req.body?.username !== undefined) {
      const username = normalizeUsername(req.body.username)
      const error = usernameError(username)
      if (error) {
        res.status(400).json({ error })
        return
      }
      input.username = username
    }

    if (input.displayName === undefined && input.username === undefined) {
      res.status(400).json({ error: 'No hay nada que cambiar.' })
      return
    }

    if (input.username !== undefined && !(await takeUsernameChange(customer.uid))) {
      res.status(429).json({ error: 'Has cambiado tu @usuario muchas veces hoy. Inténtalo mañana.' })
      return
    }

    const result = await updateCustomerIdentity(customer.uid, input)
    res.json(result)
  } catch (error) {
    if (error instanceof IdentityError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    const message = error instanceof Error ? error.message : ''
    console.error('identity update error:', error)
    res.status(authStatus(message) ?? 500).json({ error: authStatus(message) ? message : 'No se pudo guardar.' })
  }
})

router.post('/delete', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const confirm = typeof req.body?.confirm === 'string' ? req.body.confirm.trim().toUpperCase() : ''
    if (confirm !== 'ELIMINAR') {
      res.status(400).json({ error: 'Escribe ELIMINAR para confirmar la baja de tu cuenta.' })
      return
    }

    await deleteCustomerAccount(customer.uid)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete customer account error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.'
    const status = message.includes('autorizado') || message.includes('cliente') || message.includes('Perfil')
      ? 401
      : message.includes('Solo se pueden') || message.includes('no encontrada')
        ? 400
        : 500
    res.status(status).json({ error: message })
  }
})

export default router
