import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { registerCustomer } from '../services/customerAuth'
import { getAuthErrorMessage } from '../services/auth'
import { getPostLoginPath } from '../utils/authProfile'
import styles from './UserCustomerAuth.module.css'

function UserRegisterPage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user && profile) {
    return <Navigate to={getPostLoginPath(profile)} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setIsLoading(true)

    try {
      await registerCustomer(email, password, displayName)
      await refreshProfile()
      navigate('/cuenta', { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.glowOne} aria-hidden="true" />
      <div className={styles.glowTwo} aria-hidden="true" />

      <main className={styles.card}>
        <Link to="/" className={styles.backLink}>
          ← Volver
        </Link>

        <div className={styles.brandRow}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
          <div>
            <p className={styles.eyebrow}>Empieza hoy</p>
            <h1>Crea tu cuenta</h1>
          </div>
        </div>

        <p className={styles.lead}>
          Regístrate para guardar favoritos, ver tus reservas y desbloquear promociones.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Nombre
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              required
              maxLength={80}
            />
          </label>

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

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? 'Creando cuenta…' : 'Registrarme'}
          </button>
        </form>

        <p className={styles.switchText}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/cuenta/entrar" className={styles.switchLink}>
            Inicia sesión
          </Link>
        </p>
      </main>
    </div>
  )
}

export default UserRegisterPage
