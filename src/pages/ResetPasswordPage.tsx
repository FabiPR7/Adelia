import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPasswordWithToken, validatePasswordResetToken } from '../services/authApi'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { validatePasswordStrength } from '../utils/passwordValidation'
import CustomerAuthShell from '../components/CustomerAuthShell'
import styles from './LoginPage.module.css'
import customerStyles from './UserCustomerAuth.module.css'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const startsAsCustomer = location.pathname.startsWith('/cuenta/')

  const [audience, setAudience] = useState<'company' | 'customer'>(startsAsCustomer ? 'customer' : 'company')
  const [accountName, setAccountName] = useState('')
  const [isValidating, setIsValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loginHref = audience === 'customer' ? '/cuenta/entrar' : '/login'
  const forgotHref = audience === 'customer' ? '/cuenta/olvide-contrasena' : '/olvide-contrasena'

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
      if (result.audience === 'customer' || result.audience === 'company') {
        setAudience(result.audience)
      }
      setAccountName(result.accountName || result.companyName || '')
      setIsValidating(false)
    })

    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const strength = validatePasswordStrength(newPassword)
    if (!strength.isValid) {
      setError(strength.errors[0] ?? 'La contraseña no cumple los requisitos.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setIsLoading(true)

    try {
      await resetPasswordWithToken(token, newPassword)
      navigate(loginHref, {
        replace: true,
        state: { passwordReset: true },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.')
    } finally {
      setIsLoading(false)
    }
  }

  const title = 'Nueva contraseña'
  const subtitle = accountName
    ? `Elige una contraseña nueva para ${accountName}.`
    : 'Elige una contraseña nueva para tu cuenta.'

  const formBody = isValidating ? (
    <p className={audience === 'customer' ? customerStyles.lead : styles.helperText}>Comprobando enlace…</p>
  ) : !tokenValid ? (
    <>
      <div className={audience === 'customer' ? customerStyles.error : styles.error} role="alert">
        El enlace no es válido o ha caducado. Solicita uno nuevo.
      </div>
      <button
        type="button"
        className={audience === 'customer' ? customerStyles.submitButton : styles.submitButton}
        onClick={() => navigate(forgotHref)}
      >
        Solicitar nuevo enlace
      </button>
    </>
  ) : (
    <form className={audience === 'customer' ? customerStyles.form : styles.form} onSubmit={handleSubmit}>
      {error && (
        <div className={audience === 'customer' ? customerStyles.error : styles.error} role="alert">
          {error}
        </div>
      )}

      <label className={audience === 'company' ? styles.field : undefined}>
        {audience === 'company' ? <span className={styles.label}>Nueva contraseña</span> : 'Nueva contraseña'}
        <input
          id="newPassword"
          type="password"
          className={audience === 'company' ? styles.input : undefined}
          placeholder="Mínimo 8 caracteres, mayúscula, minúscula y número"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>

      <label className={audience === 'company' ? styles.field : undefined}>
        {audience === 'company' ? <span className={styles.label}>Confirmar contraseña</span> : 'Confirmar contraseña'}
        <input
          id="confirmPassword"
          type="password"
          className={audience === 'company' ? styles.input : undefined}
          placeholder="Repite la contraseña"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>

      <button
        type="submit"
        className={audience === 'customer' ? customerStyles.submitButton : styles.submitButton}
        disabled={isLoading}
      >
        {isLoading ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  )

  if (audience === 'customer') {
    return (
      <CustomerAuthShell variant="login">
        <main className={customerStyles.card}>
          <div className={customerStyles.brandRow}>
            <img src={ADELIA_LOGO_URL} alt="" className={customerStyles.logo} />
            <div>
              <p className={customerStyles.eyebrow}>Tu cuenta Adelia</p>
              <h1>{title}</h1>
            </div>
          </div>
          <p className={customerStyles.lead}>{subtitle}</p>
          {formBody}
          <p className={customerStyles.switchText}>
            <Link to={loginHref} className={customerStyles.switchLink}>
              Volver al inicio de sesión
            </Link>
          </p>
        </main>
      </CustomerAuthShell>
    )
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
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </header>

          {isValidating || !tokenValid ? <div className={styles.form}>{formBody}</div> : formBody}

          <footer className={styles.footer}>
            <p>
              <Link to={loginHref} className={styles.forgotLink}>
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
