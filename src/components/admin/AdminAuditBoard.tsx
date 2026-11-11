import { useEffect, useState } from 'react'
import { adminApi, type AdminAuditEntry } from '../../services/adminApi'
import styles from './AdminPanel.module.css'

const ACTION_LABEL: Record<string, string> = {
  'customer.adjust': 'Ajuste de puntos u objetos',
  'customer.block': 'Cliente bloqueado',
  'customer.unblock': 'Cliente desbloqueado',
  'company.deactivate': 'Restaurante desactivado',
  'company.activate': 'Restaurante reactivado',
  notify: 'Aviso enviado',
  'catalog.save': 'Catálogo cambiado',
  'mission.save': 'Misión cambiada',
  'company.save': 'Restaurante editado',
  'company.create': 'Restaurante creado',
  'company.delete': 'Restaurante eliminado',
  'review.delete': 'Reseña borrada',
}

function describe(entry: AdminAuditEntry): string {
  const detail = entry.detail
  const parts: string[] = []
  if (typeof detail.reason === 'string' && detail.reason) parts.push(`Motivo: ${detail.reason}`)
  if (typeof detail.xpDelta === 'number' && detail.xpDelta) parts.push(`${detail.xpDelta > 0 ? '+' : ''}${detail.xpDelta} XP`)
  if (typeof detail.adelinasDelta === 'number' && detail.adelinasDelta) parts.push(`${detail.adelinasDelta > 0 ? '+' : ''}${detail.adelinasDelta} Adelinás`)
  if (typeof detail.title === 'string') parts.push(`«${detail.title}»`)
  if (typeof detail.sent === 'number') parts.push(`${detail.sent} destinatarios`)
  if (typeof detail.section === 'string') parts.push(detail.section)
  if (typeof detail.name === 'string') parts.push(detail.name)
  return parts.join(' · ')
}

/** Quién cambió qué y cuándo desde el panel. */
function AdminAuditBoard() {
  const [entries, setEntries] = useState<AdminAuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void adminApi.audit(100)
      .then((data) => setEntries(data.entries))
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el registro.'))
  }, [])

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h3>Registro de cambios</h3>
        <p>Los 100 últimos</p>
      </div>
      {error ? <div className={`${styles.notice} ${styles.noticeBad}`}>{error}</div> : null}
      {!entries && !error ? <div className={styles.skeleton} /> : null}
      {entries && entries.length === 0 ? <p className={styles.muted}>Todavía no hay cambios registrados.</p> : null}
      {entries && entries.length > 0 ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr><th>Cuándo</th><th>Qué</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>
                    <strong>{ACTION_LABEL[entry.action] ?? entry.action}</strong>
                    <em>{entry.target}</em>
                  </td>
                  <td>{describe(entry) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export default AdminAuditBoard
