import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  CONTENT_REPORT_REASON_OPTIONS,
  sendContentReport,
  type ContentReportReason,
  type ContentReportTarget,
} from '../services/supportInboxApi'
import { blockUser } from '../services/customerFriends'
import styles from './SupportMessageModal.module.css'

interface ReportContentModalProps {
  target: ContentReportTarget
  /** Nombre de quien escribió la reseña o del usuario reportado. */
  authorName: string
  /** Uid del autor para ofrecer bloquearle a la vez (si no eres tú). */
  blockableUid?: string | null
  onClose: () => void
  /** Se llama si además lo has bloqueado. */
  onBlocked?: (uid: string) => void
}

/** Reportar una reseña o a un usuario. Lo revisa el equipo de Adelia. */
function ReportContentModal({ target, authorName, blockableUid, onClose, onBlocked }: ReportContentModalProps) {
  const titleId = useId()
  const [reason, setReason] = useState<ContentReportReason | ''>('')
  const [message, setMessage] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sending])

  const isReview = target.targetType === 'review'
  const name = authorName.trim() || 'este usuario'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!reason) {
      setError('Elige un motivo.')
      return
    }
    setSending(true)
    try {
      await sendContentReport(target, { reason, message: message.trim() })
      if (alsoBlock && blockableUid) {
        await blockUser(blockableUid)
        onBlocked?.(blockableUid)
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={() => { if (!sending) onClose() }}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} disabled={sending} aria-label="Cerrar">
          ✕
        </button>
        <h2 id={titleId} className={styles.title}>
          {isReview ? `Reportar la reseña de ${name}` : `Reportar a ${name}`}
        </h2>

        {sent ? (
          <div className={styles.sent} role="status">
            <p>
              Gracias. Lo revisamos en menos de 24 horas y, si incumple las normas, lo retiramos.
              {alsoBlock ? ` Has bloqueado a ${name}: ya no verás su contenido.` : ''} Nadie sabe quién lo ha reportado.
            </p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} noValidate>
            <p className={styles.lead}>
              {isReview
                ? 'Si esta reseña es ofensiva, falsa o no respeta las normas, avísanos.'
                : 'Si esta persona te molesta o publica algo inadecuado, avísanos.'}
            </p>

            <fieldset className={styles.choices}>
              <legend className={styles.label}>¿Qué pasa?</legend>
              {CONTENT_REPORT_REASON_OPTIONS.map((option) => (
                <label key={option.value} className={`${styles.choice} ${reason === option.value ? styles.choiceOn : ''}`}>
                  <input
                    type="radio"
                    name="content-report-reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <label className={styles.label} htmlFor={`${titleId}-msg`}>
              Algo más (opcional)
            </label>
            <textarea
              id={`${titleId}-msg`}
              className={styles.textarea}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1500}
              rows={3}
            />

            {blockableUid ? (
              <label className={`${styles.choice} ${alsoBlock ? styles.choiceOn : ''}`}>
                <input type="checkbox" checked={alsoBlock} onChange={(event) => setAlsoBlock(event.target.checked)} />
                Bloquear también a {name} (no verás sus reseñas ni podrá agregarte)
              </label>
            ) : null}

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={onClose} disabled={sending}>
                Cancelar
              </button>
              <button type="submit" className={styles.primary} disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default ReportContentModal
