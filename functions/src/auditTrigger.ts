import { onDocumentWritten, type FirestoreEvent, type Change, type DocumentSnapshot } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../server/firebase-admin.ts'
import { buildAuditEntry } from '../server/audit/auditEntry.ts'

/**
 * Registro de cambios: cada creación, cambio o borrado de un documento (venga del
 * servidor, del panel o del admin) queda apuntado en `auditLog` con qué cambió, el
 * antes y el después, cuándo y, si se sabe, quién. Solo lo puede leer el admin.
 */
const base = { database: 'adelia', region: 'europe-southwest1' } as const

async function record(event: FirestoreEvent<Change<DocumentSnapshot> | undefined>): Promise<void> {
  const change = event.data
  if (!change) return
  const path = (change.after.exists ? change.after.ref : change.before.ref).path
  const entry = buildAuditEntry(
    path,
    change.before.exists ? change.before.data() ?? null : null,
    change.after.exists ? change.after.data() ?? null : null,
  )
  if (!entry) return
  try {
    await adminDb.collection('auditLog').add({ ...entry, at: FieldValue.serverTimestamp(), eventId: event.id })
  } catch (error) {
    console.error(`Audit log failed for ${path}:`, error)
  }
}

/** Colecciones principales (reservas, usuarios, amigos, premios, locales…). */
export const onTopLevelDocWrittenAudit = onDocumentWritten({ ...base, document: '{collectionId}/{docId}' }, record)

/** Lo que cuelga de un local: promociones, carta, clientes, PIN, consumos… */
export const onCompanySubdocWrittenAudit = onDocumentWritten(
  { ...base, document: 'companies/{companyId}/{subcollectionId}/{docId}' },
  record,
)

/** Lo que cuelga de un usuario (avisos, etc.). */
export const onUserSubdocWrittenAudit = onDocumentWritten(
  { ...base, document: 'users/{userId}/{subcollectionId}/{docId}' },
  record,
)
