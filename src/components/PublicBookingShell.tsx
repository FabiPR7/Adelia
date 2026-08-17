import { Link } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import type { PublicBookingCompany } from '../services/publicApi'
import styles from './PublicBookingShell.module.css'

interface PublicBookingShellProps {
  company: PublicBookingCompany
  legalFrom: string
  children: React.ReactNode
  profileHref?: string | null
  reserveHref?: string | null
}

function PublicBookingShell({
  company,
  legalFrom,
  children,
  profileHref = null,
  reserveHref = null,
}: PublicBookingShellProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerSide}>
          <div className={styles.adeliaBrand}>
            <img src={ADELIA_LOGO_URL} alt="" className={styles.adeliaLogo} />
            <span>Adelia</span>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {company.logoUrl ? (
            <img
              src={optimizeCloudinaryUrl(company.logoUrl, CLOUDINARY_DISPLAY.logo)}
              alt=""
              className={styles.companyLogo}
            />
          ) : (
            <span className={styles.companyLogoFallback} aria-hidden="true">
              {company.name.charAt(0).toUpperCase()}
            </span>
          )}
          <h1 className={styles.headerTitle}>{company.name}</h1>
        </div>

        <div className={styles.headerSide}>
          {profileHref && (
            <Link to={profileHref} className={styles.headerLink}>
              Ver restaurante
            </Link>
          )}
          {reserveHref && (
            <Link to={reserveHref} className={styles.headerLinkPrimary}>
              Reservar
            </Link>
          )}
        </div>
      </header>

      {children}

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.footerLogo} />
          <span>Adelia</span>
        </div>
        <nav className={styles.footerLinks} aria-label="Legal">
          <Link to={`/legal/aviso-legal?from=${encodeURIComponent(legalFrom)}`}>Aviso legal</Link>
          <Link to={`/legal/privacidad?from=${encodeURIComponent(legalFrom)}`}>Privacidad</Link>
          <Link to={`/legal/terminos?from=${encodeURIComponent(legalFrom)}`}>Términos</Link>
          <Link to={`/legal/cookies?from=${encodeURIComponent(legalFrom)}`}>Cookies</Link>
        </nav>
        <p className={styles.footerCopy}>
          © {new Date().getFullYear()} Adelia · Gestión de reservas para restaurantes
        </p>
      </footer>
    </div>
  )
}

export default PublicBookingShell
