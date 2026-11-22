import { useEffect, useState } from 'react'
import ReasonDialog from '../ReasonDialog'
import { adminApi, type AdminCompanySummary } from '../../services/adminApi'
import styles from './AdminPanel.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada',
  completed: 'Pendiente',
  cancelled: 'Cancelada',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface AdminCompanyActivityProps {
  companyId: string
  onChanged: () => void
}

/** Actividad real del local (reservas, reseñas, cobro) y botón para darlo de baja temporal. */
function AdminCompanyActivity({ companyId, onChanged }: AdminCompanyActivityProps) {
  const [summary, setSummary] = useState<AdminCompanySummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSummary(null)
    setError(null)
    void adminApi.companySummary(companyId)
      .then((data) => { if (!cancelled) setSummary(data) })
      .catch((err) => { if (!cancelled) setError(friendlyErrorMessage(err, 'No se pudo cargar.')) })
    return () => { cancelled = true }
  }, [companyId])

  const [askReason, setAskReason] = useState(false)

  const toggleActive = async (reasonFromDialog?: string) => {
    if (!summary) return
    const activate = summary.deactivated
    // Para desactivar se pide el motivo con un diálogo propio (window.prompt lo bloquean muchos navegadores).
    if (!activate && reasonFromDialog === undefined) {
      setAskReason(true)
      return
    }
    const reason = activate ? '' : reasonFromDialog ?? ''
    setAskReason(false)
    setBusy(true)
    try {
      const result = await adminApi.setCompanyActive(companyId, activate, reason)
      setSummary({ ...summary, deactivated: result.deactivated })
      onChanged()
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo cambiar.'))
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <div className={`${styles.notice} ${styles.noticeBad}`}>{error}</div>
  }
  if (!summary) {
    return <div className={styles.skeleton} style={{ height: 150 }} />
  }

  const { reservations, billing } = summary
  return (
    <section className={styles.card} aria-label="Actividad del local">
      <ReasonDialog
        isOpen={askReason}
        title="Desactivar local"
        message="Dejará de aparecer en el buscador y no aceptará reservas nuevas hasta que lo reactives. Sus datos se conservan."
        confirmLabel="Sí, desactivar"
        isLoading={busy}
        onConfirm={(reason) => void toggleActive(reason)}
        onCancel={() => setAskReason(false)}
      />
      <div className={styles.cardHead}>
        <h3>Actividad</h3>
        <div className={styles.row}>
          {summary.slug ? (
            <a className={styles.buttonGhost} href={`/reservar/${summary.slug}`} target="_blank" rel="noreferrer">Ver ficha pública</a>
          ) : null}
          <button
            type="button"
            className={summary.deactivated ? styles.button : styles.buttonDanger}
            disabled={busy}
            onClick={() => void toggleActive()}
          >
            {summary.deactivated ? 'Reactivar local' : 'Desactivar local'}
          </button>
        </div>
      </div>

      {summary.deactivated ? (
        <p className={`${styles.notice} ${styles.noticeBad}`} style={{ marginBottom: '0.8rem' }}>
          Desactivado: no aparece en el buscador ni acepta reservas nuevas.
        </p>
      ) : null}

      <div className={styles.statRow}>
        <div><span>Reservas</span><strong>{reservations.total}</strong></div>
        <div><span>Próximas</span><strong>{reservations.upcoming}</strong></div>
        <div><span>Canceladas</span><strong>{reservations.total > 0 ? `${Math.round((reservations.cancelled / reservations.total) * 100)}%` : '—'}</strong></div>
        <div><span>Reseñas</span><strong>{summary.reviews.average ? `${summary.reviews.average.toFixed(1)}★` : '—'}</strong></div>
      </div>

      <div className={styles.row} style={{ margin: '0.8rem 0' }}>
        <span className={styles.chip}>{summary.promotionClaims} promociones canjeadas</span>
        <span className={styles.chip}>{summary.reviews.count} reseñas</span>
        {billing.lemonSubscriptionId ? (
          <span className={`${styles.chip} ${styles.chipGood}`}>Cobro automático con Lemon</span>
        ) : billing.planId !== 'free' ? (
          <span className={`${styles.chip} ${styles.chipWarn}`}>Cobro manual</span>
        ) : null}
        {billing.lemonPending ? <span className={`${styles.chip} ${styles.chipWarn}`}>Pago pendiente de vincular</span> : null}
        {billing.pendingPlanId ? <span className={styles.chip}>Cambio de plan programado: {billing.pendingPlanId}</span> : null}
        {billing.lemonPortalUrl ? (
          <a className={styles.chip} href={billing.lemonPortalUrl} target="_blank" rel="noreferrer">Portal de facturación</a>
        ) : null}
      </div>

      {summary.recent.length > 0 ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr><th>Últimas reservas</th><th>Fecha</th><th className={styles.num}>Pers.</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {summary.recent.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.clientName || 'Cliente'}</td>
                  <td>{formatDate(reservation.startTime)}</td>
                  <td className={styles.num}>{reservation.pax}</td>
                  <td>
                    <span className={`${styles.chip} ${reservation.status === 'cancelled' ? styles.chipBad : reservation.status === 'completed' ? styles.chipGood : ''}`}>
                      {STATUS_LABEL[reservation.status] ?? reservation.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.muted}>Aún no tiene reservas.</p>
      )}
    </section>
  )
}

export default AdminCompanyActivity
