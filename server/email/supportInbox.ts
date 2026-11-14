import { Resend } from 'resend'
import { APP_URL, EMAIL_FROM, getResendApiKey, isValidClientEmail } from './config.ts'
import { escapeHtml } from './emailLayout.ts'

/** Buzón donde llegan los reportes de restaurantes y las sugerencias. */
export const SUPPORT_INBOX = process.env.SUPPORT_EMAIL?.trim() || 'contacto@adeliareservas.com'

export interface SupportInboxEmail {
  subject: string
  heading: string
  fields: Array<[label: string, value: string]>
  message: string
  /** Correo de quien escribe: «Responder» le contesta directamente. */
  replyTo?: string
}

/**
 * Aviso a soporte. Si no hay clave de correo no hace nada: el reporte ya está
 * guardado y se ve en el panel de administración (Moderación).
 */
export async function sendSupportInboxEmail(
  email: SupportInboxEmail,
  apiKey = getResendApiKey(),
): Promise<void> {
  if (!apiKey) {
    return
  }

  const rows = email.fields
    .filter(([, value]) => value.trim())
    .map(([label, value]) => (
      `<tr><td style="padding:4px 12px 4px 0;color:#7a6b5d;white-space:nowrap">${escapeHtml(label)}</td>`
      + `<td style="padding:4px 0;color:#3d3229">${escapeHtml(value)}</td></tr>`
    ))
    .join('')
  const adminUrl = `${APP_URL}/admin`
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#faf7f2;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ddd0be;border-radius:12px;padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;color:#3d3229">${escapeHtml(email.heading)}</h1>
<table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">${rows}</table>
<p style="margin:0 0 6px;font-size:13px;color:#7a6b5d">Mensaje</p>
<div style="white-space:pre-wrap;font-size:15px;line-height:1.5;color:#3d3229;background:#faf7f2;border-radius:8px;padding:12px">${escapeHtml(email.message)}</div>
<p style="margin:20px 0 0;font-size:13px"><a href="${escapeHtml(adminUrl)}" style="color:#a63c18">Abrir el panel de administración → Moderación</a></p>
</div></body></html>`
  const text = [
    email.heading,
    '',
    ...email.fields.filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value}`),
    '',
    email.message,
    '',
    `Panel: ${adminUrl}`,
  ].join('\n')

  const resend = new Resend(apiKey)
  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: SUPPORT_INBOX,
    ...(email.replyTo && isValidClientEmail(email.replyTo) ? { replyTo: email.replyTo } : {}),
    subject: email.subject.slice(0, 180),
    html,
    text,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}
