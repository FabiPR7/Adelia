import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { parseCompanyEmailTemplates, type CompanyEmailTemplates } from './emailTemplateDefaults.ts'
import { isValidClientEmail } from './config.ts'
import type { ReservationEmailBuildData } from './buildReservationEmail.ts'
import { sendReservationConfirmationEmail } from './reservationConfirmation.ts'
import { sendReservationReceivedEmail } from './reservationReceived.ts'

async function loadReservationEmailPayload(
  reservationId: string,
  data: FirebaseFirestore.DocumentData,
): Promise<(Omit<ReservationEmailBuildData, 'kind' | 'template'> & { templates: CompanyEmailTemplates }) | null> {
  const email = typeof data.clientEmail === 'string' ? data.clientEmail.trim() : ''

  if (!isValidClientEmail(email)) {
    return null
  }

  const companyId = data.companyId as string | undefined
  const tableId = data.tableId as string | undefined
  const startTime = data.startTime?.toDate?.() as Date | undefined

  if (!companyId || !tableId || !startTime) {
    return null
  }

  const [companySnap, tableSnap] = await Promise.all([
    adminDb.collection('companies').doc(companyId).get(),
    adminDb.collection('tables').doc(tableId).get(),
  ])

  if (!companySnap.exists) {
    console.warn(`Reservation ${reservationId}: company ${companyId} not found`)
    return null
  }

  const company = companySnap.data()!
  const tableName = tableSnap.exists ? ((tableSnap.data()?.name as string) ?? 'Mesa') : 'Mesa'
  const emailTemplates = parseCompanyEmailTemplates(company.emailTemplates)

  return {
    to: email,
    clientName: (data.clientName as string) ?? 'Cliente',
    restaurantName: (company.name as string) ?? 'Restaurante',
    restaurantSlug: (company.slug as string) ?? '',
    restaurantLogoUrl: (company.logoUrl as string) ?? '',
    restaurantPhone: (company.phone as string) ?? '',
    restaurantLocation: (company.location as string) ?? '',
    restaurantWebsite: (company.website as string) ?? '',
    restaurantContactEmail: (company.contactEmail as string) ?? '',
    date: startTime,
    pax: Number(data.pax) || 1,
    tableName,
    notes: typeof data.notes === 'string' ? data.notes : '',
    cancelToken: typeof data.cancelToken === 'string' ? data.cancelToken : '',
    depositAmountCents: typeof data.depositAmountCents === 'number' ? data.depositAmountCents : null,
    depositPerGuestCents: typeof company.depositPerGuestCents === 'number'
      ? company.depositPerGuestCents
      : null,
    depositCancellationHours: typeof company.depositCancellationHours === 'number'
      ? company.depositCancellationHours
      : null,
    templates: emailTemplates,
  }
}

export async function processReservationReceivedEmail(
  reservationId: string,
  data: FirebaseFirestore.DocumentData,
  apiKey?: string,
): Promise<boolean> {
  if (data.receivedEmailSentAt) {
    return false
  }

  if (data.status === 'cancelled' || data.status === 'confirmed') {
    return false
  }

  const payload = await loadReservationEmailPayload(reservationId, data)

  if (!payload) {
    return false
  }

  const { templates, ...basePayload } = payload

  await sendReservationReceivedEmail(
    {
      ...basePayload,
      kind: 'received',
      template: templates.received,
      to: basePayload.to ?? '',
    },
    apiKey,
  )

  await adminDb.collection('reservations').doc(reservationId).update({
    receivedEmailSentAt: FieldValue.serverTimestamp(),
  })

  return true
}

export async function processReservationConfirmationEmail(
  reservationId: string,
  data: FirebaseFirestore.DocumentData,
  apiKey?: string,
): Promise<boolean> {
  if (data.confirmationEmailSentAt) {
    return false
  }

  if (data.status !== 'confirmed') {
    return false
  }

  const payload = await loadReservationEmailPayload(reservationId, data)

  if (!payload) {
    return false
  }

  const { templates, ...basePayload } = payload

  await sendReservationConfirmationEmail(
    {
      ...basePayload,
      kind: 'confirmation',
      template: templates.confirmation,
      to: basePayload.to ?? '',
    },
    apiKey,
  )

  await adminDb.collection('reservations').doc(reservationId).update({
    confirmationEmailSentAt: FieldValue.serverTimestamp(),
  })

  return true
}

export function shouldSendReceivedOnCreate(
  data: FirebaseFirestore.DocumentData | undefined,
): boolean {
  if (!data) {
    return false
  }

  if (data.receivedEmailSentAt) {
    return false
  }

  if (data.status === 'cancelled' || data.status === 'confirmed') {
    return false
  }

  const email = typeof data.clientEmail === 'string' ? data.clientEmail.trim() : ''
  return isValidClientEmail(email)
}

export function shouldSendConfirmationOnUpdate(
  before: FirebaseFirestore.DocumentData | undefined,
  after: FirebaseFirestore.DocumentData | undefined,
): boolean {
  if (!before || !after) {
    return false
  }

  if (after.confirmationEmailSentAt) {
    return false
  }

  if (after.status !== 'confirmed') {
    return false
  }

  const afterEmail = typeof after.clientEmail === 'string' ? after.clientEmail.trim() : ''

  if (!isValidClientEmail(afterEmail)) {
    return false
  }

  return before.status !== 'confirmed' && after.status === 'confirmed'
}
