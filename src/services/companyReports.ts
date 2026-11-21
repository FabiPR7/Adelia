import type { Reservation, ReservationStatus } from '../types'
import { isDemoCompanyId } from '../data/companyPanelDemo'
import { callCompanyApi } from './companyApi'
import { getReservationsByCompany, mapMinSpendVerification } from './firestore'
import { yearBounds } from './firestoreQuery'

/**
 * Las reservas de un año para los informes de clientes y productos. Las lee el
 * servidor por páginas (sin el tope de 800) y las guarda 5 minutos por local y año.
 */
export async function fetchYearReservationsForReports(
  companyId: string,
  year: number,
): Promise<{ reservations: Reservation[]; truncated: boolean }> {
  if (isDemoCompanyId(companyId)) {
    const range = yearBounds(year)
    return { reservations: await getReservationsByCompany(companyId, { from: range.start, to: range.end }), truncated: false }
  }
  const data = await callCompanyApi<{ reservations?: Array<Record<string, unknown>>; truncated?: boolean }>(
    `/${encodeURIComponent(companyId)}/reports/reservations?year=${year}`,
    'GET',
    undefined,
    'No se pudo cargar el informe.',
  )
  const reservations = (data.reservations ?? []).map(toReservation)
  return { reservations, truncated: data.truncated === true }
}

function date(value: unknown): Date {
  const parsed = typeof value === 'string' ? new Date(value) : null
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date()
}

function toReservation(row: Record<string, unknown>): Reservation {
  return {
    id: String(row.id ?? ''),
    companyId: String(row.companyId ?? ''),
    tableId: String(row.tableId ?? ''),
    clientName: String(row.clientName ?? ''),
    clientEmail: String(row.clientEmail ?? ''),
    clientPhone: String(row.clientPhone ?? ''),
    pax: typeof row.pax === 'number' ? row.pax : 0,
    notes: typeof row.notes === 'string' ? row.notes : '',
    startTime: date(row.startTime),
    endTime: date(row.endTime),
    status: row.status as ReservationStatus,
    cancelToken: '',
    createdAt: date(row.createdAt),
    customerUid: typeof row.customerUid === 'string' ? row.customerUid : null,
    promotionId: typeof row.promotionId === 'string' ? row.promotionId : null,
    minimumSpendCents: typeof row.minimumSpendCents === 'number' ? row.minimumSpendCents : null,
    promotionVisitStatus: row.promotionVisitStatus as Reservation['promotionVisitStatus'],
    minSpendVerification: mapMinSpendVerification(row.minSpendVerification),
    depositAmountCents: typeof row.depositAmountCents === 'number' ? row.depositAmountCents : null,
    cancelledBy: row.cancelledBy === 'client' || row.cancelledBy === 'restaurant' ? row.cancelledBy : null,
    noShow: row.noShow === true,
    depositPaymentIntentId: null,
    depositStatus: typeof row.depositStatus === 'string' ? row.depositStatus as Reservation['depositStatus'] : null,
  }
}
