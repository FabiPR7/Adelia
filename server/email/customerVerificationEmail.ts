import { Resend } from 'resend'
import { EMAIL_FROM, EMAIL_REPLY_TO, getResendApiKey, isValidClientEmail } from './config.ts'
import { buildAdeliaEmailFooter, escapeHtml } from './emailLayout.ts'
import { getAdeliaEmailLogoAttachmentsForSend } from './emailLogo.ts'

function buildCustomerVerificationHtml(options: {
  displayName: string
  verifyUrl: string
}): string {
  const displayName = escapeHtml(options.displayName)
  const verifyUrl = escapeHtml(options.verifyUrl)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirma tu correo</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
          <tr>
            <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#ff6b4a 0%,#ff4f8f 100%);color:#fff;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;margin-bottom:8px;">Bienvenido a Adelia</div>
              <div style="font-size:28px;line-height:1.2;font-weight:700;">Confirma tu correo</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">
                Hola <strong>${displayName}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">
                Gracias por unirte a Adelia. Solo falta un paso para activar tu cuenta y empezar a descubrir restaurantes, promociones y misiones.
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(90deg,#ff6b4a,#ff4f8f);color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:16px;box-shadow:0 10px 24px rgba(255,79,143,0.28);">
                  Confirmar correo
                </a>
              </p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b7280;">
                El enlace caduca en unas horas. Si no funciona, copia y pega esta URL en tu navegador:
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#9ca3af;word-break:break-all;">
                ${verifyUrl}
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                Si no creaste esta cuenta, puedes ignorar este mensaje.
              </p>
            </td>
          </tr>
          ${buildAdeliaEmailFooter({ logoMode: 'cid' })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildCustomerVerificationText(options: {
  displayName: string
  verifyUrl: string
}): string {
  return [
    `Hola ${options.displayName},`,
    '',
    'Gracias por unirte a Adelia. Confirma tu correo para activar tu cuenta:',
    '',
    options.verifyUrl,
    '',
    'El enlace caduca en unas horas. Si no creaste esta cuenta, ignora este mensaje.',
  ].join('\n')
}

export async function sendCustomerVerificationEmail(options: {
  to: string
  displayName: string
  verifyUrl: string
  apiKey?: string
}): Promise<void> {
  const apiKey = options.apiKey ?? getResendApiKey()

  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurada.')
  }

  if (!isValidClientEmail(options.to)) {
    throw new Error('Correo de destino no válido.')
  }

  const resend = new Resend(apiKey)
  const subject = 'Confirma tu correo — Adelia'

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: options.to.trim(),
    replyTo: EMAIL_REPLY_TO,
    subject,
    html: buildCustomerVerificationHtml({
      displayName: options.displayName,
      verifyUrl: options.verifyUrl,
    }),
    text: buildCustomerVerificationText({
      displayName: options.displayName,
      verifyUrl: options.verifyUrl,
    }),
    attachments: getAdeliaEmailLogoAttachmentsForSend(),
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}
