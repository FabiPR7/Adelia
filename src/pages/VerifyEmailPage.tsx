import { Link, useSearchParams } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import CustomerAuthShell from '../components/CustomerAuthShell'
import styles from './UserCustomerAuth.module.css'

function VerifyEmailPage() {
  const [params] = useSearchParams()
  const email = params.get('email')

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

        <p className={styles.lead}>
          Te hemos enviado un correo de bienvenida
          {email ? ` a ${email}` : ''}. Pulsa el botón <strong>Confirmar correo</strong> para
          activar tu cuenta. Sin confirmar no podrás iniciar sesión.
        </p>

        <ul className={styles.hintList}>
          <li>Revisa también la carpeta de spam o promociones.</li>
          <li>El enlace caduca en unas horas; si expira, intenta entrar y te reenviamos otro.</li>
        </ul>

        <Link to="/cuenta/entrar" className={styles.submitButton}>
          Ya confirmé · Iniciar sesión
        </Link>
      </main>
    </CustomerAuthShell>
  )
}

export default VerifyEmailPage
