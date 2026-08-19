import { Router, type Request, type Response } from 'express'
import {
  DEFAULT_CONFIRMATION_TEMPLATE,
  DEFAULT_RECEIVED_TEMPLATE,
  normalizeReservationEmailTemplate,
  type EmailTemplateKind,
} from '../email/emailTemplateDefaults.ts'
import {
  buildReservationEmailHtml,
  buildReservationEmailSubject,
  buildSampleReservationEmailData,
} from '../email/buildReservationEmail.ts'
import { adminDb } from '../firebase-admin.ts'
import { readCompanyOps } from '../data/companyOps.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'

const router = Router()

router.post('/:companyId/email-preview', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await ensureCompanyOwner(req, res, companyId))) {
      return
    }

    const { kind, template } = req.body as {
      kind?: EmailTemplateKind
      template?: Record<string, unknown>
    }

    if (kind !== 'received' && kind !== 'confirmation') {
      res.status(400).json({ error: 'Tipo de plantilla no válido.' })
      return
    }

    const company = await readCompanyOps(companyId)

    if (!company) {
      res.status(404).json({ error: 'Empresa no encontrada.' })
      return
    }

    const defaults = kind === 'received' ? DEFAULT_RECEIVED_TEMPLATE : DEFAULT_CONFIRMATION_TEMPLATE
    const normalizedTemplate = normalizeReservationEmailTemplate(template, defaults)
    const payload = buildSampleReservationEmailData(kind, company, normalizedTemplate)
    const html = buildReservationEmailHtml(payload, { logoMode: 'data' })
    const subject = buildReservationEmailSubject(payload)

    res.json({ html, subject })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar la vista previa.'
    res.status(500).json({ error: message })
  }
})

export default router
