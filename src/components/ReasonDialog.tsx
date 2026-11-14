import { useEffect, useState } from 'react'
import styles from './ConfirmDialog.module.css'

interface ReasonDialogProps {
  isOpen: boolean
  title: string
  message: string
  reasonLabel?: string
  confirmLabel?: string
  cancelLabel?: string
  requireReason?: boolean
  isLoading?: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

/**
 * Confirmación con motivo. Sustituye a window.prompt, que muchos navegadores
 * (móvil, apps, vistas integradas) bloquean y dejaba el botón sin hacer nada.
 */
function ReasonDialog({
  isOpen,
  title,
  message,
  reasonLabel = 'Motivo (queda en el registro)',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  requireReason = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const canConfirm = !requireReason || reason.trim().length >= 3

  return (
    <div className={`${styles.overlay} ${styles.overlayElevated}`} onClick={onCancel} role="presentation">
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reason-dialog-title"
        aria-describedby="reason-dialog-message"
      >
        <h2 id="reason-dialog-title" className={styles.title}>{title}</h2>
        <p id="reason-dialog-message" className={styles.message}>{message}</p>
        <label style={{ display: 'grid', gap: 6, marginBottom: 16, fontSize: '0.85rem', fontWeight: 600 }}>
          {reasonLabel}
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 300))}
            autoFocus
            style={{ minHeight: 40, padding: '0 10px', border: '1px solid var(--color-border)', borderRadius: 8, font: 'inherit' }}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.confirmButton} ${styles.confirmButtonDanger}`}
            onClick={() => onConfirm(reason.trim())}
            disabled={isLoading || !canConfirm}
          >
            {isLoading ? 'Guardando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReasonDialog
