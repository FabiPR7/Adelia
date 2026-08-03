import { APP_URL } from './config.ts'
import {
  applyTemplatePlaceholders,
  buildReservationCancelUrl,
  buildRestaurantProfileUrl,
  DEFAULT_CONFIRMATION_TEMPLATE,
  DEFAULT_RECEIVED_TEMPLATE,
  normalizeReservationEmailTemplate,
  type EmailTemplateKind,
  type ReservationEmailTemplate,
} from './emailTemplateDefaults.ts'
import { buildAdeliaEmailFooter, escapeHtml } from './emailLayout.ts'
import {
  capitalizeSpanish,
  formatDateSpanish,
  formatPhoneDisplay,
  formatTimeSpanish,
} from './format.ts'

export interface ReservationEmailBuildData {
  kind: EmailTemplateKind
  to?: string
  clientName: string
  restaurantName: string
  restaurantSlug: string
  restaurantLogoUrl: string
  restaurantPhone: string
  restaurantLocation: string
  restaurantWebsite: string
  restaurantContactEmail: string
  date: Date
  pax: number
  tableName: string
  notes?: string
  cancelToken?: string
  template?: ReservationEmailTemplate
}

function resolveTemplate(
  kind: EmailTemplateKind,
  template?: ReservationEmailTemplate,
): ReservationEmailTemplate {
  const defaults = kind === 'received' ? DEFAULT_RECEIVED_TEMPLATE : DEFAULT_CONFIRMATION_TEMPLATE
  return normalizeReservationEmailTemplate(template, defaults)
}

function paragraphHtml(text: string, options?: { margin?: string; color?: string; size?: string }) {
  const margin = options?.margin ?? '0 0 18px'
  const color = options?.color ?? '#374151'
  const size = options?.size ?? '16px'

  if (!text.trim()) {
    return ''
  }

  return `<p style="margin:${margin};font-size:${size};line-height:1.6;color:${color};">${text}</p>`
}

function buildHeaderBackground(template: ReservationEmailTemplate): {
  background: string
  color: string
  eyebrowOpacity: string
} {
  if (template.headerStyle === 'light') {
    return {
      background: '#faf7f2',
      color: '#5c4a3a',
      eyebrowOpacity: '1',
    }
  }

  if (template.headerStyle === 'solid') {
    return {
      background: template.accentColor,
      color: '#ffffff',
      eyebrowOpacity: '0.9',
    }
  }

  return {
    background: `linear-gradient(135deg,${template.accentColor} 0%,${template.accentColorEnd} 100%)`,
    color: '#ffffff',
    eyebrowOpacity: '0.85',
  }
}

function buildDetailRow(label: string, value: string, compact: boolean) {
  const padding = compact ? '8px 0' : '12px 0'
  const fontSize = compact ? '13px' : '14px'

  return `<tr>
    <td style="padding:${padding};border-top:1px solid #eee;color:#666;font-size:${fontSize};width:120px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:${padding};border-top:1px solid #eee;color:#111;font-size:${fontSize};font-weight:600;">${value}</td>
  </tr>`
}

function buildDetailsRows(data: ReservationEmailBuildData, template: ReservationEmailTemplate): string {
  const rows: string[] = []
  const compact = template.layoutStyle === 'compact'
  const dateLabel = escapeHtml(capitalizeSpanish(formatDateSpanish(data.date)))
  const timeLabel = escapeHtml(formatTimeSpanish(data.date))
  const tableName = escapeHtml(data.tableName.trim() || 'Mesa')
  const phone = escapeHtml(formatPhoneDisplay(data.restaurantPhone))
  const location = escapeHtml(data.restaurantLocation.trim())
  const website = escapeHtml(data.restaurantWebsite.trim())
  const contactEmail = escapeHtml(data.restaurantContactEmail.trim())
  const notes = data.notes?.trim()

  if (template.showDate) {
    rows.push(buildDetailRow('Fecha', dateLabel, compact))
  }

  if (template.showTime) {
    rows.push(buildDetailRow('Hora', timeLabel, compact))
  }

  if (template.showPax) {
    rows.push(buildDetailRow('Comensales', String(data.pax), compact))
  }

  if (template.showTable) {
    rows.push(buildDetailRow('Mesa', tableName, compact))
  }

  if (template.showPhone && data.restaurantPhone.trim()) {
    rows.push(buildDetailRow('Teléfono', phone, compact))
  }

  if (template.showLocation && location) {
    rows.push(buildDetailRow('Dirección', location, compact))
  }

  if (template.showWebsite && website) {
    rows.push(buildDetailRow('Web', website, compact))
  }

  if (template.showContactEmail && contactEmail) {
    rows.push(buildDetailRow('Correo', contactEmail, compact))
  }

  if (template.showNotes && notes) {
    rows.push(buildDetailRow('Notas', escapeHtml(notes), compact))
  }

  return rows.join('')
}

function buildButtonHtml(label: string, href: string, variant: 'primary' | 'danger' | 'secondary') {
  const styles =
    variant === 'danger'
      ? 'background:#b91c1c;color:#ffffff;'
      : variant === 'secondary'
        ? 'background:#ffffff;color:#5c4a3a;border:1px solid #ddd0be;'
        : 'background:#5c4a3a;color:#ffffff;'

  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
    <tr>
      <td style="border-radius:999px;${styles}">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;text-decoration:none;color:inherit;border-radius:999px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`
}

function buildPromotionBlock(template: ReservationEmailTemplate, placeholders: Record<string, string>) {
  if (!template.showPromotion) {
    return ''
  }

  const title = escapeHtml(applyTemplatePlaceholders(template.promotionTitle, placeholders))
  const message = escapeHtml(applyTemplatePlaceholders(template.promotionMessage, placeholders))
  const code = template.promotionCode.trim()

  const codeBlock = code
    ? `<div style="margin-top:10px;display:inline-block;padding:8px 14px;border-radius:8px;background:#ffffff;border:1px dashed #c4a882;font-size:14px;font-weight:700;color:#5c4a3a;">Código: ${escapeHtml(code)}</div>`
    : ''

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:separate;border-spacing:0;">
    <tr>
      <td style="padding:16px 18px;border-radius:12px;background:linear-gradient(135deg,rgba(196,168,130,0.18),rgba(250,247,242,0.95));border:1px solid rgba(196,168,130,0.45);">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8b7355;margin-bottom:6px;">Promoción</div>
        <div style="font-size:16px;font-weight:700;color:#5c4a3a;margin-bottom:6px;">${title}</div>
        <div style="font-size:14px;line-height:1.55;color:#5c4a3a;">${message}</div>
        ${codeBlock}
      </td>
    </tr>
  </table>`
}

function buildActionsBlock(data: ReservationEmailBuildData, template: ReservationEmailTemplate) {
  const blocks: string[] = []

  if (template.showCancelButton && data.cancelToken && data.restaurantSlug) {
    const cancelUrl = buildReservationCancelUrl(data.restaurantSlug, data.cancelToken)
    blocks.push(
      paragraphHtml(escapeHtml(template.cancelHelpText), {
        margin: '0 0 12px',
        color: '#6b7280',
        size: '14px',
      }),
    )
    blocks.push(buildButtonHtml(template.cancelButtonLabel, cancelUrl, 'danger'))
  }

  if (template.showViewRestaurantButton && data.restaurantSlug) {
    const profileUrl = buildRestaurantProfileUrl(data.restaurantSlug)
    blocks.push(
      `<div style="margin-top:${template.showCancelButton ? '12px' : '0'};">${buildButtonHtml(template.viewRestaurantButtonLabel, profileUrl, 'secondary')}</div>`,
    )
  }

  if (blocks.length === 0) {
    return ''
  }

  return `<div style="margin:24px 0 0;text-align:center;">${blocks.join('')}</div>`
}

export function buildReservationEmailSubject(data: ReservationEmailBuildData): string {
  const template = resolveTemplate(data.kind, data.template)
  const dateLabel = capitalizeSpanish(formatDateSpanish(data.date))
  const placeholders = {
    nombre: data.clientName.trim(),
    restaurante: data.restaurantName.trim(),
    fecha: dateLabel,
    hora: formatTimeSpanish(data.date),
  }

  if (template.subject.trim()) {
    return applyTemplatePlaceholders(template.subject, placeholders)
  }

  if (data.kind === 'received') {
    return `Hemos recibido tu reserva — ${data.restaurantName.trim()} — ${dateLabel}`
  }

  return `Reserva confirmada — ${data.restaurantName.trim()} — ${dateLabel}`
}

export function buildReservationEmailHtml(
  data: ReservationEmailBuildData,
  options?: { logoMode?: 'cid' | 'data' | 'remote' },
): string {
  const template = resolveTemplate(data.kind, data.template)
  const logoMode = options?.logoMode ?? 'cid'
  const compact = template.layoutStyle === 'compact'
  const bodyPadding = compact ? '22px' : '28px'
  const headerStyles = buildHeaderBackground(template)
  const dateLabel = capitalizeSpanish(formatDateSpanish(data.date))
  const placeholders = {
    nombre: data.clientName.trim(),
    restaurante: data.restaurantName.trim(),
    fecha: dateLabel,
    hora: formatTimeSpanish(data.date),
  }

  const intro = escapeHtml(applyTemplatePlaceholders(template.introMessage, placeholders))
  const preDetails = escapeHtml(applyTemplatePlaceholders(template.preDetailsMessage, placeholders))
  const closing = escapeHtml(applyTemplatePlaceholders(template.closingMessage, placeholders))
  const headline = template.headline.trim()
    ? escapeHtml(applyTemplatePlaceholders(template.headline, placeholders))
    : escapeHtml(data.restaurantName.trim())

  const restaurantLogoBlock =
    template.showRestaurantLogo && data.restaurantLogoUrl.trim()
      ? `<img src="${escapeHtml(data.restaurantLogoUrl.trim())}" alt="" width="64" height="64" style="display:block;margin:0 auto 12px;border-radius:50%;object-fit:cover;background:#ffffff;" />`
      : ''

  const restaurantNameBlock = template.showRestaurantName
    ? `<div style="font-size:${compact ? '24px' : '28px'};line-height:1.2;font-weight:700;">${headline}</div>`
    : ''

  const detailsRows = buildDetailsRows(data, template)
  const detailsBlock = detailsRows
    ? `<div style="margin:${compact ? '14px 0 0' : '18px 0 0'};">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#8b7355;margin-bottom:8px;">${escapeHtml(template.detailsSectionTitle)}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${detailsRows}
        </table>
      </div>`
    : ''

  const promotionBlock = buildPromotionBlock(template, placeholders)
  const actionsBlock = buildActionsBlock(data, template)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.kind === 'received' ? 'Reserva recibida' : 'Reserva confirmada')}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
          <tr>
            <td style="padding:${compact ? '22px 22px 14px' : '28px 28px 16px'};background:${headerStyles.background};color:${headerStyles.color};text-align:center;">
              ${restaurantLogoBlock}
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:${headerStyles.eyebrowOpacity};margin-bottom:8px;">${escapeHtml(template.headerEyebrow)}</div>
              ${restaurantNameBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:${bodyPadding};">
              ${paragraphHtml(intro)}
              ${paragraphHtml(preDetails, { margin: '0 0 16px', size: '15px' })}
              ${promotionBlock}
              ${detailsBlock}
              ${paragraphHtml(closing, { margin: '24px 0 0', color: '#6b7280', size: '14px' })}
              ${actionsBlock}
            </td>
          </tr>
          ${buildAdeliaEmailFooter({ logoMode })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildReservationEmailText(data: ReservationEmailBuildData): string {
  const template = resolveTemplate(data.kind, data.template)
  const placeholders = {
    nombre: data.clientName.trim(),
    restaurante: data.restaurantName.trim(),
    fecha: capitalizeSpanish(formatDateSpanish(data.date)),
    hora: formatTimeSpanish(data.date),
  }

  const lines = [
    applyTemplatePlaceholders(template.introMessage, placeholders),
    '',
  ]

  if (template.preDetailsMessage.trim()) {
    lines.push(applyTemplatePlaceholders(template.preDetailsMessage, placeholders), '')
  }

  if (template.showPromotion) {
    lines.push(
      applyTemplatePlaceholders(template.promotionTitle, placeholders),
      applyTemplatePlaceholders(template.promotionMessage, placeholders),
    )
    if (template.promotionCode.trim()) {
      lines.push(`Código: ${template.promotionCode.trim()}`)
    }
    lines.push('')
  }

  if (template.showDate) {
    lines.push(`Fecha: ${capitalizeSpanish(formatDateSpanish(data.date))}`)
  }
  if (template.showTime) {
    lines.push(`Hora: ${formatTimeSpanish(data.date)}`)
  }
  if (template.showPax) {
    lines.push(`Comensales: ${data.pax}`)
  }
  if (template.showTable) {
    lines.push(`Mesa: ${data.tableName || 'Mesa'}`)
  }
  if (template.showPhone && data.restaurantPhone.trim()) {
    lines.push(`Teléfono: ${formatPhoneDisplay(data.restaurantPhone)}`)
  }
  if (template.showLocation && data.restaurantLocation.trim()) {
    lines.push(`Dirección: ${data.restaurantLocation.trim()}`)
  }
  if (template.showWebsite && data.restaurantWebsite.trim()) {
    lines.push(`Web: ${data.restaurantWebsite.trim()}`)
  }
  if (template.showContactEmail && data.restaurantContactEmail.trim()) {
    lines.push(`Correo: ${data.restaurantContactEmail.trim()}`)
  }
  if (template.showNotes && data.notes?.trim()) {
    lines.push(`Notas: ${data.notes.trim()}`)
  }

  lines.push('', applyTemplatePlaceholders(template.closingMessage, placeholders))

  if (template.showCancelButton && data.cancelToken && data.restaurantSlug) {
    lines.push('', `Cancelar reserva: ${buildReservationCancelUrl(data.restaurantSlug, data.cancelToken)}`)
  }

  if (template.showViewRestaurantButton && data.restaurantSlug) {
    lines.push('', `Ver restaurante: ${buildRestaurantProfileUrl(data.restaurantSlug)}`)
  }

  lines.push('', 'Reserva gestionada con adeliareservas — https://adeliareservas.com')

  return lines.join('\n')
}

export function buildSampleReservationEmailData(
  kind: EmailTemplateKind,
  company: Record<string, unknown>,
  template?: ReservationEmailTemplate,
): ReservationEmailBuildData {
  const sampleDate = new Date()
  sampleDate.setHours(20, 30, 0, 0)

  return {
    kind,
    clientName: 'María García',
    restaurantName: (company.name as string) ?? 'Mi restaurante',
    restaurantSlug: (company.slug as string) ?? 'demo',
    restaurantLogoUrl: (company.logoUrl as string) ?? '',
    restaurantPhone: (company.phone as string) ?? '600 000 000',
    restaurantLocation: (company.location as string) ?? 'Calle Ejemplo 1, Madrid',
    restaurantWebsite: (company.website as string) ?? '',
    restaurantContactEmail: (company.contactEmail as string) ?? '',
    date: sampleDate,
    pax: 4,
    tableName: 'Mesa 3',
    notes: 'Sin gluten, mesa cerca de la ventana.',
    cancelToken: 'preview-token-demo',
    template,
  }
}
