import { Link } from 'react-router-dom'
import styles from './GuestSignupCard.module.css'

/** Datos de la reserva sin cuenta que el registro rellena solo (van por sessionStorage, nunca en la URL). */
export const GUEST_SIGNUP_STORAGE_KEY = 'adelia:guest-signup'

export interface GuestSignupPrefill {
  name: string
  email: string
  phone: string
}

export function saveGuestSignupPrefill(prefill: GuestSignupPrefill): void {
  try {
    sessionStorage.setItem(GUEST_SIGNUP_STORAGE_KEY, JSON.stringify(prefill))
  } catch {
    // Sin almacenamiento: el registro sale vacío, sin más.
  }
}

export function readGuestSignupPrefill(): GuestSignupPrefill | null {
  try {
    const raw = sessionStorage.getItem(GUEST_SIGNUP_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<GuestSignupPrefill>
    return {
      name: typeof data.name === 'string' ? data.name : '',
      email: typeof data.email === 'string' ? data.email : '',
      phone: typeof data.phone === 'string' ? data.phone : '',
    }
  } catch {
    return null
  }
}

const PERKS = [
  { icon: '🎁', text: 'Reclama premios y promociones de este y otros locales' },
  { icon: '🗺️', text: 'Descubre restaurantes y bares cerca de ti' },
  { icon: '⚔️', text: 'Sube de nivel, consigue cartas y reta a tus amigos' },
]

/** Tras reservar sin cuenta: invita a registrarse con el mismo correo (la reserva pasa a la cuenta). */
function GuestSignupCard({ email }: { email: string }) {
  return (
    <section className={styles.card} aria-labelledby="guest-signup-title">
      <p className={styles.kicker}>Esta reserva puede darte premios</p>
      <h4 id="guest-signup-title" className={styles.title}>Crea tu cuenta gratis</h4>
      <ul className={styles.perks}>
        {PERKS.map((perk) => (
          <li key={perk.text}>
            <span className={styles.perkIcon} aria-hidden="true">{perk.icon}</span>
            {perk.text}
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Regístrate con {email ? <strong>{email}</strong> : 'el mismo correo'} y esta reserva aparecerá en tu cuenta.
      </p>
      <Link to="/cuenta/registro" className={styles.cta}>
        Crear cuenta y ver mis premios
      </Link>
    </section>
  )
}

export default GuestSignupCard
