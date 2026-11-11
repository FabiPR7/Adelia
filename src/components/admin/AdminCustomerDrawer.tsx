import { useEffect, useState } from 'react'
import { adminApi, type AdminCustomerDetail } from '../../services/adminApi'
import { getGamificationLevelTitle } from '../../data/gamificationLevels'
import { getInventoryItem, INVENTORY_ITEMS } from '../../data/inventoryItems'
import styles from './AdminPanel.module.css'

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const num = new Intl.NumberFormat('es-ES')

function formatDate(value: string | null, withTime = false): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-ES', withTime
    ? { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' })
}

interface AdminCustomerDrawerProps {
  customerId: string
  companyNames: Map<string, string>
  onClose: () => void
  onChanged: (patch: { id: string; blocked?: boolean; xp?: number; adelinas?: number }) => void
}

/** Ficha completa de un cliente con todo lo que se le puede cambiar. */
function AdminCustomerDrawer({ customerId, companyNames, onClose, onChanged }: AdminCustomerDrawerProps) {
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [xpDelta, setXpDelta] = useState('')
  const [adelinasDelta, setAdelinasDelta] = useState('')
  const [itemId, setItemId] = useState(INVENTORY_ITEMS[0]?.id ?? '')
  const [itemQty, setItemQty] = useState('')
  const [reason, setReason] = useState('')

  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')

  const load = async () => {
    setError(null)
    try {
      setDetail(await adminApi.customer(customerId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el cliente.')
    }
  }

  useEffect(() => {
    setDetail(null)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setMessage(await action())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar.')
    } finally {
      setBusy(false)
    }
  }

  const applyAdjust = () => run(async () => {
    const xp = Number(xpDelta) || 0
    const adelinas = Number(adelinasDelta) || 0
    const quantity = Number(itemQty) || 0
    const result = await adminApi.adjustCustomer(customerId, {
      xpDelta: xp,
      adelinasDelta: adelinas,
      items: quantity !== 0 && itemId ? [{ itemId, quantity }] : [],
      reason: reason.trim(),
    })
    setXpDelta('')
    setAdelinasDelta('')
    setItemQty('')
    setReason('')
    onChanged({ id: customerId, xp: result.xp, adelinas: result.adelinas })
    await load()
    return 'Ajuste guardado y apuntado en el registro.'
  })

  const toggleBlock = () => run(async () => {
    if (!detail) return ''
    const next = !detail.blocked
    const why = next ? window.prompt('¿Por qué lo bloqueas? (se guarda en el registro)') : ''
    if (why === null) return ''
    await adminApi.blockCustomer(customerId, next, why ?? '')
    setDetail({ ...detail, blocked: next })
    onChanged({ id: customerId, blocked: next })
    return next ? 'Cliente bloqueado: no podrá reservar.' : 'Cliente desbloqueado.'
  })

  const sendNotice = () => run(async () => {
    await adminApi.notify({ target: 'customer', id: customerId, title: noticeTitle.trim(), body: noticeBody.trim() })
    setNoticeTitle('')
    setNoticeBody('')
    return 'Aviso enviado. Le aparecerá en sus notificaciones.'
  })

  const canAdjust = reason.trim().length > 0 && (Number(xpDelta) || Number(adelinasDelta) || Number(itemQty))

  return (
    <div className={styles.drawerBackdrop} onClick={onClose} role="presentation">
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Ficha del cliente"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.drawerHead}>
          <div>
            <p className={styles.muted}>Ficha del cliente</p>
            <h2>{detail?.displayName || 'Cliente'}</h2>
            {detail ? (
              <p className={styles.muted}>
                {detail.email}{detail.loginName ? ` · @${detail.loginName}` : ''}{detail.municipality ? ` · ${detail.municipality}` : ''}
              </p>
            ) : null}
          </div>
          <button type="button" className={styles.buttonGhost} onClick={onClose} aria-label="Cerrar">Cerrar</button>
        </div>

        {error ? <div className={`${styles.notice} ${styles.noticeBad}`}>{error}</div> : null}
        {message ? <div className={`${styles.notice} ${styles.noticeGood}`}>{message}</div> : null}

        {!detail ? (
          error ? null : <div className={styles.skeleton} />
        ) : (
          <>
            <div className={styles.row}>
              {detail.blocked ? <span className={`${styles.chip} ${styles.chipBad}`}>Bloqueado</span> : <span className={`${styles.chip} ${styles.chipGood}`}>Activo</span>}
              <span className={`${styles.chip} ${detail.phoneVerified ? styles.chipGood : styles.chipWarn}`}>
                {detail.phoneVerified ? 'Teléfono verificado' : 'Teléfono sin verificar'}
              </span>
              {!detail.onboardingCompleted ? <span className={`${styles.chip} ${styles.chipWarn}`}>Registro sin terminar</span> : null}
              {detail.cancellationStrikes > 0 ? (
                <span className={`${styles.chip} ${styles.chipWarn}`}>{detail.cancellationStrikes} penalización(es) por cancelar</span>
              ) : null}
              <span className={styles.chip}>Alta {formatDate(detail.createdAt)}</span>
            </div>

            <div className={styles.statRow}>
              <div><span>Nivel</span><strong>{detail.level ?? '—'}</strong></div>
              <div><span>XP</span><strong>{num.format(detail.xp)}</strong></div>
              <div><span>Adelinás</span><strong>{num.format(detail.adelinas)}</strong></div>
              <div><span>Reservas</span><strong>{detail.reservations.length}</strong></div>
            </div>
            {detail.level ? <p className={styles.muted}>Rango: {getGamificationLevelTitle(detail.level)}</p> : null}

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Ajustar puntos y objetos</h3>
                <p>Usa números negativos para quitar</p>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  XP
                  <input className={styles.input} inputMode="numeric" value={xpDelta} onChange={(event) => setXpDelta(event.target.value)} placeholder="Ej. 500 o -200" />
                </label>
                <label className={styles.field}>
                  Adelinás
                  <input className={styles.input} inputMode="numeric" value={adelinasDelta} onChange={(event) => setAdelinasDelta(event.target.value)} placeholder="Ej. 20" />
                </label>
                <label className={styles.field}>
                  Objeto
                  <select className={styles.input} value={itemId} onChange={(event) => setItemId(event.target.value)}>
                    {INVENTORY_ITEMS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  Cantidad
                  <input className={styles.input} inputMode="numeric" value={itemQty} onChange={(event) => setItemQty(event.target.value)} placeholder="Ej. 1 o -1" />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  Motivo (obligatorio, queda en el registro)
                  <input className={styles.input} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Compensación por error en una reserva" />
                </label>
              </div>
              <div className={styles.row} style={{ marginTop: '0.8rem' }}>
                <button type="button" className={styles.button} disabled={busy || !canAdjust} onClick={() => void applyAdjust()}>
                  Guardar ajuste
                </button>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Objetos que tiene</h3>
              </div>
              {detail.inventory.length === 0 ? (
                <p className={styles.muted}>No tiene objetos.</p>
              ) : (
                <div className={styles.row}>
                  {detail.inventory.map((entry) => (
                    <span key={entry.itemId} className={styles.chip}>
                      {getInventoryItem(entry.itemId)?.name ?? entry.itemId} × {entry.quantity}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Mandarle un aviso</h3>
                <p>Le llega a sus notificaciones</p>
              </div>
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.full}`}>
                  Título
                  <input className={styles.input} maxLength={90} value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} />
                </label>
                <label className={`${styles.field} ${styles.full}`}>
                  Mensaje
                  <textarea className={styles.input} maxLength={500} value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} />
                </label>
              </div>
              <div className={styles.row} style={{ marginTop: '0.8rem' }}>
                <button type="button" className={styles.button} disabled={busy || !noticeTitle.trim() || !noticeBody.trim()} onClick={() => void sendNotice()}>
                  Enviar aviso
                </button>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Reservas</h3>
                <p>Las 25 más recientes</p>
              </div>
              {detail.reservations.length === 0 ? (
                <p className={styles.muted}>No ha reservado con su cuenta.</p>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Restaurante</th><th>Fecha</th><th className={styles.num}>Pers.</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {detail.reservations.map((reservation) => (
                        <tr key={reservation.id}>
                          <td>{companyNames.get(reservation.companyId) ?? 'Restaurante'}</td>
                          <td>{formatDate(reservation.startTime, true)}</td>
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
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.spread}>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>{detail.blocked ? 'Desbloquear cuenta' : 'Bloquear cuenta'}</h3>
                  <p className={styles.muted}>{detail.blocked ? 'Volverá a poder reservar.' : 'No podrá reservar ni canjear promociones.'}</p>
                </div>
                <button type="button" className={detail.blocked ? styles.button : styles.buttonDanger} disabled={busy} onClick={() => void toggleBlock()}>
                  {detail.blocked ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>
            </section>
          </>
        )}
      </aside>
    </div>
  )
}

export default AdminCustomerDrawer
