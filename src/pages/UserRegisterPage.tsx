import { useMemo, useState, useEffect, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auth } from '../config/firebase'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { registerCustomerAndSignOut, signInCustomerWithGoogle, updateCustomerPhone } from '../services/customerAuth'
import { getUserProfile } from '../services/firestore'
import { getAuthErrorMessage } from '../services/auth'
import { getPostLoginPath, resolveSafeRedirect } from '../utils/authProfile'
import { isValidSpanishPhone } from '../utils/helpers'
import {
  getPasswordChecks,
  isPasswordValid,
  PASSWORD_REQUIREMENTS,
} from '../utils/passwordValidation'
import { loadRecaptchaScript, executeRecaptcha } from '../services/recaptcha'
import GoogleSignInButton from '../components/GoogleSignInButton'
import CustomerAuthShell from '../components/CustomerAuthShell'
import LegalLinks from '../components/LegalLinks'
import styles from './UserCustomerAuth.module.css'

function UserRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = resolveSafeRedirect(searchParams.get('redirect'))
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [recaptchaReady, setRecaptchaReady] = useState(false)

  useEffect(() => {
    loadRecaptchaScript()
      .then(() => setRecaptchaReady(true))
      .catch(() => {
        setRecaptchaReady(true)
      })
  }, [])

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

    if (!isValidSpanishPhone(phone)) {
      setError('Indica un teléfono válido de España (9 dígitos, p. ej. 612 345 678) antes de continuar.')
      return
    }

    if (!acceptedLegal) {
      setError('Debes aceptar el aviso legal, la privacidad y los términos para continuar.')
      return
    }

    setIsLoading(true)

    try {
      let recaptchaToken = ''
      if (recaptchaReady) {
        recaptchaToken = await executeRecaptcha('register_google')
      }

      const googleResult = await signInCustomerWithGoogle(recaptchaToken || undefined)
      const currentUser = auth.currentUser
      if (currentUser && (googleResult === 'created' || googleResult === 'existing')) {
        const nextProfile = await getUserProfile(currentUser.uid)
        if (googleResult === 'created' || !nextProfile?.phone) {
          await updateCustomerPhone(currentUser.uid, phone)
        }
      }
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

    if (!isValidSpanishPhone(phone)) {
      setError('Indica un teléfono válido de España (9 dígitos, p. ej. 612 345 678).')
      return
    }

    if (!passwordReady) {
      setError('Revisa los requisitos de contraseña antes de continuar.')
      return
    }

    if (!acceptedLegal) {
      setError('Debes aceptar el aviso legal, la privacidad y los términos para continuar.')
      return
    }

    setIsLoading(true)

    try {
      let recaptchaToken = ''
      if (recaptchaReady) {
        try {
          recaptchaToken = await executeRecaptcha('register')
        } catch {
          recaptchaToken = ''
        }
      }

      await registerCustomerAndSignOut({ email, password, displayName, phone, recaptchaToken })
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
            Teléfono
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="612 345 678"
              required
            />
            <span className={styles.fieldHint}>Obligatorio. 9 dígitos de España, por si el restaurante necesita llamarte.</span>
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
            {passwordChecks.slice(0, 4).map((check, index) => {
              const requirement = PASSWORD_REQUIREMENTS[index]
              
              return (
                <li
                  key={requirement.key}
                  className={check.met ? styles.requirementMet : styles.requirementPending}
                >
                  <span className={styles.requirementIcon} aria-hidden="true">
                    {check.met ? '✓' : '○'}
                  </span>
                  {check.label}
                </li>
              )
            })}
          </ul>

          <label className={styles.legalCheck}>
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(event) => setAcceptedLegal(event.target.checked)}
            />
            <span>
              He leído y acepto el{' '}
              <Link to="/legal/aviso-legal?from=/cuenta/registro">aviso legal</Link>, la{' '}
              <Link to="/legal/privacidad?from=/cuenta/registro">política de privacidad</Link>
              {' '}y los{' '}
              <Link to="/legal/terminos?from=/cuenta/registro">términos de uso</Link>.
            </span>
          </label>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading || !passwordReady || !isValidSpanishPhone(phone) || !acceptedLegal}
          >
            {isLoading ? 'Creando cuenta…' : 'Registrarme'}
          </button>
        </form>

        <div className={styles.divider}>o</div>

        <GoogleSignInButton
          label="Registrarse con Google"
          disabled={isLoading || !acceptedLegal}
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
        <div className={styles.legalRow}>
          <LegalLinks from="/cuenta/registro" />
        </div>
      </main>
    </CustomerAuthShell>
  )
}

export default UserRegisterPage
