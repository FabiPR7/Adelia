import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import LegalLinks from '../components/LegalLinks'
import { fetchSaasCheckoutSession, type SaasCheckoutSession } from '../services/saasBilling'
import styles from './CompanyPlansPage.module.css'

function CompanyPlanCheckoutSuccessPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') ?? ''
  const [session, setSession] = useState<SaasCheckoutSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      return
    }

    let cancelled = false
    void fetchSaasCheckoutSession(sessionId)
      .then((payload) => {
        if (!cancelled) {
          setSession(payload)
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'No se pudo confirmar el pago.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/empresa" className={styles.brand} aria-label="Adelia empresas">
            <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
            <span>Adelia</span>
          </Link>
          <Link to="/login" className={styles.headerGhost}>
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.success} aria-live="polite">
          {!sessionId ? (
            <>
              <h1>¡Gracias por tu compra!</h1>
              <p>
                Si aún no tienes cuenta, créala con <strong>el mismo correo</strong> con el que has
                pagado y tu plan se activará solo. Si ya la tienes, el plan aparecerá en tu panel en
                unos minutos.
              </p>
              <p>
                <Link to="/empresa/alta" className={`${styles.ctaGhost} ${styles.successBack}`}>
                  Crear mi cuenta
                </Link>
              </p>
              <p>
                <Link to="/login">Ya tengo cuenta</Link>
              </p>
            </>
          ) : error ? (
            <>
              <h1>No encontramos el pago</h1>
              <p>{error}</p>
              <p>
                <Link to="/empresa/planes">Volver a los planes</Link>
              </p>
            </>
          ) : !session ? (
            <>
              <h1>Confirmando el pago…</h1>
              <p>Un momento. Stripe nos está devolviendo el resultado.</p>
            </>
          ) : (
            <>
              {session.paid ? (
                <Navigate
                  to={
                    searchParams.get('next') === 'panel'
                      ? '/panel?tab=plan'
                      : `/empresa/alta?session_id=${encodeURIComponent(sessionId)}`
                  }
                  replace
                />
              ) : (
                <>
                  <h1>Pago iniciado</h1>
                  <p>Stripe aún no ha confirmado el cobro. Si ya pagaste, espera unos segundos y recarga.</p>
                  <p>
                    <Link to="/empresa/planes" className={`${styles.ctaGhost} ${styles.successBack}`}>
                      Volver a planes
                    </Link>
                  </p>
                </>
              )}
            </>
          )}
        </section>
      </main>

      <footer className={styles.siteFooter}>
        <LegalLinks from="/empresa/planes/exito" />
        <p>© {new Date().getFullYear()} Adelia · Reservas para restaurantes</p>
      </footer>
    </div>
  )
}

export default CompanyPlanCheckoutSuccessPage
