import styles from './UnsavedChangesDialog.module.css'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  sectionLabel: string
  isSaving?: boolean
  onStay: () => void
  onDiscard: () => void
  onSave: () => void
}

function UnsavedChangesDialog({
  isOpen,
  sectionLabel,
  isSaving = false,
  onStay,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-message"
      >
        <h2 id="unsaved-title" className={styles.title}>
          Cambios sin guardar
        </h2>
        <p id="unsaved-message" className={styles.message}>
          Tienes ajustes sin guardar en <strong>{sectionLabel}</strong>. ¿Qué quieres hacer?
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.stayButton} onClick={onStay} disabled={isSaving}>
            Seguir editando
          </button>
          <button type="button" className={styles.discardButton} onClick={onDiscard} disabled={isSaving}>
            Descartar
          </button>
          <button type="button" className={styles.saveButton} onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UnsavedChangesDialog
