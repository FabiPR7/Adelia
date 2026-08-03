import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPasswordWithToken, validatePasswordResetToken } from '../services/authApi'
import { ADELIA_LOGO_URL } from '../constants/brand'
import styles from './LoginPage.module.css'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [companyName, setCompanyName] = useState('')
  const [isValidating, setIsValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setTokenValid(false)
      setIsValidating(false)
      return
    }

    let cancelled = false

    void validatePasswordResetToken(token).then((result) => {
      if (cancelled) {
        return
      }

      setTokenValid(result.valid)
      setCompanyName(result.companyName ?? '')
      setIsValidating(false)
    })

    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setIsLoading(true)

    try {
      await resetPasswordWithToken(token, newPassword)
      navigate('/login', {
        replace: true,
        state: { passwordReset: true },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.')
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
              {companyName
                ? `Elige una contraseña nueva para ${companyName}.`
                : 'Elige una contraseña nueva para tu cuenta.'}
            </p>
          </header>

          {isValidating ? (
            <div className={styles.form}>
              <p className={styles.helperText}>Comprobando enlace…</p>
            </div>
          ) : !tokenValid ? (
            <div className={styles.form}>
              <div className={styles.error} role="alert">
                El enlace no es válido o ha caducado. Solicita uno nuevo.
              </div>
              <button
                type="button"
                className={styles.submitButton}
                onClick={() => navigate('/olvide-contrasena')}
              >
                Solicitar nuevo enlace
              </button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              {error && (
                <div className={styles.error} role="alert">
                  {error}
                </div>
              )}

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
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="confirmPassword" className={styles.label}>
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className={styles.input}
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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
                {isLoading ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          )}

          <footer className={styles.footer}>
            <p>
              <Link to="/login" className={styles.forgotLink}>
                Volver al inicio de sesión
              </Link>
            </p>
          </footer>
        </section>
      </main>
    </div>
  )
}

export default ResetPasswordPage
