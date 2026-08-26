import { useState, type FormEvent, useEffect } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auth } from '../config/firebase'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { loginCustomer, signInCustomerWithGoogle } from '../services/customerAuth'
import { getUserProfile } from '../services/firestore'
import { getAuthErrorMessage } from '../services/auth'
import { getPostLoginPath, resolveSafeRedirect } from '../utils/authProfile'
import { executeRecaptcha, loadRecaptchaScript } from '../services/recaptcha'
import GoogleSignInButton from '../components/GoogleSignInButton'
import CustomerAuthShell from '../components/CustomerAuthShell'
import LegalLinks from '../components/LegalLinks'
import styles from './UserCustomerAuth.module.css'

function UserLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const emailVerified = searchParams.get('verified') === '1'
  const passwordResetSuccess = (location.state as { passwordReset?: boolean } | null)?.passwordReset === true
  const redirectTo = resolveSafeRedirect(searchParams.get('redirect'))
  const { user, profile, refreshProfile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRecaptchaScript().catch(() => undefined)
  }, [])

  if (user && profile) {
    return <Navigate to={redirectTo ?? getPostLoginPath(profile, user)} replace />
  }

  const finishLogin = async () => {
    await refreshProfile()
    const currentUser = auth.currentUser
    const nextProfile = currentUser ? await getUserProfile(currentUser.uid) : null

    if (!nextProfile || nextProfile.role !== 'customer') {
      setError('Esta cuenta no es de cliente. Usa el acceso de empresas.')
      return
    }

    navigate(redirectTo ?? getPostLoginPath(nextProfile, currentUser), { replace: true })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await loginCustomer(email, password)
      await finishLogin()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setIsLoading(true)

    try {
      let recaptchaToken = ''
      try {
        recaptchaToken = await executeRecaptcha('register_google')
      } catch {
        recaptchaToken = ''
      }
      await signInCustomerWithGoogle(recaptchaToken || undefined)
      await finishLogin()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const redirectQuery = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''

  return (
    <CustomerAuthShell variant="login">
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
          Accede a tus reservas, favoritos, promociones y misiones.
        </p>

        {passwordResetSuccess && (
          <p className={styles.successBanner} role="status">
            Contraseña actualizada. Ya puedes iniciar sesión.
          </p>
        )}

        {emailVerified && (
          <p className={styles.successBanner} role="status">
            Correo confirmado. Ya puedes iniciar sesión.
          </p>
        )}

        <GoogleSignInButton
          disabled={isLoading}
          onClick={() => void handleGoogle()}
        />

        <div className={styles.divider}>o con email</div>

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

        <p className={styles.forgotRow}>
          <Link to="/cuenta/olvide-contrasena" className={styles.forgotLink}>
            ¿Olvidaste tu contraseña?
          </Link>
        </p>

        <p className={styles.switchText}>
          ¿No tienes cuenta?{' '}
          <Link to={`/cuenta/registro${redirectQuery}`} className={styles.switchLink}>
            Regístrate gratis
          </Link>
        </p>

        <Link to="/empresa" className={styles.businessLink}>
          ¿Eres restaurante? Acceso empresas
        </Link>
        <div className={styles.legalRow}>
          <LegalLinks from="/cuenta/entrar" />
        </div>
      </main>
    </CustomerAuthShell>
  )
}

export default UserLoginPage
