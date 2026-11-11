import { Resend } from 'resend'
import { EMAIL_FROM, EMAIL_REPLY_TO, APP_URL, getResendApiKey } from './config.ts'
import {
  buildAdeliaEmailFooter,
  buildReservationDetailsTable,
  escapeHtml,
} from './emailLayout.ts'
import { getAdeliaEmailLogoAttachmentsForSend } from './emailLogo.ts'
import { capitalizeSpanish, formatDateSpanish, formatPhoneDisplay, formatTimeSpanish } from './format.ts'

export interface ReservationCancelledEmailData {
  to: string
  clientName: string
  restaurantName: string
  restaurantSlug: string
  restaurantPhone: string
  date: Date
  pax: number
  cancelledBy: 'client' | 'restaurant'
  /** `captured`: se cobró la fianza; `released`: se liberó; `null`: no había fianza. */
  depositOutcome: 'captured' | 'released' | null
  depositAmountCents: number | null
}

function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

function introText(data: ReservationCancelledEmailData): string {
  const name = data.clientName.trim() || 'Hola'
  return data.cancelledBy === 'client'
    ? `${name}, hemos cancelado tu reserva en ${data.restaurantName.trim()} tal y como pediste.`
    : `${name}, ${data.restaurantName.trim()} ha tenido que cancelar tu reserva. Lo sentimos.`
}

function depositText(data: ReservationCancelledEmailData): string | null {
  if (!data.depositAmountCents || !data.depositOutcome) {
    return null
  }
  const amount = formatEuros(data.depositAmountCents)
  return data.depositOutcome === 'captured'
    ? `Según la política de cancelación del restaurante, se ha cobrado la fianza de ${amount}.`
    : `La fianza de ${amount} se ha liberado: no se te cobra nada.`
}

export function buildReservationCancelledSubject(data: ReservationCancelledEmailData): string {
  const dateLabel = capitalizeSpanish(formatDateSpanish(data.date))
  return `Reserva cancelada — ${data.restaurantName.trim()} — ${dateLabel}`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:12px 0;border-top:1px solid #eee;color:#666;font-size:14px;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:12px 0;border-top:1px solid #eee;color:#111;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`
}

export function buildReservationCancelledHtml(
  data: ReservationCancelledEmailData,
  options?: { logoMode?: 'cid' | 'data' | 'remote' },
): string {
  const deposit = depositText(data)
  const rows = [
    row('Fecha', capitalizeSpanish(formatDateSpanish(data.date))),
    row('Hora', formatTimeSpanish(data.date)),
    row('Comensales', String(data.pax)),
    ...(data.restaurantPhone.trim() ? [row('Teléfono', formatPhoneDisplay(data.restaurantPhone))] : []),
  ].join('')

  const rebook = data.restaurantSlug
    ? `<p style="margin:24px 0 0;text-align:center;"><a href="${escapeHtml(`${APP_URL}/reservar/${encodeURIComponent(data.restaurantSlug)}`)}" style="display:inline-block;padding:12px 22px;background:#6b5344;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Reservar otra mesa</a></p>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reserva cancelada</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
          <tr>
            <td style="padding:28px 28px 16px;background:#5c4a3a;color:#fff;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;margin-bottom:8px;">Reserva cancelada</div>
              <div style="font-size:28px;line-height:1.2;font-weight:700;">${escapeHtml(data.restaurantName.trim())}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">${escapeHtml(introText(data))}</p>
              ${buildReservationDetailsTable(rows)}
              ${deposit ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#374151;">${escapeHtml(deposit)}</p>` : ''}
              ${rebook}
            </td>
          </tr>
          ${buildAdeliaEmailFooter({ logoMode: options?.logoMode })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildReservationCancelledText(data: ReservationCancelledEmailData): string {
  const lines = [
    introText(data),
    '',
    `Fecha: ${capitalizeSpanish(formatDateSpanish(data.date))}`,
    `Hora: ${formatTimeSpanish(data.date)}`,
    `Comensales: ${data.pax}`,
  ]
  const deposit = depositText(data)
  if (deposit) {
    lines.push('', deposit)
  }
  if (data.restaurantSlug) {
    lines.push('', `Reservar otra mesa: ${APP_URL}/reservar/${data.restaurantSlug}`)
  }
  lines.push('', 'Reserva gestionada con adeliareservas — https://adeliareservas.com')
  return lines.join('\n')
}

export async function sendReservationCancelledEmail(
  data: ReservationCancelledEmailData,
  apiKey = getResendApiKey(),
): Promise<void> {
  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurada.')
  }

  const result = await new Resend(apiKey).emails.send({
    from: EMAIL_FROM,
    to: data.to.trim(),
    replyTo: EMAIL_REPLY_TO,
    subject: buildReservationCancelledSubject(data),
    html: buildReservationCancelledHtml(data, { logoMode: 'cid' }),
    text: buildReservationCancelledText(data),
    attachments: getAdeliaEmailLogoAttachmentsForSend(),
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}
