import { Resend } from 'resend'
import { APP_URL, EMAIL_FROM, EMAIL_REPLY_TO, getResendApiKey } from './config.ts'
import {
  capitalizeSpanish,
  formatDateSpanish,
  formatPhoneDisplay,
  formatTimeSpanish,
} from './format.ts'

export interface ReservationConfirmationEmailData {
  to: string
  clientName: string
  restaurantName: string
  restaurantPhone: string
  restaurantLocation: string
  date: Date
  pax: number
  tableName: string
  notes?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildReservationConfirmationSubject(data: ReservationConfirmationEmailData): string {
  const dateLabel = capitalizeSpanish(formatDateSpanish(data.date))
  return `Reserva confirmada — ${data.restaurantName} — ${dateLabel}`
}

export function buildReservationConfirmationHtml(data: ReservationConfirmationEmailData): string {
  const clientName = escapeHtml(data.clientName.trim())
  const restaurantName = escapeHtml(data.restaurantName.trim())
  const dateLabel = escapeHtml(capitalizeSpanish(formatDateSpanish(data.date)))
  const timeLabel = escapeHtml(formatTimeSpanish(data.date))
  const tableName = escapeHtml(data.tableName.trim() || 'Mesa')
  const phone = escapeHtml(formatPhoneDisplay(data.restaurantPhone))
  const location = escapeHtml(data.restaurantLocation.trim())
  const notes = data.notes?.trim()
  const logoUrl = `${APP_URL}/adelia-logo.png`

  const locationBlock = location
    ? `<tr>
        <td style="padding:12px 0;border-top:1px solid #eee;color:#666;font-size:14px;width:120px;vertical-align:top;">Dirección</td>
        <td style="padding:12px 0;border-top:1px solid #eee;color:#111;font-size:14px;font-weight:600;">${location}</td>
      </tr>`
    : ''

  const notesBlock = notes
    ? `<tr>
        <td style="padding:12px 0;border-top:1px solid #eee;color:#666;font-size:14px;width:120px;vertical-align:top;">Notas</td>
        <td style="padding:12px 0;border-top:1px solid #eee;color:#111;font-size:14px;">${escapeHtml(notes)}</td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reserva confirmada</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
          <tr>
            <td style="padding:28px 28px 16px;background:linear-gradient(135deg,#6d28d9 0%,#9333ea 100%);color:#fff;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;margin-bottom:8px;">Confirmación de reserva</div>
              <div style="font-size:28px;line-height:1.2;font-weight:700;">${restaurantName}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#374151;">
                Hola <strong>${clientName}</strong>, tu reserva ha quedado confirmada. Estos son los detalles:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:12px 0;color:#666;font-size:14px;width:120px;vertical-align:top;">Fecha</td>
                  <td style="padding:12px 0;color:#111;font-size:14px;font-weight:600;">${dateLabel}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #eee;color:#666;font-size:14px;width:120px;vertical-align:top;">Hora</td>
                  <td style="padding:12px 0;border-top:1px solid #eee;color:#111;font-size:14px;font-weight:600;">${timeLabel}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #eee;color:#666;font-size:14px;width:120px;vertical-align:top;">Comensales</td>
                  <td style="padding:12px 0;border-top:1px solid #eee;color:#111;font-size:14px;font-weight:600;">${data.pax}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #eee;color:#666;font-size:14px;width:120px;vertical-align:top;">Mesa</td>
                  <td style="padding:12px 0;border-top:1px solid #eee;color:#111;font-size:14px;font-weight:600;">${tableName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #eee;color:#666;font-size:14px;width:120px;vertical-align:top;">Teléfono</td>
                  <td style="padding:12px 0;border-top:1px solid #eee;color:#111;font-size:14px;font-weight:600;">${phone}</td>
                </tr>
                ${locationBlock}
                ${notesBlock}
              </table>
              <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">
                Si necesitas modificar o cancelar tu reserva, contacta directamente con el restaurante.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;border-top:1px solid #f0f0f0;text-align:center;background:#fafafa;">
              <img src="${logoUrl}" alt="Adelia" width="120" style="display:block;margin:0 auto 10px;height:auto;" />
              <div style="font-size:12px;color:#9ca3af;">Reserva gestionada con Adelia</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildReservationConfirmationText(data: ReservationConfirmationEmailData): string {
  const lines = [
    `Hola ${data.clientName},`,
    '',
    `Tu reserva en ${data.restaurantName} ha quedado confirmada.`,
    '',
    `Fecha: ${capitalizeSpanish(formatDateSpanish(data.date))}`,
    `Hora: ${formatTimeSpanish(data.date)}`,
    `Comensales: ${data.pax}`,
    `Mesa: ${data.tableName || 'Mesa'}`,
    `Teléfono de contacto: ${formatPhoneDisplay(data.restaurantPhone)}`,
  ]

  if (data.restaurantLocation.trim()) {
    lines.push(`Dirección: ${data.restaurantLocation.trim()}`)
  }

  if (data.notes?.trim()) {
    lines.push(`Notas: ${data.notes.trim()}`)
  }

  lines.push('', 'Reserva gestionada con Adelia — https://adeliareservas.com')

  return lines.join('\n')
}

export async function sendReservationConfirmationEmail(
  data: ReservationConfirmationEmailData,
  apiKey = getResendApiKey(),
): Promise<void> {
  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurada.')
  }

  const resend = new Resend(apiKey)
  const subject = buildReservationConfirmationSubject(data)

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: data.to.trim(),
    replyTo: EMAIL_REPLY_TO,
    subject,
    html: buildReservationConfirmationHtml(data),
    text: buildReservationConfirmationText(data),
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}
