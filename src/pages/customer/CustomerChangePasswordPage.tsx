import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { changePasswordWithReauth } from '../../services/auth'
import { validatePasswordStrength, getPasswordStrengthLabel, getPasswordStrengthColor } from '../../utils/passwordValidation'
import { ADELIA_LOGO_URL } from '../../constants/brand'
import styles from './CustomerChangePasswordPage.module.css'

function CustomerChangePasswordPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const validation = validatePasswordStrength(newPassword)
  const passwordsMatch = newPassword === confirmPassword

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (!validation.isValid) {
      setError('La nueva contraseña no cumple los requisitos de seguridad.')
      return
    }

    if (!passwordsMatch) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    if (currentPassword === newPassword) {
      setError('La nueva contraseña debe ser diferente a la actual.')
      return
    }

    setIsLoading(true)

    try {
      await changePasswordWithReauth(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      setTimeout(() => {
        navigate('/cuenta/perfil')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p>Debes iniciar sesión para cambiar tu contraseña.</p>
          <Link to="/cuenta/entrar" className={styles.button}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/cuenta/perfil" className={styles.backLink}>
          ← Volver al perfil
        </Link>

        <div className={styles.header}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
          <h1>Cambiar contraseña</h1>
          <p className={styles.subtitle}>
            Asegura tu cuenta con una contraseña fuerte
          </p>
        </div>

        {success && (
          <div className={styles.success} role="status">
            ✓ Contraseña cambiada correctamente. Redirigiendo...
          </div>
        )}

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Contraseña actual
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={isLoading || success}
            />
          </label>

          <label>
            Nueva contraseña
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={isLoading || success}
            />
            {newPassword && (
              <div className={styles.strengthIndicator}>
                <div
                  className={styles.strengthBar}
                  style={{
                    width: validation.strength === 'weak' ? '33%' : validation.strength === 'medium' ? '66%' : '100%',
                    backgroundColor: getPasswordStrengthColor(validation.strength),
                  }}
                />
                <span className={styles.strengthLabel} style={{ color: getPasswordStrengthColor(validation.strength) }}>
                  {getPasswordStrengthLabel(validation.strength)}
                </span>
              </div>
            )}
          </label>

          <label>
            Confirmar nueva contraseña
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={isLoading || success}
            />
            {confirmPassword && !passwordsMatch && (
              <span className={styles.mismatchWarning}>Las contraseñas no coinciden</span>
            )}
          </label>

          <div className={styles.requirements}>
            <p className={styles.requirementsTitle}>Requisitos de seguridad:</p>
            <ul className={styles.requirementsList}>
              <li className={newPassword.length >= 8 ? styles.met : ''}>
                Mínimo 8 caracteres
              </li>
              <li className={/[a-z]/.test(newPassword) ? styles.met : ''}>
                Una letra minúscula
              </li>
              <li className={/[A-Z]/.test(newPassword) ? styles.met : ''}>
                Una letra mayúscula
              </li>
              <li className={/[0-9]/.test(newPassword) ? styles.met : ''}>
                Un número
              </li>
            </ul>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading || !validation.isValid || !passwordsMatch || success}
          >
            {isLoading ? 'Cambiando contraseña...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CustomerChangePasswordPage
