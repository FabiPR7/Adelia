import { Link } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import styles from './UserAuthComingSoonPage.module.css'

interface UserAuthComingSoonPageProps {
  mode: 'login' | 'register'
}

function UserAuthComingSoonPage({ mode }: UserAuthComingSoonPageProps) {
  const isLogin = mode === 'login'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
        <h1>{isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p>
          {isLogin
            ? 'Muy pronto podrás entrar con tu cuenta de usuario, ver tus reservas y canjear promociones.'
            : 'Estamos preparando el registro de usuarios para guardar tus reservas y premios.'}
        </p>
        <Link to="/" className={styles.primaryButton}>
          Volver al inicio
        </Link>
        {!isLogin && (
          <Link to="/cuenta/entrar" className={styles.secondaryLink}>
            Ya tengo cuenta
          </Link>
        )}
      </div>
    </div>
  )
}

export default UserAuthComingSoonPage
