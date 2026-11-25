import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import ConfirmDialog from '../../components/ConfirmDialog'
import LegalLinks from '../../components/LegalLinks'
import { changePasswordWithReauth, logout } from '../../services/auth'
import { callCompanyApi } from '../../services/companyApi'
import { friendlyErrorMessage } from '../../utils/friendlyError'
import { LEGAL_CONTACT_EMAIL } from '../../content/publicLegal'
import type { CompanyTab } from '../../types'
import styles from './CompanyAccountSettings.module.css'

interface CompanyAccountSettingsProps {
  onOpenTab: (tab: CompanyTab) => void
}

/** Ajustes → Cuenta: acceso, contraseña, sesiones, datos del local y ayuda. */
function CompanyAccountSettings({ onOpenTab }: CompanyAccountSettingsProps) {
  const { user, company } = useAuth()
  const demo = useCompanyDemo()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirm, setConfirm] = useState<'here' | 'everywhere' | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordMessage(null)
    if (!currentPassword || !newPassword) {
      setPasswordMessage({ ok: false, text: 'Escribe tu contraseña actual y la nueva.' })
      return
    }
    if (newPassword !== repeatPassword) {
      setPasswordMessage({ ok: false, text: 'Las dos contraseñas nuevas no coinciden.' })
      return
    }
    setSavingPassword(true)
    try {
      await changePasswordWithReauth(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setRepeatPassword('')
      setPasswordMessage({ ok: true, text: 'Contraseña cambiada. La próxima vez entra con la nueva.' })
    } catch (error) {
      setPasswordMessage({ ok: false, text: friendlyErrorMessage(error, 'No se pudo cambiar la contraseña.') })
    } finally {
      setSavingPassword(false)
    }
  }

  const signOut = async (everywhere: boolean) => {
    setSigningOut(true)
    setSessionError(null)
    try {
      if (everywhere && company?.id) {
        await callCompanyApi(`/${encodeURIComponent(company.id)}/account/sign-out-everywhere`, 'POST', {}, 'No se pudieron cerrar las sesiones.')
      }
      await logout()
    } catch (error) {
      setSessionError(friendlyErrorMessage(error, 'No se pudieron cerrar las sesiones.'))
      setSigningOut(false)
      setConfirm(null)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2>Cuenta</h2>
        <p>Tu acceso al panel, la contraseña y las sesiones abiertas.</p>
      </header>

      <section className={styles.card} aria-labelledby="account-access">
        <h3 id="account-access">Acceso al panel</h3>
        <dl className={styles.facts}>
          <div>
            <dt>Restaurante</dt>
            <dd>{company?.name || '—'}</dd>
          </div>
          <div>
            <dt>Correo para entrar</dt>
            <dd>{user?.email || '—'}</dd>
          </div>
        </dl>
        <p className={styles.hint}>
          Para cambiar el correo de acceso escríbenos a <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>:
          lo hacemos nosotros para que nadie pueda quedarse con tu local.
        </p>
      </section>

      {demo ? (
        /* En la vista de ejemplo no hay sesión: ni contraseña que cambiar ni sesión que cerrar. */
        <section className={styles.card} aria-labelledby="account-demo">
          <h3 id="account-demo">Contraseña y sesiones</h3>
          <p className={styles.hint}>
            En tu panel, aquí cambias la contraseña y cierras la sesión (también en todos tus dispositivos).
            En esta vista de ejemplo no hay ninguna sesión abierta.
          </p>
        </section>
      ) : (
        <>
        <section className={styles.card} aria-labelledby="account-password">
          <h3 id="account-password">Cambiar contraseña</h3>
          <form className={styles.form} onSubmit={(event) => void submitPassword(event)} noValidate>
            <label>
              <span>Contraseña actual</span>
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label>
              <span>Nueva contraseña</span>
              <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <label>
              <span>Repite la nueva</span>
              <input type="password" autoComplete="new-password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} />
            </label>
            <p className={styles.hint}>Al menos 8 caracteres, con mayúscula, minúscula y un número.</p>
            {passwordMessage ? (
              <p className={passwordMessage.ok ? styles.ok : styles.error} role="status">{passwordMessage.text}</p>
            ) : null}
            <button type="submit" className={styles.primary} disabled={savingPassword}>
              {savingPassword ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
  
        <section className={styles.card} aria-labelledby="account-sessions">
          <h3 id="account-sessions">Sesiones</h3>
          <p className={styles.hint}>
            Si has entrado en un ordenador o móvil que no es tuyo, o crees que alguien conoce tu contraseña,
            cierra la sesión en todos los dispositivos y cambia la contraseña.
          </p>
          {sessionError ? <p className={styles.error} role="alert">{sessionError}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setConfirm('here')}>
              Cerrar sesión aquí
            </button>
            <button type="button" className={styles.danger} onClick={() => setConfirm('everywhere')}>
              Cerrar sesión en todos los dispositivos
            </button>
          </div>
        </section>
  
        </>
      )}

      <section className={styles.card} aria-labelledby="account-more">
        <h3 id="account-more">Más ajustes</h3>
        <div className={styles.links}>
          <button type="button" onClick={() => onOpenTab('contact')}>
            <strong>Datos del local</strong>
            <span>Teléfono, correo de contacto y logo</span>
          </button>
          <button type="button" onClick={() => onOpenTab('plan')}>
            <strong>Plan y pagos</strong>
            <span>Cambiar de plan, método de pago, facturas y baja</span>
          </button>
          <button type="button" onClick={() => onOpenTab('appearance')}>
            <strong>Apariencia</strong>
            <span>Modo claro, oscuro o automático</span>
          </button>
          <button type="button" onClick={() => onOpenTab('help')}>
            <strong>Ayuda</strong>
            <span>Tutoriales y preguntas frecuentes</span>
          </button>
        </div>
        <p className={styles.hint}>
          ¿Algo no va bien? Escríbenos a <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
        <LegalLinks variant="sidebar" from="/panel" />
      </section>

      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm === 'everywhere' ? '¿Cerrar sesión en todos los dispositivos?' : '¿Cerrar sesión?'}
        message={confirm === 'everywhere'
          ? 'Se cerrará el panel en este y en cualquier otro ordenador o móvil (en los demás, como mucho en una hora). Tendrás que volver a entrar con tu contraseña.'
          : 'Tendrás que volver a entrar con tu correo y contraseña.'}
        confirmLabel={confirm === 'everywhere' ? 'Cerrar en todos' : 'Cerrar sesión'}
        variant={confirm === 'everywhere' ? 'danger' : 'default'}
        isLoading={signingOut}
        onConfirm={() => void signOut(confirm === 'everywhere')}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

export default CompanyAccountSettings
