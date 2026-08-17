import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAuthErrorMessage, loginWithUsername } from '../services/auth'
import { getFirestoreErrorMessage, getCompanyCredentialsMustChange, getUserProfile } from '../services/firestore'
import { getPostLoginPath, resolveMustChangePassword } from '../utils/authProfile'
import { ADELIA_LOGO_URL } from '../constants/brand'
import LegalLinks from '../components/LegalLinks'
import styles from './LoginPage.module.css'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const passwordResetSuccess = (location.state as { passwordReset?: boolean } | null)?.passwordReset === true
  const { refreshProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const user = await loginWithUsername(username.trim(), password)

      let profile

      try {
        profile = await getUserProfile(user.uid)
      } catch (firestoreError) {
        setError(getFirestoreErrorMessage(firestoreError))
        return
      }

      if (!profile) {
        setError(
          'No se pudo leer tu perfil. Despliega las reglas con npm run deploy:rules y vuelve a entrar.',
        )
        return
      }

      const credentialsMustChange = profile.companyId
        ? await getCompanyCredentialsMustChange(profile.companyId).catch(() => null)
        : null

      const resolvedProfile = await resolveMustChangePassword(
        user,
        profile,
        credentialsMustChange,
      )

      await refreshProfile()

      navigate(getPostLoginPath(resolvedProfile), { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.backgroundPattern} aria-hidden="true" />

      <main className={styles.container}>
        <section className={styles.card}>
          <header className={styles.header}>
            <div className={styles.logoWrapper}>
              <img
                src={ADELIA_LOGO_URL}
                alt="Adelia — Akita Inu"
                className={styles.logo}
              />
            </div>
            <h1 className={styles.title}>Adelia</h1>
            <p className={styles.subtitle}>
              Gestión de reservas para tu restaurante
            </p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            {passwordResetSuccess && (
              <div className={styles.success} role="status">
                Contraseña actualizada. Ya puedes iniciar sesión.
              </div>
            )}

            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="username" className={styles.label}>
                Nombre
              </label>
              <input
                id="username"
                type="text"
                className={styles.input}
                placeholder="Nombre"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className={styles.options}>
              <label className={styles.checkbox}>
                <input type="checkbox" />
                <span>Recordarme</span>
              </label>
              <Link to="/olvide-contrasena" className={styles.forgotLink}>
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>

          <footer className={styles.footer}>
            <p>Acceso exclusivo para cuentas registradas.</p>
            <LegalLinks from="/login" />
          </footer>
        </section>

        <aside className={styles.sidePanel}>
          <div className={styles.sideContent}>
            <span className={styles.badge}>Para empresas</span>
            <h2 className={styles.sideTitle}>
              Reservas organizadas, clientes satisfechos
            </h2>
            <p className={styles.sideText}>
              Centraliza las reservas de tu restaurante en una plataforma
              elegante y fácil de usar. Diseñada para equipos que valoran la
              excelencia.
            </p>
            <ul className={styles.features}>
              <li>Gestión de mesas en tiempo real</li>
              <li>Panel de reservas del día</li>
              <li>Historial y preferencias de clientes</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default LoginPage
