import { APP_URL } from './config.ts'
import { getAdeliaEmailLogoImgSrc } from './emailLogo.ts'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildAdeliaEmailFooter(options?: { logoMode?: 'cid' | 'data' | 'remote' }): string {
  const logoMode = options?.logoMode ?? 'cid'
  const logoUrl = getAdeliaEmailLogoImgSrc(
    logoMode,
    `${APP_URL}/adelia-logo-email.png`,
  )

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="Adelia" width="120" style="display:block;margin:0 auto 10px;height:auto;" />`
    : `<div style="font-size:18px;font-weight:700;color:#8b7355;margin-bottom:10px;">Adelia</div>`

  return `<tr>
    <td style="padding:20px 28px 28px;border-top:1px solid #f0f0f0;text-align:center;background:#fafafa;">
      ${logoBlock}
      <div style="font-size:12px;color:#9ca3af;">Reserva gestionada con adeliareservas</div>
    </td>
  </tr>`
}

export function buildReservationDetailsTable(rows: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
    ${rows}
  </table>`
}

export function buildReservationEmailShell(options: {
  title: string
  accentColor: string
  accentColorEnd: string
  headerEyebrow: string
  restaurantName: string
  introHtml: string
  detailsTableHtml: string
  closingHtml: string
  logoMode?: 'cid' | 'data' | 'remote'
}): string {
  const headerEyebrow = escapeHtml(options.headerEyebrow)
  const restaurantName = escapeHtml(options.restaurantName)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
          <tr>
            <td style="padding:28px 28px 16px;background:linear-gradient(135deg,${options.accentColor} 0%,${options.accentColorEnd} 100%);color:#fff;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;margin-bottom:8px;">${headerEyebrow}</div>
              <div style="font-size:28px;line-height:1.2;font-weight:700;">${restaurantName}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${options.introHtml}
              ${options.detailsTableHtml}
              ${options.closingHtml}
            </td>
          </tr>
          ${buildAdeliaEmailFooter({ logoMode: options.logoMode })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
