import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adminApi,
  type AdminReportStatus,
  type AdminRestaurantReport,
  type AdminSuggestion,
  type AdminSuggestionStatus,
} from '../../services/adminApi'
import ops from './AdminOpsBoard.module.css'
import styles from './AdminInboxBoard.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

const REPORT_STATUS_LABEL: Record<AdminReportStatus, string> = {
  open: 'Nuevo',
  reviewing: 'Revisando',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
}

const SUGGESTION_STATUS_LABEL: Record<AdminSuggestionStatus, string> = {
  new: 'Nueva',
  read: 'Leída',
  done: 'Hecha',
}

const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function formatDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

type InboxTab = 'reports' | 'suggestions'

/** Reportes de restaurantes y sugerencias que envían los clientes. */
function AdminInboxBoard() {
  const [tab, setTab] = useState<InboxTab>('reports')
  const [reports, setReports] = useState<AdminRestaurantReport[]>([])
  const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showClosed, setShowClosed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [reportData, suggestionData] = await Promise.all([adminApi.reports(), adminApi.suggestions()])
      setReports(reportData.reports)
      setSuggestions(suggestionData.suggestions)
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo cargar el buzón.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openReports = reports.filter((report) => report.status === 'open' || report.status === 'reviewing')
  const newSuggestions = suggestions.filter((suggestion) => suggestion.status === 'new')

  // Locales con más de un reporte abierto: los que más hay que mirar.
  const repeatOffenders = useMemo(() => {
    const counts = new Map<string, number>()
    for (const report of openReports) counts.set(report.companyName, (counts.get(report.companyName) ?? 0) + 1)
    return [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1])
  }, [openReports])

  const visibleReports = showClosed ? reports : openReports
  const visibleSuggestions = showClosed ? suggestions : suggestions.filter((suggestion) => suggestion.status !== 'done')

  const updateReport = async (report: AdminRestaurantReport, status: AdminReportStatus) => {
    setSavingId(report.id)
    setError(null)
    try {
      await adminApi.setReportStatus(report.id, status, report.adminNote)
      setReports((current) => current.map((item) => (item.id === report.id ? { ...item, status } : item)))
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo guardar.'))
    } finally {
      setSavingId(null)
    }
  }

  // Reportes de reseñas o usuarios: el admin puede borrar la reseña o bloquear la cuenta.
  const deleteReportedReview = async (report: AdminRestaurantReport) => {
    if (!report.targetUid || !report.companyId) return
    if (!window.confirm(`¿Borrar la reseña de ${report.targetName || 'este cliente'} en ${report.companyName}? No se puede deshacer.`)) return
    setSavingId(report.id)
    setError(null)
    try {
      await adminApi.deleteReview(report.companyId, report.targetUid, `${report.companyId}_${report.targetUid}`)
      await adminApi.setReportStatus(report.id, 'resolved', report.adminNote || 'Reseña borrada')
      setReports((current) => current.map((item) => (item.id === report.id ? { ...item, status: 'resolved' } : item)))
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo borrar la reseña.'))
    } finally {
      setSavingId(null)
    }
  }

  const blockReportedUser = async (report: AdminRestaurantReport) => {
    if (!report.targetUid) return
    if (!window.confirm(`¿Bloquear la cuenta de ${report.targetName || 'este cliente'}? No podrá usar Adelia hasta que la desbloquees.`)) return
    setSavingId(report.id)
    setError(null)
    try {
      await adminApi.blockCustomer(report.targetUid, true, `Reporte ${report.id}: ${report.reasonLabel}`)
      await adminApi.setReportStatus(report.id, 'resolved', report.adminNote || 'Cuenta bloqueada')
      setReports((current) => current.map((item) => (item.id === report.id ? { ...item, status: 'resolved' } : item)))
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo bloquear la cuenta.'))
    } finally {
      setSavingId(null)
    }
  }

  const updateSuggestion = async (suggestion: AdminSuggestion, status: AdminSuggestionStatus) => {
    setSavingId(suggestion.id)
    setError(null)
    try {
      await adminApi.setSuggestionStatus(suggestion.id, status, suggestion.adminNote)
      setSuggestions((current) => current.map((item) => (item.id === suggestion.id ? { ...item, status } : item)))
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo guardar.'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className={ops.wrap} aria-label="Buzón de reportes y sugerencias">
      {error ? <div className={ops.error}>{error}</div> : null}

      <div className={ops.kpis}>
        <article>
          <strong>{openReports.length}</strong>
          <span>Reportes abiertos</span>
        </article>
        <article>
          <strong>{repeatOffenders.length}</strong>
          <span>Locales con 2+ reportes</span>
        </article>
        <article>
          <strong>{newSuggestions.length}</strong>
          <span>Sugerencias nuevas</span>
        </article>
        <article>
          <strong>{suggestions.length}</strong>
          <span>Sugerencias en total</span>
        </article>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'reports'} className={tab === 'reports' ? styles.tabOn : ''} onClick={() => setTab('reports')}>
            Reportes{openReports.length ? ` · ${openReports.length}` : ''}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'suggestions'} className={tab === 'suggestions' ? styles.tabOn : ''} onClick={() => setTab('suggestions')}>
            Sugerencias{newSuggestions.length ? ` · ${newSuggestions.length}` : ''}
          </button>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
          Ver también los cerrados
        </label>
        <button type="button" className={ops.ghost} onClick={() => void load()} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {tab === 'reports' && repeatOffenders.length > 0 ? (
        <p className={styles.alert}>
          Ojo: {repeatOffenders.map(([name, count]) => `${name} (${count})`).join(', ')} acumula{repeatOffenders.length === 1 ? '' : 'n'} varios reportes abiertos.
        </p>
      ) : null}

      <div className={styles.list}>
        {loading ? (
          <p className={ops.empty}>Cargando…</p>
        ) : tab === 'reports' ? (
          visibleReports.length === 0 ? (
            <p className={ops.empty}>{showClosed ? 'Aún no hay reportes.' : 'No hay reportes abiertos. Todo en orden.'}</p>
          ) : visibleReports.map((report) => (
            <article key={report.id} className={styles.item}>
              <header className={styles.itemHead}>
                <div>
                  <strong>
                    {report.targetType === 'review'
                      ? `Reseña de ${report.targetName || 'cliente'} · ${report.companyName}`
                      : report.targetType === 'user'
                        ? `Usuario: ${report.targetName || report.targetUid}`
                        : report.companyName || 'Restaurante'}
                  </strong>
                  <span className={styles.reason}>{report.reasonLabel}</span>
                </div>
                <span className={`${ops.chip} ${report.status === 'open' ? ops.pending : report.status === 'reviewing' ? ops.due : ops.paid}`}>
                  {REPORT_STATUS_LABEL[report.status] ?? report.status}
                </span>
              </header>
              {report.contentExcerpt ? <p className={styles.message}>«{report.contentExcerpt}»</p> : null}
              {report.message ? <p className={styles.message}>{report.message}</p> : null}
              <p className={styles.meta}>
                {[
                  formatDate(report.createdAt),
                  `${report.customerName || 'Cliente'} · ${report.customerEmail}`,
                  report.reservationStart ? `Reserva del ${formatDate(report.reservationStart)}` : '',
                  report.promotionTitle ? `Promo: ${report.promotionTitle}` : '',
                ].filter(Boolean).join(' · ')}
              </p>
              <div className={ops.actions}>
                {report.customerEmail ? (
                  <a className={styles.mailLink} href={`mailto:${report.customerEmail}?subject=${encodeURIComponent(`Tu reporte sobre ${report.companyName}`)}`}>
                    Escribir al cliente
                  </a>
                ) : null}
                {report.targetType === 'review' && report.status !== 'resolved' ? (
                  <button type="button" className={ops.ghost} disabled={savingId === report.id} onClick={() => void deleteReportedReview(report)}>
                    Borrar reseña
                  </button>
                ) : null}
                {(report.targetType === 'review' || report.targetType === 'user') && report.targetUid && report.status !== 'resolved' ? (
                  <button type="button" className={ops.ghost} disabled={savingId === report.id} onClick={() => void blockReportedUser(report)}>
                    Bloquear cuenta
                  </button>
                ) : null}
                {(['reviewing', 'resolved', 'dismissed', 'open'] as AdminReportStatus[])
                  .filter((status) => status !== report.status)
                  .map((status) => (
                    <button key={status} type="button" className={status === 'resolved' ? ops.primary : ops.ghost} disabled={savingId === report.id} onClick={() => void updateReport(report, status)}>
                      {status === 'open' ? 'Reabrir' : REPORT_STATUS_LABEL[status]}
                    </button>
                  ))}
              </div>
            </article>
          ))
        ) : visibleSuggestions.length === 0 ? (
          <p className={ops.empty}>{showClosed ? 'Aún no hay sugerencias.' : 'No hay sugerencias pendientes.'}</p>
        ) : visibleSuggestions.map((suggestion) => (
          <article key={suggestion.id} className={styles.item}>
            <header className={styles.itemHead}>
              <div>
                <strong>{suggestion.topicLabel || 'Sugerencia'}</strong>
                <span className={styles.reason}>{suggestion.customerName || 'Cliente'}</span>
              </div>
              <span className={`${ops.chip} ${suggestion.status === 'new' ? ops.pending : suggestion.status === 'read' ? ops.due : ops.paid}`}>
                {SUGGESTION_STATUS_LABEL[suggestion.status] ?? suggestion.status}
              </span>
            </header>
            <p className={styles.message}>{suggestion.message}</p>
            <p className={styles.meta}>{[formatDate(suggestion.createdAt), suggestion.customerEmail].filter(Boolean).join(' · ')}</p>
            <div className={ops.actions}>
              {suggestion.customerEmail ? (
                <a className={styles.mailLink} href={`mailto:${suggestion.customerEmail}?subject=${encodeURIComponent('Tu sugerencia en Adelia')}`}>
                  Contestar
                </a>
              ) : null}
              {(['read', 'done', 'new'] as AdminSuggestionStatus[])
                .filter((status) => status !== suggestion.status)
                .map((status) => (
                  <button key={status} type="button" className={status === 'done' ? ops.primary : ops.ghost} disabled={savingId === suggestion.id} onClick={() => void updateSuggestion(suggestion, status)}>
                    {status === 'new' ? 'Marcar como nueva' : `Marcar como ${SUGGESTION_STATUS_LABEL[status].toLowerCase()}`}
                  </button>
                ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default AdminInboxBoard
