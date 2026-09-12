import { Link } from 'react-router-dom'
import styles from './StatusScreen.module.css'

export type StatusAction = {
  label: string
  /** Ruta interna (navegación SPA). Si se omite, se usa `onClick`. */
  to?: string
  onClick?: () => void
  variant?: 'primary' | 'ghost'
}

type StatusScreenProps = {
  code: string
  title: string
  message: string
  actions: StatusAction[]
}

/**
 * Pantalla a página completa para estados terminales (404, error inesperado).
 * Presentacional: no sabe por qué se muestra, solo cómo.
 */
export default function StatusScreen({ code, title, message, actions }: StatusScreenProps) {
  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.code}>{code}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {actions.map((action) => {
            const className = action.variant === 'ghost' ? styles.ghost : styles.primary
            if (action.to) {
              return (
                <Link key={action.label} to={action.to} className={className}>
                  {action.label}
                </Link>
              )
            }
            return (
              <button key={action.label} type="button" className={className} onClick={action.onClick}>
                {action.label}
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
