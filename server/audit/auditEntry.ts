// Registro de cambios: cada vez que se crea, cambia o borra un documento, se guarda en
// `auditLog` qué cambió (campos, antes y después), cuándo y, si se sabe, quién.

/** Colecciones que no se registran: son ruido técnico (o el propio registro). */
export const AUDIT_SKIPPED_COLLECTIONS = new Set([
  'auditLog',
  'rateLimits',
  'loginAttempts',
  'notificationJobs',
  'appEvents',
  'metrics',
  'clientErrors',
  'catalogBundle',
])

const MAX_VALUE_CHARS = 1500
const MAX_FIELDS = 60
/** Campos que nunca se copian al registro (secretos). */
const SECRET_FIELDS = /pin|password|secret|token|hash/i

export interface AuditEntry {
  path: string
  collection: string
  docId: string
  action: 'create' | 'update' | 'delete'
  changedFields: string[]
  before: Record<string, unknown>
  after: Record<string, unknown>
  /** Quién lo hizo, si el documento lo apunta (updatedBy, cancelledBy, customerUid…). */
  actor: string | null
}

function comparable(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  try {
    return JSON.stringify(value) ?? 'undefined'
  } catch {
    return String(value)
  }
}

function snapshotValue(key: string, value: unknown): unknown {
  if (SECRET_FIELDS.test(key)) return '[oculto]'
  if (value === undefined) return null
  const text = comparable(value)
  if (text.length <= MAX_VALUE_CHARS) {
    return value && typeof value === 'object' && 'toDate' in value ? text : value
  }
  return `${text.slice(0, MAX_VALUE_CHARS)}… (recortado)`
}

function actorOf(data: Record<string, unknown> | null): string | null {
  if (!data) return null
  for (const key of ['updatedBy', 'lastActor', 'cancelledBy', 'customerUid', 'ownerUid', 'uid', 'userId']) {
    const value = data[key]
    if (typeof value === 'string' && value) return `${key}:${value}`
  }
  return null
}

export function buildAuditEntry(
  path: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditEntry | null {
  const parts = path.split('/')
  const collection = parts.length >= 2 ? parts[parts.length - 2] : ''
  const docId = parts[parts.length - 1] ?? ''
  if (!collection || AUDIT_SKIPPED_COLLECTIONS.has(parts[0]) || AUDIT_SKIPPED_COLLECTIONS.has(collection)) return null

  const action = !before ? 'create' : !after ? 'delete' : 'update'
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changedFields = [...keys]
    .filter((key) => key !== 'updatedAt')
    .filter((key) => comparable(before?.[key]) !== comparable(after?.[key]))
    .sort()
  if (action === 'update' && changedFields.length === 0) return null

  const fields = changedFields.slice(0, MAX_FIELDS)
  const pick = (data: Record<string, unknown> | null) => {
    const out: Record<string, unknown> = {}
    if (!data) return out
    for (const key of fields) if (key in data) out[key] = snapshotValue(key, data[key])
    return out
  }
  return {
    path,
    collection,
    docId,
    action,
    changedFields,
    before: pick(before),
    after: pick(after),
    actor: actorOf(after) ?? actorOf(before),
  }
}
