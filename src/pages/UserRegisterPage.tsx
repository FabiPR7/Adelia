import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auth } from '../config/firebase'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { registerCustomerAndSignOut, signInCustomerWithGoogle } from '../services/customerAuth'
import { getUserProfile } from '../services/firestore'
import { getAuthErrorMessage } from '../services/auth'
import { getPostLoginPath, resolveSafeRedirect } from '../utils/authProfile'
import {
  getPasswordChecks,
  isPasswordValid,
  PASSWORD_REQUIREMENTS,
} from '../utils/passwordValidation'
import GoogleSignInButton from '../components/GoogleSignInButton'
import CustomerAuthShell from '../components/CustomerAuthShell'
import styles from './UserCustomerAuth.module.css'

function UserRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = resolveSafeRedirect(searchParams.get('redirect'))
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordChecks = useMemo(
    () => getPasswordChecks(password, confirmPassword),
    [password, confirmPassword],
  )
  const passwordReady = isPasswordValid(passwordChecks)

  if (user && profile) {
    return <Navigate to={redirectTo ?? getPostLoginPath(profile, user)} replace />
  }

  const finishGoogleRegister = async () => {
    await refreshProfile()
    const currentUser = auth.currentUser
    const nextProfile = currentUser ? await getUserProfile(currentUser.uid) : null

    if (!nextProfile || nextProfile.role !== 'customer') {
      setError('Esta cuenta de Google no es de cliente.')
      return
    }

    navigate(redirectTo ?? getPostLoginPath(nextProfile, currentUser), { replace: true })
  }

  const handleGoogle = async () => {
    setError(null)
    setIsLoading(true)

    try {
      await signInCustomerWithGoogle()
      await finishGoogleRegister()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccountSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!passwordReady) {
      setError('Revisa los requisitos de contraseña antes de continuar.')
      return
    }

    setIsLoading(true)

    try {
      await registerCustomerAndSignOut({ email, password, displayName })
      navigate(`/cuenta/verificar-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
        replace: true,
      })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const redirectQuery = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''

  return (
    <CustomerAuthShell variant="register">
      <main className={`${styles.card} ${styles.cardCompact} ${styles.cardRegister}`}>
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

        <form
          className={`${styles.form} ${styles.formCompact} ${styles.formRegister}`}
          onSubmit={handleAccountSubmit}
        >
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
              minLength={8}
            />
          </label>

          <label>
            Confirmar contraseña
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>

          <ul className={styles.passwordRequirements} aria-live="polite">
            {PASSWORD_REQUIREMENTS.map((requirement) => {
              const met = passwordChecks[requirement.key]

              return (
                <li
                  key={requirement.key}
                  className={met ? styles.requirementMet : styles.requirementPending}
                >
                  <span className={styles.requirementIcon} aria-hidden="true">
                    {met ? '✓' : '○'}
                  </span>
                  {requirement.label}
                </li>
              )
            })}
          </ul>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading || !passwordReady}
          >
            {isLoading ? 'Creando cuenta…' : 'Registrarme'}
          </button>
        </form>

        <div className={styles.divider}>o</div>

        <GoogleSignInButton
          label="Registrarse con Google"
          disabled={isLoading}
          onClick={() => void handleGoogle()}
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <p className={styles.switchText}>
          ¿Ya tienes cuenta?{' '}
          <Link to={`/cuenta/entrar${redirectQuery}`} className={styles.switchLink}>
            Inicia sesión
          </Link>
        </p>
      </main>
    </CustomerAuthShell>
  )
}

export default UserRegisterPage
