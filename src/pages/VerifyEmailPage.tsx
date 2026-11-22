import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import CustomerAuthShell from '../components/CustomerAuthShell'
import { resendCustomerVerificationByEmail } from '../services/customerAuthApi'
import styles from './UserCustomerAuth.module.css'
import { friendlyErrorMessage } from '../utils/friendlyError'

const RESEND_WAIT_SECONDS = 60

function VerifyEmailPage() {
  const [params] = useSearchParams()
  const initialEmail = params.get('email')?.trim().toLowerCase() ?? ''
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(initialEmail ? RESEND_WAIT_SECONDS : 0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  const resend = async () => {
    const target = email.trim().toLowerCase()
    if (!target || !target.includes('@')) {
      setError('Escribe el correo con el que te registraste.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await resendCustomerVerificationByEmail(target)
      setSentTo(target)
      setWait(RESEND_WAIT_SECONDS)
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo reenviar el correo.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <CustomerAuthShell variant="verify">
      <main className={styles.card}>
        <Link to="/cuenta/entrar" className={styles.backLink}>
          ← Volver al login
        </Link>

        <div className={styles.brandRow}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
          <div>
            <p className={styles.eyebrow}>Casi listo</p>
            <h1>Confirma tu email</h1>
          </div>
        </div>

        {initialEmail ? (
          <>
            <p className={styles.lead}>Te hemos enviado un correo para activar tu cuenta a:</p>
            <p className={styles.sentEmail}>{initialEmail}</p>
            <p className={styles.lead}>
              Pulsa el botón <strong>Confirmar correo</strong> que trae. Sin confirmar no podrás iniciar sesión.
            </p>
          </>
        ) : (
          <>
            <p className={styles.lead}>
              Escribe el correo con el que te registraste y te mandamos el enlace para activar la cuenta.
            </p>
            <label className={styles.verifyEmailField}>
              Correo
              <input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
              />
            </label>
          </>
        )}

        <ul className={styles.hintList}>
          <li>Revisa también la carpeta de spam o promociones.</li>
          {initialEmail ? (
            <li>
              ¿El correo está mal escrito? <Link to="/cuenta/registro">Crea la cuenta con el correcto</Link>.
            </li>
          ) : null}
        </ul>

        {sentTo ? (
          <p className={styles.successBanner} role="status">
            Te lo hemos vuelto a enviar a {sentTo}.
          </p>
        ) : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <button
          type="button"
          className={styles.resendButton}
          onClick={() => void resend()}
          disabled={sending || wait > 0}
        >
          {sending
            ? 'Enviando…'
            : wait > 0
              ? `¿No te llega? Reenviar en ${wait} s`
              : 'Reenviar correo'}
        </button>

        <Link to="/cuenta/entrar" className={styles.submitButton}>
          Ya confirmé · Iniciar sesión
        </Link>
      </main>
    </CustomerAuthShell>
  )
}

export default VerifyEmailPage
