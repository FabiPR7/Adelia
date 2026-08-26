import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { changeInitialPassword } from '../services/auth'
import { getFirestoreErrorMessage } from '../services/firestore'
import { validatePasswordStrength } from '../utils/passwordValidation'
import { ADELIA_LOGO_URL } from '../constants/brand'
import styles from './LoginPage.module.css'

function ChangePasswordPage() {
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const validation = validatePasswordStrength(newPassword)
    if (!validation.isValid) {
      setError(validation.errors[0] ?? 'La nueva contraseña no cumple los requisitos.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    if (currentPassword === newPassword) {
      setError('La nueva contraseña debe ser distinta a la actual.')
      return
    }

    setIsLoading(true)

    try {
      await changeInitialPassword(currentPassword, newPassword, profile?.companyId ?? null)
      await refreshProfile()
      navigate('/panel', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.'
      if (message.includes('permission') || message.includes('Firestore')) {
        setError(getFirestoreErrorMessage(err))
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.backgroundPattern} aria-hidden="true" />

      <main className={`${styles.container} ${styles.containerSingle}`}>
        <section className={styles.card}>
          <header className={styles.header}>
            <div className={styles.logoWrapper}>
              <img
                src={ADELIA_LOGO_URL}
                alt="Adelia — Akita Inu"
                className={styles.logo}
              />
            </div>
            <h1 className={styles.title}>Nueva contraseña</h1>
            <p className={styles.subtitle}>
              {profile?.email
                ? 'Por seguridad, debes elegir tu propia contraseña antes de continuar.'
                : 'Por seguridad, elige tu contraseña personal antes de continuar.'}
            </p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="currentPassword" className={styles.label}>
                Contraseña actual
              </label>
              <input
                id="currentPassword"
                type="password"
                className={styles.input}
                placeholder="Contraseña actual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="newPassword" className={styles.label}>
                Nueva contraseña
              </label>
              <input
                id="newPassword"
                type="password"
                className={styles.input}
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Repetir nueva contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={styles.input}
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </form>

          <footer className={styles.footer}>
            <p>Esta contraseña será la que uses a partir de ahora para acceder.</p>
          </footer>
        </section>
      </main>
    </div>
  )
}

export default ChangePasswordPage
