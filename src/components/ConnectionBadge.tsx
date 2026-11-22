import { useEffect, useState } from 'react'
import styles from './ConnectionBadge.module.css'

// Sin internet: wifi tachado en rojo junto a la campana (igual que la app).
// Cuando vuelve la conexión se pone en verde un momento y desaparece.
// Lo dice el propio navegador (eventos online/offline): no gasta peticiones.

type Status = 'online' | 'offline' | 'back'

const BACK_VISIBLE_MS = 2500

export default function ConnectionBadge() {
  const [status, setStatus] = useState<Status>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online',
  )

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const goOffline = () => {
      if (timer) clearTimeout(timer)
      setStatus('offline')
    }
    const goOnline = () => {
      setStatus((current) => (current === 'offline' ? 'back' : current))
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setStatus('online'), BACK_VISIBLE_MS)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (status === 'online') return null
  const back = status === 'back'
  return (
    <span
      className={`${styles.badge} ${back ? styles.back : styles.offline}`}
      role="status"
      aria-live="polite"
      aria-label={back ? 'Conexión recuperada' : 'Sin conexión a internet'}
      title={back ? 'Conexión recuperada' : 'Sin conexión a internet'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 8.8a15 15 0 0 1 20 0" />
        <path d="M5.5 12.4a10 10 0 0 1 13 0" />
        <path d="M9 16a5 5 0 0 1 6 0" />
        <path d="M12 19.5h.01" className={styles.dot} />
        {back ? null : <path d="M3 3l18 18" />}
      </svg>
    </span>
  )
}
