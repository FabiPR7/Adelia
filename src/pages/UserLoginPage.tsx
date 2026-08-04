import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { auth } from '../config/firebase'
import { loginCustomer } from '../services/customerAuth'
import { getUserProfile } from '../services/firestore'
import { getAuthErrorMessage } from '../services/auth'
import { getPostLoginPath } from '../utils/authProfile'
import styles from './UserCustomerAuth.module.css'

function UserLoginPage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
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
    setIsLoading(true)

    try {
      await loginCustomer(email, password)
      await refreshProfile()
      const nextProfile = auth.currentUser
        ? await getUserProfile(auth.currentUser.uid)
        : null

      if (nextProfile?.role !== 'customer') {
        setError('Esta cuenta no es de cliente. Usa el acceso de empresas.')
        return
      }

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
            <p className={styles.eyebrow}>Tu cuenta Adelia</p>
            <h1>Inicia sesión</h1>
          </div>
        </div>

        <p className={styles.lead}>
          Accede a tus reservas, favoritos y promociones exclusivas.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className={styles.switchText}>
          ¿No tienes cuenta?{' '}
          <Link to="/cuenta/registro" className={styles.switchLink}>
            Regístrate gratis
          </Link>
        </p>

        <Link to="/empresa" className={styles.businessLink}>
          ¿Eres restaurante? Acceso empresas
        </Link>
      </main>
    </div>
  )
}

export default UserLoginPage
