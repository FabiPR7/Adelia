import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { isPublicLegalDocId, PUBLIC_LEGAL_DOCUMENTS } from '../content/publicLegal'
import styles from './PublicLegalPage.module.css'

function PublicLegalPage() {
  const { doc = '' } = useParams()
  const [searchParams] = useSearchParams()

  if (!isPublicLegalDocId(doc)) {
    return <Navigate to="/legal/privacidad" replace />
  }

  const document = PUBLIC_LEGAL_DOCUMENTS[doc]
  const returnTo = searchParams.get('from')
  const safeReturnTo = returnTo && returnTo.startsWith('/reservar/') ? returnTo : null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {safeReturnTo ? (
          <Link to={safeReturnTo} className={styles.brand}>
            <img src="/adelia-logo.png" alt="" className={styles.brandLogo} />
            <span>Adelia</span>
          </Link>
        ) : (
          <div className={styles.brand}>
            <img src="/adelia-logo.png" alt="" className={styles.brandLogo} />
            <span>Adelia</span>
          </div>
        )}
        {safeReturnTo && (
          <Link to={safeReturnTo} className={styles.backLink}>
            ← Volver a reservar
          </Link>
        )}
      </header>

      <main className={styles.main}>
        <article className={styles.card}>
          <h1>{document.title}</h1>
          <p className={styles.updated}>Última actualización: agosto 2026</p>
          {document.sections.map((section) => (
            <section key={section.heading} className={styles.section}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </article>
      </main>

      <footer className={styles.footer}>© {new Date().getFullYear()} Adelia</footer>
    </div>
  )
}

export default PublicLegalPage
