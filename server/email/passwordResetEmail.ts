import { randomUUID } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { APP_URL, EMAIL_FROM, EMAIL_REPLY_TO, getResendApiKey, isValidClientEmail } from './config.ts'
import { buildAdeliaEmailFooter, escapeHtml } from './emailLayout.ts'
import { getAdeliaEmailLogoAttachmentsForSend } from './emailLogo.ts'
import { adminDb } from '../firebase-admin.ts'

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

export function buildPasswordResetUrl(token: string): string {
  return `${APP_URL}/restablecer-contrasena?token=${encodeURIComponent(token)}`
}

function buildPasswordResetHtml(options: {
  companyName: string
  resetUrl: string
}): string {
  const companyName = escapeHtml(options.companyName)
  const resetUrl = escapeHtml(options.resetUrl)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Restablecer contraseña</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
          <tr>
            <td style="padding:28px 28px 16px;background:linear-gradient(135deg,#6b5344 0%,#8b7355 100%);color:#fff;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;margin-bottom:8px;">Recuperar acceso</div>
              <div style="font-size:28px;line-height:1.2;font-weight:700;">${companyName}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Adelia.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
                Pulsa el botón para elegir una contraseña nueva. El enlace caduca en 1 hora.
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="${resetUrl}" style="display:inline-block;padding:14px 24px;background:#6b5344;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;">
                  Restablecer contraseña
                </a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.
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

function buildPasswordResetText(options: { companyName: string; resetUrl: string }): string {
  return [
    `Restablecer contraseña — ${options.companyName}`,
    '',
    'Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Adelia.',
    '',
    `Abre este enlace (caduca en 1 hora): ${options.resetUrl}`,
    '',
    'Si no solicitaste este cambio, ignora este correo.',
  ].join('\n')
}

export async function createPasswordResetToken(companyId: string, ownerUid: string, email: string) {
  const token = randomUUID()
  const now = Date.now()
  const expiresAt = Timestamp.fromDate(new Date(now + RESET_TOKEN_TTL_MS))

  await adminDb.collection('passwordResetTokens').doc(token).set({
    companyId,
    ownerUid,
    email: email.trim().toLowerCase(),
    expiresAt,
    createdAt: Timestamp.fromDate(new Date(now)),
  })

  return token
}

export async function sendPasswordResetEmail(options: {
  to: string
  companyName: string
  token: string
  apiKey?: string
}): Promise<void> {
  const apiKey = options.apiKey ?? getResendApiKey()

  if (!apiKey) {
    throw new Error('RESEND_API_KEY no configurada.')
  }

  if (!isValidClientEmail(options.to)) {
    throw new Error('Correo de destino no válido.')
  }

  const resetUrl = buildPasswordResetUrl(options.token)
  const resend = new Resend(apiKey)
  const subject = `Restablecer contraseña — ${options.companyName}`

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: options.to.trim(),
    replyTo: EMAIL_REPLY_TO,
    subject,
    html: buildPasswordResetHtml({
      companyName: options.companyName,
      resetUrl,
    }),
    text: buildPasswordResetText({
      companyName: options.companyName,
      resetUrl,
    }),
    attachments: getAdeliaEmailLogoAttachmentsForSend(),
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}

export async function getPasswordResetTokenRecord(token: string) {
  const snap = await adminDb.collection('passwordResetTokens').doc(token).get()

  if (!snap.exists) {
    return null
  }

  const data = snap.data()!
  const expiresAt = (data.expiresAt as Timestamp).toDate()

  if (expiresAt.getTime() < Date.now()) {
    return null
  }

  return {
    token,
    companyId: data.companyId as string,
    ownerUid: data.ownerUid as string,
    email: data.email as string,
    expiresAt,
  }
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  await adminDb.collection('passwordResetTokens').doc(token).delete()
}
