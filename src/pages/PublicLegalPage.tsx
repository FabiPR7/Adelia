import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import {
  isPublicLegalDocId,
  LEGAL_DOC_LINKS,
  LEGAL_UPDATED_LABEL,
  PUBLIC_LEGAL_DOCUMENTS,
  legalDocPath,
  safeLegalReturnTo,
} from '../content/publicLegal'
import LegalLinks from '../components/LegalLinks'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { openCookieSettings } from '../utils/cookieConsent'
import styles from './PublicLegalPage.module.css'

function PublicLegalPage() {
  const { doc = '' } = useParams()
  const [searchParams] = useSearchParams()

  if (!isPublicLegalDocId(doc)) {
    return <Navigate to="/legal/aviso-legal" replace />
  }

  const document = PUBLIC_LEGAL_DOCUMENTS[doc]
  const returnTo = safeLegalReturnTo(searchParams.get('from'))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={returnTo ?? '/'} className={styles.brand}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.brandLogo} />
          <span>Adelia</span>
        </Link>
        {returnTo ? (
          <Link to={returnTo} className={styles.backLink}>
            ← Volver
          </Link>
        ) : null}
      </header>

      <main className={styles.main}>
        <article className={styles.card}>
          <nav className={styles.docNav} aria-label="Documentos legales">
            {LEGAL_DOC_LINKS.map((item) => (
              <Link
                key={item.id}
                to={legalDocPath(item.id, returnTo ?? undefined)}
                className={item.id === doc ? styles.docNavActive : styles.docNavLink}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <h1>{document.title}</h1>
          <p className={styles.updated}>Última actualización: {LEGAL_UPDATED_LABEL}</p>
          <p className={styles.summary}>{document.summary}</p>
          {document.sections.map((section) => (
            <section key={section.heading} className={styles.section}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.heading}-${index}`}>{paragraph}</p>
              ))}
            </section>
          ))}
          {doc === 'cookies' ? (
            <button type="button" className={styles.prefsButton} onClick={() => openCookieSettings()}>
              Cambiar preferencias de cookies
            </button>
          ) : null}
        </article>
      </main>

      <footer className={styles.footer}>
        <LegalLinks from={returnTo ?? undefined} />
        <p>© {new Date().getFullYear()} Adelia</p>
      </footer>
    </div>
  )
}

export default PublicLegalPage
