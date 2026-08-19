import styles from './AdminErrorState.module.css'

interface AdminErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

function AdminErrorState({
  title = 'Error al cargar datos',
  message,
  onRetry,
}: AdminErrorStateProps) {
  return (
    <div className={styles.error}>
      <div className={styles.icon}>⚠️</div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          🔄 Reintentar
        </button>
      )}
    </div>
  )
}

export default AdminErrorState
