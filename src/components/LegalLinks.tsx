import { Link } from 'react-router-dom'
import { LEGAL_DOC_LINKS, legalDocPath } from '../content/publicLegal'
import styles from './LegalLinks.module.css'

interface LegalLinksProps {
  from?: string
  variant?: 'inline' | 'sidebar'
}

function LegalLinks({ from, variant = 'inline' }: LegalLinksProps) {
  return (
    <nav className={variant === 'sidebar' ? styles.sidebar : styles.inline} aria-label="Información legal">
      {LEGAL_DOC_LINKS.map((item) => (
        <Link key={item.id} to={legalDocPath(item.id, from)}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export default LegalLinks
