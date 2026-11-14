import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  REPORT_REASON_OPTIONS,
  SUGGESTION_TOPIC_OPTIONS,
  sendRestaurantReport,
  sendSuggestion,
  type ReportReason,
  type SuggestionTopic,
} from '../services/supportInboxApi'
import styles from './SupportMessageModal.module.css'

type SupportMessageModalProps =
  | {
      kind: 'report'
      companyId: string
      companyName: string
      reservationId?: string
      promotionId?: string
      onClose: () => void
    }
  | {
      kind: 'suggestion'
      onClose: () => void
    }

const MIN_LENGTH = { report: 15, suggestion: 10 } as const

/** Formulario para reportar un restaurante o enviarnos una sugerencia. */
function SupportMessageModal(props: SupportMessageModalProps) {
  const { kind, onClose } = props
  const titleId = useId()
  const [choice, setChoice] = useState('')
  const [message, setMessage] = useState('')
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

  const options = kind === 'report' ? REPORT_REASON_OPTIONS : SUGGESTION_TOPIC_OPTIONS
  const minLength = MIN_LENGTH[kind]
  const trimmedLength = message.trim().length

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!choice) {
      setError(kind === 'report' ? 'Elige qué pasó.' : 'Elige de qué trata.')
      return
    }
    if (trimmedLength < minLength) {
      setError(`Cuéntanos un poco más (al menos ${minLength} caracteres).`)
      return
    }
    setSending(true)
    try {
      if (props.kind === 'report') {
        await sendRestaurantReport({
          companyId: props.companyId,
          reason: choice as ReportReason,
          message: message.trim(),
          ...(props.reservationId ? { reservationId: props.reservationId } : {}),
          ...(props.promotionId ? { promotionId: props.promotionId } : {}),
        })
      } else {
        await sendSuggestion({ topic: choice as SuggestionTopic, message: message.trim() })
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const title = kind === 'report' ? `Reportar a ${props.kind === 'report' ? props.companyName : ''}` : 'Envíanos una sugerencia'

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
        <h2 id={titleId} className={styles.title}>{title}</h2>

        {sent ? (
          <div className={styles.sent} role="status">
            <p>
              {kind === 'report'
                ? 'Gracias. Lo revisaremos y, si hace falta, te escribiremos a tu correo. El restaurante no ve quién lo ha reportado.'
                : 'Gracias por escribirnos. Leemos todas las sugerencias y, si hace falta, te contestamos a tu correo.'}
            </p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} noValidate>
            <p className={styles.lead}>
              {kind === 'report'
                ? 'Si no te dieron la promoción, no respetaron tu reserva o algo no fue como debía, cuéntanoslo. Solo lo vemos nosotros.'
                : 'Ideas, fallos, restaurantes que te gustaría ver… Te leemos.'}
            </p>

            <fieldset className={styles.choices}>
              <legend className={styles.label}>{kind === 'report' ? '¿Qué pasó?' : '¿De qué trata?'}</legend>
              {options.map((option) => (
                <label key={option.value} className={`${styles.choice} ${choice === option.value ? styles.choiceOn : ''}`}>
                  <input
                    type="radio"
                    name="support-choice"
                    value={option.value}
                    checked={choice === option.value}
                    onChange={() => setChoice(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <label className={styles.label} htmlFor={`${titleId}-msg`}>
              {kind === 'report' ? 'Cuéntanos qué pasó' : 'Tu mensaje'}
            </label>
            <textarea
              id={`${titleId}-msg`}
              className={styles.textarea}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={kind === 'report' ? 1500 : 2000}
              rows={5}
              placeholder={kind === 'report' ? 'Fui el sábado con la promo 2×1 y no me la quisieron aplicar…' : 'Me gustaría que…'}
            />
            <p className={styles.counter}>
              {trimmedLength < minLength ? `Mínimo ${minLength} caracteres` : `${trimmedLength} caracteres`}
            </p>

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={onClose} disabled={sending}>
                Cancelar
              </button>
              <button type="submit" className={styles.primary} disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default SupportMessageModal
