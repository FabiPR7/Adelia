import { useEffect, useId, useRef, useState } from 'react'
import { checkUsernameAvailable, localUsernameError } from '../services/customerIdentityApi'
import styles from './UsernameField.module.css'

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'

interface UsernameFieldProps {
  value: string
  onChange: (value: string) => void
  /** El @usuario que ya tiene guardado (cuenta como libre). */
  currentUsername?: string
  onStatusChange?: (status: UsernameStatus) => void
}

/** Campo «@usuario» que comprueba mientras escribes si está libre. */
function UsernameField({ value, onChange, currentUsername = '', onStatusChange }: UsernameFieldProps) {
  const inputId = useId()
  const [status, setStatus] = useState<UsernameStatus>('idle')
  const [message, setMessage] = useState('')
  const requestId = useRef(0)

  useEffect(() => {
    onStatusChange?.(status)
  }, [status, onStatusChange])

  useEffect(() => {
    const clean = value.trim().toLowerCase()
    if (!clean) {
      setStatus('invalid')
      setMessage('Elige un @usuario para que tus amigos te encuentren.')
      return
    }
    const localError = localUsernameError(clean)
    if (localError) {
      setStatus('invalid')
      setMessage(localError)
      return
    }
    if (clean === currentUsername) {
      setStatus('available')
      setMessage('Es tu @usuario actual.')
      return
    }

    setStatus('checking')
    setMessage('Comprobando…')
    const id = ++requestId.current
    const timer = window.setTimeout(() => {
      checkUsernameAvailable(clean)
        .then((result) => {
          if (id !== requestId.current) return
          setStatus(result.available ? 'available' : result.error?.includes('cogido') ? 'taken' : 'invalid')
          setMessage(result.available ? `@${clean} está libre.` : result.error ?? 'No está disponible.')
        })
        .catch(() => {
          if (id !== requestId.current) return
          setStatus('error')
          setMessage('No se pudo comprobar ahora. Lo revisamos al guardar.')
        })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [value, currentUsername])

  const tone = status === 'available' ? styles.ok : status === 'taken' || status === 'invalid' ? styles.bad : styles.muted

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>Tu @usuario</label>
      <div className={`${styles.inputWrap} ${status === 'taken' || status === 'invalid' ? styles.inputBad : ''}`}>
        <span className={styles.at} aria-hidden="true">@</span>
        <input
          id={inputId}
          className={styles.input}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/^@+/, '').replace(/\s+/g, '').toLowerCase().slice(0, 20))}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          placeholder="tunombre"
          aria-describedby={`${inputId}-msg`}
        />
      </div>
      <p id={`${inputId}-msg`} className={`${styles.message} ${tone}`} aria-live="polite">
        {message || 'Así te encuentran tus amigos. Puedes cambiarlo cuando quieras.'}
      </p>
    </div>
  )
}

export default UsernameField
