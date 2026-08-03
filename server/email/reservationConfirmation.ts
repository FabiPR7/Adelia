import { Resend } from 'resend'
import { EMAIL_FROM, EMAIL_REPLY_TO, getResendApiKey } from './config.ts'
import {
  buildReservationEmailHtml,
  buildReservationEmailSubject,
  buildReservationEmailText,
  type ReservationEmailBuildData,
} from './buildReservationEmail.ts'
import { getAdeliaEmailLogoAttachmentsForSend } from './emailLogo.ts'

export type ReservationConfirmationEmailData = ReservationEmailBuildData & {
  to: string
}

export function buildReservationConfirmationSubject(data: ReservationEmailBuildData): string {
  return buildReservationEmailSubject({ ...data, kind: 'confirmation' })
}

export function buildReservationConfirmationHtml(
  data: ReservationEmailBuildData,
  options?: { logoMode?: 'cid' | 'data' | 'remote' },
): string {
  return buildReservationEmailHtml({ ...data, kind: 'confirmation' }, options)
}

export function buildReservationConfirmationText(data: ReservationEmailBuildData): string {
  return buildReservationEmailText({ ...data, kind: 'confirmation' })
}

export async function sendReservationConfirmationEmail(
  data: ReservationConfirmationEmailData,
  apiKey = getResendApiKey(),
): Promise<void> {
  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurada.')
  }

  const resend = new Resend(apiKey)
  const payload = { ...data, kind: 'confirmation' as const }
  const subject = buildReservationEmailSubject(payload)

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: data.to.trim(),
    replyTo: EMAIL_REPLY_TO,
    subject,
    html: buildReservationEmailHtml(payload, { logoMode: 'cid' }),
    text: buildReservationEmailText(payload),
    attachments: getAdeliaEmailLogoAttachmentsForSend(),
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}
