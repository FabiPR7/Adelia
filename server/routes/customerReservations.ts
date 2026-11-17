import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'

/**
 * "Mis reservas" del cliente, leídas con el Admin SDK.
 *
 * La web y la app móvil comparten este servidor. Así la app no depende de las
 * reglas de Firestore ni de índices compuestos para listar sus reservas, y las
 * dos ven exactamente lo mismo.
 *
 * Mismo criterio que `src/utils/customerReservationLists.ts` de la web:
 * - `all`: reservas de la cuenta + las hechas como invitado con su correo.
 * - `forMissions`: solo las de la cuenta; las del correo solo cuentan si la
 *   cuenta aún no tiene ninguna (evita pagar XP por un historial antiguo).
 * Las hechas solo con el correo exigen correo verificado, igual que las reglas.
 */
const router = Router()

const CUSTOMER_RESERVATION_LIMIT = 80

type Snapshot = FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>

function toIso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') {
      return toDate().toISOString()
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
  return null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function serializeReservation(doc: Snapshot) {
  const data = doc.data()
  return {
    id: doc.id,
    companyId: str(data.companyId),
    tableId: str(data.tableId),
    clientName: str(data.clientName),
    clientEmail: str(data.clientEmail),
    clientPhone: str(data.clientPhone),
    pax: numOrNull(data.pax) ?? 0,
    notes: str(data.notes),
    startTime: toIso(data.startTime),
    endTime: toIso(data.endTime),
    status: str(data.status) || 'confirmed',
    cancelToken: str(data.cancelToken),
    createdAt: toIso(data.createdAt),
    customerUid: typeof data.customerUid === 'string' ? data.customerUid : null,
    promotionId: typeof data.promotionId === 'string' ? data.promotionId : null,
    minimumSpendCents: numOrNull(data.minimumSpendCents),
    promotionVisitStatus: str(data.promotionVisitStatus) || null,
    depositAmountCents: numOrNull(data.depositAmountCents),
    depositStatus: str(data.depositStatus) || null,
  }
}

type SerializedReservation = ReturnType<typeof serializeReservation>

function newestFirst(rows: SerializedReservation[]): SerializedReservation[] {
  return [...rows].sort((a, b) => (b.startTime ?? '').localeCompare(a.startTime ?? ''))
}

// Sin orderBy: no necesita índice compuesto. Se ordena en memoria.
async function queryByField(field: 'customerUid' | 'clientEmail', value: string): Promise<Snapshot[]> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.reservations)
    .where(field, '==', value)
    .limit(CUSTOMER_RESERVATION_LIMIT)
    .get()
  return snapshot.docs
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)

    const [accountDocs, emailDocs] = await Promise.all([
      queryByField('customerUid', user.uid),
      user.emailVerified ? queryByField('clientEmail', user.email) : Promise.resolve([] as Snapshot[]),
    ])

    const byAccount = accountDocs.map(serializeReservation)
    // Del correo, solo las de invitado (sin cuenta) o las de esta misma cuenta.
    const byEmail = emailDocs
      .filter((doc) => {
        const owner = doc.data().customerUid
        return owner == null || owner === user.uid
      })
      .map(serializeReservation)

    const merged = new Map(byAccount.map((row) => [row.id, row]))
    for (const row of byEmail) {
      if (!merged.has(row.id)) merged.set(row.id, row)
    }

    res.json({
      all: newestFirst([...merged.values()]),
      forMissions: newestFirst(byAccount.length > 0 ? byAccount : byEmail),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar tus reservas.'
    const status = message.includes('cliente') || message.includes('autoriz') ? 401 : 500
    res.status(status).json({ error: message })
  }
})

export default router
