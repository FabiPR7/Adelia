import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import promoHeroDining from '../assets/promo-hero-dining.webp'
import gamificationHero from '../assets/gamification-ranking-hero.webp'
import styles from './CustomerAuthShell.module.css'

type AuthVariant = 'login' | 'register' | 'verify'

interface CustomerAuthShellProps {
  variant: AuthVariant
  children: ReactNode
}

const HERO_COPY: Record<
  AuthVariant,
  {
    title: string
    lead: string
    perks: Array<{ icon: string; text: string }>
    image: string
  }
> = {
  login: {
    title: 'Vuelve a lo bueno',
    lead: 'Tus reservas, promos y misiones te esperan. Entra y sigue descubriendo restaurantes.',
    perks: [
      { icon: '📱', text: 'Reserva en segundos desde el móvil' },
      { icon: '🎁', text: 'Promociones exclusivas para miembros' },
      { icon: '✨', text: 'Gana XP completando misiones' },
    ],
    image: promoHeroDining,
  },
  register: {
    title: 'Únete a Adelia',
    lead: 'Crea tu cuenta gratis y desbloquea reservas, favoritos, promos y recompensas.',
    perks: [
      { icon: '🆓', text: '100% gratis para comensales' },
      { icon: '❤️', text: 'Guarda tus restaurantes favoritos' },
      { icon: '🚀', text: 'Sube de nivel y desbloquea ventajas' },
    ],
    image: gamificationHero,
  },
  verify: {
    title: 'Ya casi estás dentro',
    lead: 'Confirma tu correo y empieza a reservar, explorar y ganar recompensas.',
    perks: [
      { icon: '✉️', text: 'Un solo clic en el botón del correo' },
      { icon: '⚡', text: 'Tu cuenta queda activa al instante' },
      { icon: '👤', text: 'Después, completa tu perfil en 1 minuto' },
    ],
    image: promoHeroDining,
  },
}

function CustomerAuthShell({ variant, children }: CustomerAuthShellProps) {
  const hero = HERO_COPY[variant]

  return (
    <div className={styles.page}>
      <div className={styles.glowOne} aria-hidden="true" />
      <div className={styles.glowTwo} aria-hidden="true" />

      <aside className={styles.heroPanel}>
        <img src={hero.image} alt="" className={styles.heroImage} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroOrbOne} aria-hidden="true" />
        <div className={styles.heroOrbTwo} aria-hidden="true" />

        <div className={styles.heroContent}>
          <div className={styles.heroCenter}>
            <Link to="/" className={styles.heroLogoLink}>
              <img src={ADELIA_LOGO_URL} alt="Adelia" className={styles.heroLogo} />
            </Link>

            <p className={styles.heroEyebrow}>App de comensales</p>

            <div className={styles.heroCopy}>
              <h2 className={styles.heroTitle}>{hero.title}</h2>
              <p className={styles.heroLead}>{hero.lead}</p>
            </div>

            <ul className={styles.heroPerks}>
              {hero.perks.map((perk) => (
                <li key={perk.text}>
                  <span className={styles.heroPerkIcon} aria-hidden="true">
                    {perk.icon}
                  </span>
                  <span className={styles.heroPerkText}>{perk.text}</span>
                </li>
              ))}
            </ul>

            <div className={styles.heroStats}>
              <div>
                <strong>+500</strong>
                <span>Restaurantes</span>
              </div>
              <div>
                <strong>4.8★</strong>
                <span>Valoración</span>
              </div>
              <div>
                <strong>Gratis</strong>
                <span>Para ti</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className={styles.formPanel}>{children}</div>
    </div>
  )
}

export default CustomerAuthShell
