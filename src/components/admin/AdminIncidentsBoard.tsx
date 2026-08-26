import type { AdminLoginLock, AdminSecurityEvent } from '../../types/adminOps'
import styles from './AdminOpsBoard.module.css'

interface AdminIncidentsBoardProps {
  events: AdminSecurityEvent[]
  locks: AdminLoginLock[]
  isLoading: boolean
  error: string | null
}

function formatWhen(date: Date) {
  if (!date.getTime()) {
    return '—'
  }
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function AdminIncidentsBoard({ events, locks, isLoading, error }: AdminIncidentsBoardProps) {
  const activeLocks = locks.filter((lock) => lock.lockedUntil && lock.lockedUntil.getTime() > Date.now())

  return (
    <div className={styles.wrap}>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.kpis}>
        <article>
          <strong>{events.length}</strong>
          <span>Eventos recientes</span>
        </article>
        <article>
          <strong>{activeLocks.length}</strong>
          <span>Cierres de login</span>
        </article>
        <article>
          <strong>{events.filter((event) => event.severity === 'high' || event.severity === 'critical').length}</strong>
          <span>Altos</span>
        </article>
        <article>
          <strong>{locks.filter((lock) => lock.attemptCount >= 5).length}</strong>
          <span>Con 5+ intentos</span>
        </article>
      </div>

      {isLoading ? <p className={styles.empty}>Cargando incidencias…</p> : null}

      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Login bloqueado</th>
              <th>Intentos</th>
              <th>Hasta</th>
            </tr>
          </thead>
          <tbody>
            {locks.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.empty}>No hay bloqueos de acceso guardados.</td>
              </tr>
            ) : locks.map((lock) => (
              <tr key={lock.id}>
                <td><strong>{lock.id}</strong></td>
                <td>{lock.attemptCount}</td>
                <td>{lock.lockedUntil ? formatWhen(lock.lockedUntil) : 'Libre'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Detalle</th>
              <th>Cuándo</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.empty}>Todavía no hay alertas de seguridad en producción.</td>
              </tr>
            ) : events.map((event) => (
              <tr key={event.id}>
                <td>
                  <strong>{event.type}</strong>
                  <em>{event.severity}</em>
                </td>
                <td>
                  {event.email || event.resource || '—'}
                  {event.action ? <em>{event.action}</em> : null}
                </td>
                <td>{formatWhen(event.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default AdminIncidentsBoard
