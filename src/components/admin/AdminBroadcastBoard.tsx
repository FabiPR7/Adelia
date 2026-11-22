import { useState } from 'react'
import type { AdminCompany } from '../../types'
import { adminApi, type BroadcastTarget } from '../../services/adminApi'
import { findCustomerIdByEmail } from '../../services/adminOps'
import ConfirmDialog from '../ConfirmDialog'
import styles from './AdminPanel.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

const TARGETS: Array<{ id: BroadcastTarget; label: string; hint: string }> = [
  { id: 'allCustomers', label: 'Todos los clientes', hint: 'Les llega a la campana de notificaciones de la web y la app.' },
  { id: 'allCompanies', label: 'Todos los restaurantes', hint: 'Les llega a las notificaciones del panel de empresa.' },
  { id: 'customer', label: 'Un cliente', hint: 'Escribe su correo.' },
  { id: 'company', label: 'Un restaurante', hint: 'Elige el local.' },
]

interface AdminBroadcastBoardProps {
  companies: AdminCompany[]
}

/** Avisos dentro de Adelia (no son correos ni SMS). */
function AdminBroadcastBoard({ companies }: AdminBroadcastBoardProps) {
  const [target, setTarget] = useState<BroadcastTarget>('allCustomers')
  const [email, setEmail] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const current = TARGETS.find((entry) => entry.id === target)!
  const sortedCompanies = [...companies].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const [confirmMass, setConfirmMass] = useState(false)

  const send = async (massConfirmed = false) => {
    setResult(null)
    const isMass = target === 'allCustomers' || target === 'allCompanies'
    // Confirmación propia: window.confirm lo bloquean muchos navegadores.
    if (isMass && !massConfirmed) {
      setConfirmMass(true)
      return
    }
    setConfirmMass(false)
    setBusy(true)
    try {
      let id: string | undefined
      if (target === 'customer') {
        const found = await findCustomerIdByEmail(email)
        if (!found) {
          setResult({ ok: false, text: 'No hay ningún cliente con ese correo.' })
          return
        }
        id = found
      } else if (target === 'company') {
        if (!companyId) {
          setResult({ ok: false, text: 'Elige un restaurante.' })
          return
        }
        id = companyId
      }
      const response = await adminApi.notify({
        target,
        id,
        title: title.trim(),
        body: body.trim(),
        actionUrl: actionUrl.trim() || undefined,
      })
      setResult({
        ok: true,
        text: response.capped
          ? `Enviado a ${response.sent}. Hay más destinatarios: vuelve a enviarlo para llegar al resto.`
          : `Enviado a ${response.sent} ${response.sent === 1 ? 'destinatario' : 'destinatarios'}.`,
      })
      setTitle('')
      setBody('')
      setActionUrl('')
    } catch (err) {
      setResult({ ok: false, text: friendlyErrorMessage(err, 'No se pudo enviar.') })
    } finally {
      setBusy(false)
    }
  }

  const ready = title.trim() && body.trim()
    && (target !== 'customer' || email.includes('@'))
    && (target !== 'company' || companyId)

  return (
    <div className={styles.wrap}>
      <ConfirmDialog
        isOpen={confirmMass}
        title="Enviar a todos"
        message={'¿Enviar «' + title.trim() + '» a ' + current.label.toLowerCase() + '? No se puede deshacer.'}
        confirmLabel="Sí, enviar"
        cancelLabel="Cancelar"
        isLoading={busy}
        onConfirm={() => void send(true)}
        onCancel={() => setConfirmMass(false)}
      />
      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Nuevo aviso</h3>
            <p>{current.hint}</p>
          </div>

          <div className={styles.segment} role="tablist" aria-label="Destinatarios" style={{ flexWrap: 'wrap', marginBottom: '0.9rem' }}>
            {TARGETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={target === entry.id}
                className={target === entry.id ? styles.segmentOn : ''}
                onClick={() => setTarget(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className={styles.formGrid}>
            {target === 'customer' ? (
              <label className={`${styles.field} ${styles.full}`}>
                Correo del cliente
                <input className={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@correo.com" />
              </label>
            ) : null}
            {target === 'company' ? (
              <label className={`${styles.field} ${styles.full}`}>
                Restaurante
                <select className={styles.input} value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                  <option value="">Elige un restaurante…</option>
                  {sortedCompanies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}{company.municipality ? ` · ${company.municipality}` : ''}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={`${styles.field} ${styles.full}`}>
              Título
              <input className={styles.input} maxLength={90} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. ¡Nuevas promociones este fin de semana!" />
            </label>
            <label className={`${styles.field} ${styles.full}`}>
              Mensaje
              <textarea className={styles.input} maxLength={500} value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            {target === 'allCustomers' || target === 'customer' ? (
              <label className={`${styles.field} ${styles.full}`}>
                Enlace dentro de Adelia (opcional)
                <input className={styles.input} value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} placeholder="/app/promociones" />
              </label>
            ) : null}
          </div>

          {result ? (
            <div className={`${styles.notice} ${result.ok ? styles.noticeGood : styles.noticeBad}`} style={{ marginTop: '0.8rem' }}>
              {result.text}
            </div>
          ) : null}

          <div className={styles.row} style={{ marginTop: '0.9rem' }}>
            <button type="button" className={styles.button} disabled={busy || !ready} onClick={() => void send()}>
              {busy ? 'Enviando…' : 'Enviar aviso'}
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Vista previa</h3>
          </div>
          <div className={styles.card} style={{ background: '#fff', display: 'flex', gap: '0.75rem' }}>
            <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>📣</span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block' }}>{title.trim() || 'Título del aviso'}</strong>
              <p className={styles.muted} style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{body.trim() || 'Aquí va el mensaje.'}</p>
            </div>
          </div>
          <p className={styles.muted} style={{ marginTop: '0.8rem' }}>
            Los envíos masivos llegan a 5.000 destinatarios por vez. Todos quedan apuntados en Seguridad → Registro de cambios.
          </p>
        </section>
      </div>
    </div>
  )
}

export default AdminBroadcastBoard
