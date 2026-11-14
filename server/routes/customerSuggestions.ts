import { Router, type Request, type Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { takeSuggestion } from '../security/rateLimit.ts'
import { sendSupportInboxEmail } from '../email/supportInbox.ts'

/**
 * Buzón de sugerencias de los clientes: ideas, fallos o lo que quieran
 * contarnos. Solo lo lee el administrador (panel → Moderación) y llega por
 * correo a soporte.
 */
export const SUGGESTIONS = 'suggestions'

export const SUGGESTION_TOPICS = {
  idea: 'Idea o mejora',
  bug: 'Algo no funciona',
  restaurant: 'Quiero un restaurante en Adelia',
  other: 'Otra cosa',
} as const

export type SuggestionTopic = keyof typeof SUGGESTION_TOPICS

function cleanMessage(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000)
    : ''
}

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const topic = String(req.body?.topic ?? '') as SuggestionTopic
    const message = cleanMessage(req.body?.message)

    if (!(topic in SUGGESTION_TOPICS)) {
      res.status(400).json({ error: 'Elige de qué trata tu sugerencia.' })
      return
    }
    if (message.length < 10) {
      res.status(400).json({ error: 'Cuéntanos un poco más (al menos 10 caracteres).' })
      return
    }
    if (!(await takeSuggestion(customer.uid))) {
      res.status(429).json({ error: 'Has enviado muchas sugerencias hoy. Inténtalo mañana.' })
      return
    }

    const customerName = String(customer.data.displayName ?? '').slice(0, 80)
    const ref = await adminDb.collection(SUGGESTIONS).add({
      customerUid: customer.uid,
      customerName,
      customerEmail: customer.email,
      topic,
      topicLabel: SUGGESTION_TOPICS[topic],
      message,
      status: 'new',
      adminNote: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await sendSupportInboxEmail({
      subject: `Sugerencia · ${SUGGESTION_TOPICS[topic]}`,
      heading: 'Nueva sugerencia de un cliente',
      fields: [
        ['Tema', SUGGESTION_TOPICS[topic]],
        ['Cliente', `${customerName} · ${customer.email}`],
      ],
      message,
      replyTo: customer.email,
    }).catch((error) => console.error('suggestion email error:', error))

    res.status(201).json({ ok: true, id: ref.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const isAuth = /autorizado|cliente|Perfil no encontrado/.test(message)
    res.status(isAuth ? 401 : 500).json({ error: isAuth ? message : 'No se pudo enviar la sugerencia.' })
  }
})

export default router
