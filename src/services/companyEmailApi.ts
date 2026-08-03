import type { EmailTemplateKind, ReservationEmailTemplate } from '../types'
import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function previewCompanyEmailTemplate(
  companyId: string,
  kind: EmailTemplateKind,
  template: ReservationEmailTemplate,
): Promise<{ html: string; subject: string } | null> {
  const token = await getIdToken()

  if (!token) {
    return null
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/company/${encodeURIComponent(companyId)}/email-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kind, template }),
      },
    )

    const data = (await response.json().catch(() => ({}))) as {
      html?: string
      subject?: string
      error?: string
    }

    if (!response.ok || !data.html || !data.subject) {
      console.warn('No se pudo generar la vista previa del correo:', data.error ?? response.status)
      return null
    }

    return { html: data.html, subject: data.subject }
  } catch (error) {
    console.warn('No se pudo contactar con la API de vista previa:', error)
    return null
  }
}
