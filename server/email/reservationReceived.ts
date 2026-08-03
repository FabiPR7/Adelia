import { Resend } from 'resend'
import { EMAIL_FROM, EMAIL_REPLY_TO, getResendApiKey } from './config.ts'
import {
  buildReservationEmailHtml,
  buildReservationEmailSubject,
  buildReservationEmailText,
  type ReservationEmailBuildData,
} from './buildReservationEmail.ts'
import { getAdeliaEmailLogoAttachmentsForSend } from './emailLogo.ts'

export type ReservationReceivedEmailData = ReservationEmailBuildData

export function buildReservationReceivedSubject(data: ReservationEmailBuildData): string {
  return buildReservationEmailSubject({ ...data, kind: 'received' })
}

export function buildReservationReceivedHtml(
  data: ReservationEmailBuildData,
  options?: { logoMode?: 'cid' | 'data' | 'remote' },
): string {
  return buildReservationEmailHtml({ ...data, kind: 'received' }, options)
}

export function buildReservationReceivedText(data: ReservationEmailBuildData): string {
  return buildReservationEmailText({ ...data, kind: 'received' })
}

export async function sendReservationReceivedEmail(
  data: ReservationEmailBuildData & { to: string },
  apiKey = getResendApiKey(),
): Promise<void> {
  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurada.')
  }

  const resend = new Resend(apiKey)
  const payload = { ...data, kind: 'received' as const }
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
