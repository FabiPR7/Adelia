import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../services/authApi'
import { ADELIA_LOGO_URL } from '../constants/brand'
import styles from './LoginPage.module.css'

function ForgotPasswordPage() {
  const [loginName, setLoginName] = useState('')
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
      const message = await requestPasswordReset(loginName.trim(), email.trim())
      setSuccessMessage(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
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
            <h1 className={styles.title}>Recuperar contraseña</h1>
            <p className={styles.subtitle}>
              Indica el nombre de tu empresa y el correo registrado en Adelia. Si coinciden,
              te enviaremos un enlace para elegir una contraseña nueva.
            </p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            {successMessage && (
              <div className={styles.success} role="status">
                {successMessage}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="companyName" className={styles.label}>
                Nombre de empresa
              </label>
              <input
                id="companyName"
                type="text"
                className={styles.input}
                placeholder="Como aparece al iniciar sesión"
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                autoComplete="organization"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                Correo registrado
              </label>
              <input
                id="email"
                type="email"
                className={styles.input}
                placeholder="contacto@turestaurante.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>

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

export default ForgotPasswordPage
