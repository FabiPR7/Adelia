import { Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { occupyingReservation } from '../reservationSlots.ts'
import { madridDayRange } from '../utils/madridDateTime.ts'

export class SlotUnavailableError extends Error {
  constructor(message = 'Esa mesa ya está reservada a esa hora.') {
    super(message)
    this.name = 'SlotUnavailableError'
  }
}

function dayBounds(date: Date) {
  return madridDayRange(date)
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (value instanceof Timestamp) {
    return value.toDate()
  }
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate()
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date
    }
  }
  return null
}

function tableOccupiedInSnapshot(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  tableId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string,
) {
  return docs.some((docSnap) => {
    const data = docSnap.data()
    const start = asDate(data.startTime)
    const end = asDate(data.endTime)
    if (!start || !end) {
      return false
    }
    return occupyingReservation(
      {
        id: docSnap.id,
        tableId: String(data.tableId ?? ''),
        startTime: start,
        endTime: end,
        status: String(data.status ?? ''),
      },
      tableId,
      startTime,
      endTime,
      excludeId,
    )
  })
}

/**
 * Crea la reserva leyendo el día de esa mesa DENTRO de la transacción.
 * Si dos clientes piden el mismo hueco, Firestore reintenta y el segundo recibe 409.
 * La contención es por mesa y día, no global.
 */
export async function createReservationWithOccupiedSlot<T = void>(options: {
  reservationRef: DocumentReference
  reservationData: Record<string, unknown>
  companyId: string
  tableId: string
  startTime: Date
  endTime: Date
  prepare?: (transaction: Transaction) => Promise<T>
  apply?: (transaction: Transaction, prepared: T) => void
}): Promise<T | undefined> {
  const { start: dayStart, end: dayEnd } = dayBounds(options.startTime)
  const overlapQuery = adminDb
    .collection('reservations')
    .where('companyId', '==', options.companyId)
    .where('tableId', '==', options.tableId)
    .where('startTime', '>=', Timestamp.fromDate(dayStart))
    .where('startTime', '<', Timestamp.fromDate(dayEnd))
    .limit(200)

  return adminDb.runTransaction(async (transaction) => {
    const overlapSnap = await transaction.get(overlapQuery)
    if (tableOccupiedInSnapshot(
      overlapSnap.docs,
      options.tableId,
      options.startTime,
      options.endTime,
    )) {
      throw new SlotUnavailableError()
    }

    const prepared = options.prepare
      ? await options.prepare(transaction)
      : undefined as T

    if (options.apply && prepared !== undefined) {
      options.apply(transaction, prepared)
    }
    transaction.set(options.reservationRef, options.reservationData)
    return prepared
  })
}
