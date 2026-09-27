import styles from './SomethingWentWrongPage.module.css'

type SomethingWentWrongPageProps = {
  onRetry?: () => void
  /** Si true, el reintento recarga la página entera (errores de providers). */
  hardReload?: boolean
}

/**
 * Pantalla amistosa para fallos inesperados. Presentacional: no decide
 * cómo recuperarse más allá de los botones que le pasan.
 */
export default function SomethingWentWrongPage({
  onRetry,
  hardReload = false,
}: SomethingWentWrongPageProps) {
  const handleRetry = () => {
    if (hardReload || !onRetry) {
      window.location.reload()
      return
    }
    onRetry()
  }

  return (
    <main className={styles.page} role="alert" aria-live="assertive">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.brand}>Adelia</p>
        <h1 className={styles.title}>Algo salió mal</h1>
        <p className={styles.message}>
          Ha ocurrido un problema inesperado. No es culpa tuya: prueba de nuevo
          y, si sigue pasando, vuelve al inicio o recarga la página.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={handleRetry}>
            {hardReload || !onRetry ? 'Recargar la página' : 'Intentar de nuevo'}
          </button>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => window.location.assign('/')}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </main>
  )
}
