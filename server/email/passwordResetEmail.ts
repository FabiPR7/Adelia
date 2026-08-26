import { createHash, randomBytes } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { APP_URL, EMAIL_FROM, EMAIL_REPLY_TO, getResendApiKey, isValidClientEmail } from './config.ts'
import { buildAdeliaEmailFooter, escapeHtml } from './emailLayout.ts'
import { getAdeliaEmailLogoAttachmentsForSend } from './emailLogo.ts'
import { adminDb } from '../firebase-admin.ts'

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

export type PasswordResetAudience = 'company' | 'customer'

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newResetToken(): string {
  return randomBytes(32).toString('hex')
}

export function buildPasswordResetUrl(token: string): string {
  return `${APP_URL}/restablecer-contrasena?token=${encodeURIComponent(token)}`
}

export function buildCustomerPasswordResetUrl(token: string): string {
  return `${APP_URL}/cuenta/restablecer-contrasena?token=${encodeURIComponent(token)}`
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

async function storePasswordResetToken(input: {
  token: string
  audience: PasswordResetAudience
  ownerUid: string
  email: string
  companyId?: string
  displayName?: string
}) {
  const now = Date.now()
  await adminDb.collection('passwordResetTokens').doc(hashPasswordResetToken(input.token)).set({
    audience: input.audience,
    companyId: input.companyId ?? '',
    ownerUid: input.ownerUid,
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName ?? '',
    expiresAt: Timestamp.fromDate(new Date(now + RESET_TOKEN_TTL_MS)),
    createdAt: Timestamp.fromDate(new Date(now)),
  })
}

export async function createPasswordResetToken(companyId: string, ownerUid: string, email: string) {
  const token = newResetToken()
  await storePasswordResetToken({
    token,
    audience: 'company',
    ownerUid,
    email,
    companyId,
  })
  return token
}

export async function createCustomerPasswordResetToken(
  ownerUid: string,
  email: string,
  displayName: string,
) {
  const token = newResetToken()
  await storePasswordResetToken({
    token,
    audience: 'customer',
    ownerUid,
    email,
    displayName,
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

export async function sendCustomerPasswordResetEmail(options: {
  to: string
  displayName: string
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

  const accountName = options.displayName.trim() || 'tu cuenta Adelia'
  const resetUrl = buildCustomerPasswordResetUrl(options.token)
  const resend = new Resend(apiKey)

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: options.to.trim(),
    replyTo: EMAIL_REPLY_TO,
    subject: 'Restablecer contraseña — Adelia',
    html: buildPasswordResetHtml({
      companyName: accountName,
      resetUrl,
    }),
    text: buildPasswordResetText({
      companyName: accountName,
      resetUrl,
    }),
    attachments: getAdeliaEmailLogoAttachmentsForSend(),
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
}

export async function getPasswordResetTokenRecord(token: string) {
  const trimmed = token.trim()
  if (!trimmed) {
    return null
  }

  const hashedSnap = await adminDb.collection('passwordResetTokens').doc(hashPasswordResetToken(trimmed)).get()
  const snap = hashedSnap.exists
    ? hashedSnap
    : await adminDb.collection('passwordResetTokens').doc(trimmed).get()

  if (!snap.exists) {
    return null
  }

  const data = snap.data()!
  const expiresAt = (data.expiresAt as Timestamp).toDate()

  if (expiresAt.getTime() < Date.now()) {
    return null
  }

  return {
    token: snap.id,
    audience: data.audience === 'customer' ? 'customer' as const : 'company' as const,
    companyId: typeof data.companyId === 'string' ? data.companyId : '',
    ownerUid: data.ownerUid as string,
    email: data.email as string,
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    expiresAt,
  }
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  await adminDb.collection('passwordResetTokens').doc(token).delete()
}
