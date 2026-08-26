import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { requestCustomerPasswordReset } from '../services/authApi'
import { ADELIA_LOGO_URL } from '../constants/brand'
import CustomerAuthShell from '../components/CustomerAuthShell'
import LegalLinks from '../components/LegalLinks'
import styles from './UserCustomerAuth.module.css'

function UserForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsLoading(true)

    try {
      const message = await requestCustomerPasswordReset(email.trim().toLowerCase())
      setSuccessMessage(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <CustomerAuthShell variant="login">
      <main className={styles.card}>
        <Link to="/cuenta/entrar" className={styles.backLink}>
          ← Volver
        </Link>

        <div className={styles.brandRow}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
          <div>
            <p className={styles.eyebrow}>Tu cuenta Adelia</p>
            <h1>¿Olvidaste la contraseña?</h1>
          </div>
        </div>

        <p className={styles.lead}>
          Escribe el correo de tu cuenta. Si existe, te enviaremos un enlace para elegir una contraseña nueva.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {successMessage && (
            <p className={styles.successBanner} role="status">
              {successMessage}
            </p>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>

        <p className={styles.switchText}>
          ¿La recuerdas?{' '}
          <Link to="/cuenta/entrar" className={styles.switchLink}>
            Inicia sesión
          </Link>
        </p>

        <div className={styles.legalRow}>
          <LegalLinks from="/cuenta/olvide-contrasena" />
        </div>
      </main>
    </CustomerAuthShell>
  )
}

export default UserForgotPasswordPage
