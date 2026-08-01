import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { isValidClientEmail } from './config.ts'
import { sendReservationConfirmationEmail } from './reservationConfirmation.ts'

function shouldSendForStatus(status: unknown): boolean {
  return status !== 'cancelled'
}

export async function processReservationConfirmationEmail(
  reservationId: string,
  data: FirebaseFirestore.DocumentData,
  apiKey?: string,
): Promise<boolean> {
  if (data.confirmationEmailSentAt) {
    return false
  }

  const email = typeof data.clientEmail === 'string' ? data.clientEmail.trim() : ''

  if (!isValidClientEmail(email)) {
    return false
  }

  if (!shouldSendForStatus(data.status)) {
    return false
  }

  const companyId = data.companyId as string | undefined
  const tableId = data.tableId as string | undefined
  const startTime = data.startTime?.toDate?.() as Date | undefined

  if (!companyId || !tableId || !startTime) {
    return false
  }

  const [companySnap, tableSnap] = await Promise.all([
    adminDb.collection('companies').doc(companyId).get(),
    adminDb.collection('tables').doc(tableId).get(),
  ])

  if (!companySnap.exists) {
    console.warn(`Reservation ${reservationId}: company ${companyId} not found`)
    return false
  }

  const company = companySnap.data()!
  const tableName = tableSnap.exists ? ((tableSnap.data()?.name as string) ?? 'Mesa') : 'Mesa'

  await sendReservationConfirmationEmail(
    {
      to: email,
      clientName: (data.clientName as string) ?? 'Cliente',
      restaurantName: (company.name as string) ?? 'Restaurante',
      restaurantPhone: (company.phone as string) ?? '',
      restaurantLocation: (company.location as string) ?? '',
      date: startTime,
      pax: Number(data.pax) || 1,
      tableName,
      notes: typeof data.notes === 'string' ? data.notes : '',
    },
    apiKey,
  )

  await adminDb.collection('reservations').doc(reservationId).update({
    confirmationEmailSentAt: FieldValue.serverTimestamp(),
  })

  return true
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

  if (!shouldSendForStatus(after.status)) {
    return false
  }

  const beforeEmail = typeof before.clientEmail === 'string' ? before.clientEmail.trim() : ''
  const afterEmail = typeof after.clientEmail === 'string' ? after.clientEmail.trim() : ''

  if (!isValidClientEmail(afterEmail)) {
    return false
  }

  const emailAdded = !beforeEmail && Boolean(afterEmail)
  const statusConfirmed =
    before.status !== 'confirmed' && after.status === 'confirmed'

  return emailAdded || statusConfirmed
}
