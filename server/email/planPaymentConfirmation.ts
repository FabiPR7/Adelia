import { Resend } from 'resend'
import { APP_URL, EMAIL_FROM, EMAIL_REPLY_TO, getResendApiKey, isValidClientEmail } from './config.ts'
import { escapeHtml } from './emailLayout.ts'
import { getAdeliaEmailLogoAttachmentsForSend, getAdeliaEmailLogoImgSrc } from './emailLogo.ts'
import {
  SAAS_CHECKOUT_PLANS,
  SAAS_PLAN_HIGHLIGHTS,
  type SaasCheckoutPlanId,
} from '../stripe/saasCatalog.ts'

export interface PlanPaymentReceiptData {
  to: string
  restaurantName: string
  planId: SaasCheckoutPlanId
  amountCents: number
  paidAt: Date
  invoiceNumber?: string
  invoiceUrl?: string
  currency?: string
  renewal?: boolean
}

function formatMoney(cents: number, currency = 'eur'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatPaidAt(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(date)
}

export function buildPlanPaymentReceiptSubject(data: PlanPaymentReceiptData): string {
  const planName = SAAS_CHECKOUT_PLANS[data.planId].name
  return data.renewal
    ? `Pago recibido · Adelia ${planName}`
    : `Bienvenido a Adelia ${planName} · pago confirmado`
}

export function buildPlanPaymentReceiptText(data: PlanPaymentReceiptData): string {
  const plan = SAAS_CHECKOUT_PLANS[data.planId]
  const highlights = SAAS_PLAN_HIGHLIGHTS[data.planId]
  const lines = [
    `Hola${data.restaurantName ? `, equipo de ${data.restaurantName}` : ''},`,
    '',
    data.renewal
      ? `Hemos recibido tu pago de ${formatMoney(data.amountCents, data.currency)} del plan ${plan.name}. Sigue disfrutando de Adelia sin interrupciones.`
      : `Hemos recibido tu pago. ${data.restaurantName || 'Tu restaurante'} ya está en el plan ${plan.name}.`,
    '',
    `Importe: ${formatMoney(data.amountCents, data.currency)} / mes + IVA`,
    `Fecha: ${formatPaidAt(data.paidAt)}`,
    data.invoiceNumber ? `Factura: ${data.invoiceNumber}` : '',
    '',
    'Disfruta de los beneficios de tu plan:',
    ...highlights.map((item) => `· ${item}`),
    '',
    `Panel: ${APP_URL}/panel?tab=plan`,
    data.invoiceUrl ? `Ver factura: ${data.invoiceUrl}` : '',
    '',
    'Si necesitas cambiar los datos fiscales, responde a este correo.',
    '',
    '— Adelia Reservas',
  ]
  return lines.filter((line) => line !== undefined).join('\n')
}

export function buildPlanPaymentReceiptHtml(
  data: PlanPaymentReceiptData,
  options?: { logoMode?: 'cid' | 'data' | 'remote' },
): string {
  const plan = SAAS_CHECKOUT_PLANS[data.planId]
  const highlights = SAAS_PLAN_HIGHLIGHTS[data.planId]
  const restaurantName = escapeHtml(data.restaurantName || 'tu restaurante')
  const planName = escapeHtml(plan.name)
  const amount = escapeHtml(formatMoney(data.amountCents, data.currency))
  const paidAt = escapeHtml(formatPaidAt(data.paidAt))
  const invoiceNumber = data.invoiceNumber ? escapeHtml(data.invoiceNumber) : ''
  const invoiceUrl = data.invoiceUrl ? escapeHtml(data.invoiceUrl) : ''
  const panelUrl = escapeHtml(`${APP_URL}/panel?tab=plan`)
  const logoMode = options?.logoMode ?? 'cid'
  const logoUrl = getAdeliaEmailLogoImgSrc(logoMode, `${APP_URL}/adelia-logo-email.png`)
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="Adelia" width="120" style="display:block;margin:0 auto 10px;height:auto;" />`
    : `<div style="font-size:18px;font-weight:700;color:#8b7355;margin-bottom:10px;">Adelia</div>`

  const highlightRows = highlights
    .map((item) => `
      <tr>
        <td style="padding:0 0 10px;font-size:15px;line-height:1.5;color:#374151;vertical-align:top;width:28px;">✓</td>
        <td style="padding:0 0 10px;font-size:15px;line-height:1.55;color:#374151;">${escapeHtml(item)}</td>
      </tr>`)
    .join('')

  const invoiceButton = invoiceUrl
    ? `<a href="${invoiceUrl}" style="display:inline-block;margin-left:10px;padding:13px 22px;background:#ffffff;color:#8b7355;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;border:1px solid #d9cbb8;">
        Ver factura
      </a>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(buildPlanPaymentReceiptSubject(data))}</title>
</head>
<body style="margin:0;padding:0;background:#f3efe8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efe8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(92,74,55,0.12);">
          <tr>
            <td style="padding:32px 32px 22px;background:linear-gradient(135deg,#8b7355 0%,#c4a574 100%);color:#fff;">
              <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.86;margin-bottom:8px;">Adelia Reservas</div>
              <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.9;margin-bottom:10px;">Pago confirmado</div>
              <div style="font-size:30px;line-height:1.15;font-weight:700;">Hemos recibido tu pago</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#374151;">
                Hola, equipo de <strong>${restaurantName}</strong>:
              </p>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#374151;">
                ${data.renewal
                  ? `El cobro mensual del plan <strong>${planName}</strong> se ha completado correctamente. Seguid disfrutando de todas las herramientas de Adelia.`
                  : `Ya estáis en <strong>Adelia ${planName}</strong>. El pago se ha registrado y podéis usar desde ahora todos los beneficios de vuestro plan.`}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#faf8f4;border:1px solid #eee6d8;border-radius:14px;margin:0 0 24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8b7355;margin-bottom:8px;">Resumen del cobro</div>
                    <div style="font-size:22px;font-weight:700;color:#1f2937;margin-bottom:12px;">${amount} <span style="font-size:14px;font-weight:500;color:#6b7280;">/ mes + IVA</span></div>
                    <div style="font-size:14px;color:#4b5563;line-height:1.6;">
                      Plan ${planName}<br />
                      ${paidAt}
                      ${invoiceNumber ? `<br />Factura ${invoiceNumber}` : ''}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1f2937;">Disfruta de los beneficios de ${planName}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                ${highlightRows}
              </table>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="${panelUrl}" style="display:inline-block;padding:13px 24px;background:linear-gradient(90deg,#8b7355,#c4a574);color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;box-shadow:0 10px 24px rgba(139,115,85,0.28);">
                  Abrir el panel
                </a>
                ${invoiceButton}
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                ${invoiceUrl
                  ? 'Adjuntamos la factura de Stripe de este cobro. Si necesitas cambiar los datos fiscales (nombre, NIF/CIF o dirección), responde a este correo y lo actualizamos.'
                  : 'Si necesitas una factura con otros datos fiscales, responde a este correo y te la preparamos.'}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 28px;border-top:1px solid #f0f0f0;text-align:center;background:#fafafa;">
              ${logoBlock}
              <div style="font-size:12px;color:#9ca3af;">Facturación Adelia · adeliareservas.com</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export interface PlanPaymentFailedData {
  to: string
  restaurantName: string
  planId: SaasCheckoutPlanId
  amountCents: number
  currency?: string
  /** Enlace del portal de facturación de Stripe para actualizar la tarjeta. */
  updateUrl?: string
  /** Enlace `hosted_invoice_url` para pagar la factura pendiente. */
  invoiceUrl?: string
}

function buildPlanPaymentFailedText(data: PlanPaymentFailedData): string {
  const plan = SAAS_CHECKOUT_PLANS[data.planId]
  const pay = data.updateUrl || data.invoiceUrl || `${APP_URL}/panel?tab=plan`
  return [
    `Hola${data.restaurantName ? `, equipo de ${data.restaurantName}` : ''},`,
    '',
    `No hemos podido cobrar la cuota mensual de tu plan ${plan.name} (${formatMoney(data.amountCents, data.currency)} / mes + IVA).`,
    'Suele ser por una tarjeta caducada o sin fondos. Stripe volverá a intentarlo automáticamente los próximos días.',
    '',
    `Para arreglarlo cuanto antes, actualiza tu método de pago aquí: ${pay}`,
    '',
    'Si el cobro sigue fallando, tu restaurante pasará al plan gratuito y se desactivarán las funciones de pago (mapas, cartas extra y promociones).',
    '',
    'Si crees que es un error, responde a este correo.',
    '',
    '— Facturación Adelia',
  ].join('\n')
}

function buildPlanPaymentFailedHtml(data: PlanPaymentFailedData): string {
  const plan = SAAS_CHECKOUT_PLANS[data.planId]
  const restaurantName = escapeHtml(data.restaurantName || 'tu restaurante')
  const planName = escapeHtml(plan.name)
  const amount = escapeHtml(formatMoney(data.amountCents, data.currency))
  const payUrl = escapeHtml(data.updateUrl || data.invoiceUrl || `${APP_URL}/panel?tab=plan`)
  const logoUrl = getAdeliaEmailLogoImgSrc('cid', `${APP_URL}/adelia-logo-email.png`)
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="Adelia" width="120" style="display:block;margin:0 auto 10px;height:auto;" />`
    : `<div style="font-size:18px;font-weight:700;color:#8b7355;margin-bottom:10px;">Adelia</div>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>No se pudo cobrar tu plan Adelia</title>
</head>
<body style="margin:0;padding:0;background:#f3efe8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efe8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(92,74,55,0.12);">
        <tr>
          <td style="padding:32px 32px 22px;background:linear-gradient(135deg,#a8461f 0%,#db5a34 100%);color:#fff;">
            <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.86;margin-bottom:8px;">Facturación Adelia</div>
            <div style="font-size:28px;line-height:1.2;font-weight:700;">No pudimos cobrar tu plan</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#374151;">Hola, equipo de <strong>${restaurantName}</strong>:</p>
            <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#374151;">
              No hemos podido cobrar la cuota mensual del plan <strong>${planName}</strong>
              (<strong>${amount}</strong> / mes + IVA). Suele ser una tarjeta caducada o sin fondos.
              Stripe volverá a intentarlo estos días.
            </p>
            <p style="margin:0 0 28px;text-align:center;">
              <a href="${payUrl}" style="display:inline-block;padding:14px 26px;background:#db5a34;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;">
                Actualizar método de pago
              </a>
            </p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
              Si el cobro sigue fallando, tu restaurante pasará al plan gratuito y se desactivarán las
              funciones de pago. Si crees que es un error, responde a este correo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 32px 28px;border-top:1px solid #f0f0f0;text-align:center;background:#fafafa;">
            ${logoBlock}
            <div style="font-size:12px;color:#9ca3af;">Facturación Adelia · adeliareservas.com</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendPlanPaymentFailedEmail(
  data: PlanPaymentFailedData,
  apiKey = getResendApiKey(),
): Promise<void> {
  const to = data.to.trim()
  if (!apiKey || !isValidClientEmail(to)) {
    return
  }

  const resend = new Resend(apiKey)
  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    replyTo: EMAIL_REPLY_TO,
    subject: `Acción necesaria · no se pudo cobrar tu plan Adelia ${SAAS_CHECKOUT_PLANS[data.planId].name}`,
    html: buildPlanPaymentFailedHtml(data),
    text: buildPlanPaymentFailedText(data),
    attachments: getAdeliaEmailLogoAttachmentsForSend() ?? [],
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}

async function fetchInvoicePdfAttachment(
  url: string,
  invoiceNumber?: string,
): Promise<{ filename: string; content: Buffer } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const content = Buffer.from(await response.arrayBuffer())
    if (content.length < 80) {
      return null
    }
    const safeNumber = (invoiceNumber || 'pago').replace(/[^a-zA-Z0-9-]/g, '')
    return {
      filename: `Factura-Adelia-${safeNumber}.pdf`,
      content,
    }
  } catch {
    return null
  }
}

export async function sendPlanPaymentReceiptEmail(
  data: PlanPaymentReceiptData & { invoicePdfUrl?: string },
  apiKey = getResendApiKey(),
): Promise<void> {
  const to = data.to.trim()
  if (!apiKey || !isValidClientEmail(to)) {
    return
  }

  const resend = new Resend(apiKey)
  const logoAttachments = getAdeliaEmailLogoAttachmentsForSend() ?? []
  const pdf = data.invoicePdfUrl
    ? await fetchInvoicePdfAttachment(data.invoicePdfUrl, data.invoiceNumber)
    : null

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    replyTo: EMAIL_REPLY_TO,
    subject: buildPlanPaymentReceiptSubject(data),
    html: buildPlanPaymentReceiptHtml(data, { logoMode: 'cid' }),
    text: buildPlanPaymentReceiptText(data),
    attachments: [
      ...logoAttachments,
      ...(pdf ? [pdf] : []),
    ],
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}
