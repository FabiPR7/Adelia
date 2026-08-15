import { NavLink, Link } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import styles from './CustomerBottomNav.module.css'

const TABS = [
  { to: '/app/explorar', label: 'Buscar', icon: 'search' },
  { to: '/app/promociones', label: 'Promos', icon: 'promo' },
  { to: '/app/reservas', label: 'Reservas', icon: 'calendar' },
  { to: '/app/misiones', label: 'Misiones', icon: 'trophy' },
  { to: '/app/perfil', label: 'Perfil', icon: 'profile' },
] as const

function NavIcon({ name }: { name: (typeof TABS)[number]['icon'] }) {
  switch (name) {
    case 'search':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'promo':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 4 7v2c0 4.2 3.2 8.1 8 9 4.8-.9 8-4.8 8-9V7l-8-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 3v16M4 7h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'trophy':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6 5H4a2 2 0 0 0 2 3M18 5h2a2 2 0 0 1-2 3M12 11v3M9 20h6M10 14h4v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'profile':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 20c1.8-3.5 4.8-5 7-5s5.2 1.5 7 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
  }
}

function CustomerBottomNav() {
  return (
    <nav className={styles.nav} aria-label="Navegación principal">
      <Link to="/" className={styles.sidebarBrand}>
        <img src={ADELIA_LOGO_URL} alt="" className={styles.sidebarLogo} />
        <span className={styles.sidebarName}>Adelia</span>
      </Link>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ''} ${tab.icon === 'calendar' ? styles.tabFeatured : ''}`
          }
          end={tab.to === '/app/explorar'}
        >
          <span className={styles.icon}>
            <NavIcon name={tab.icon} />
          </span>
          <span className={styles.label}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default CustomerBottomNav
