import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import LegalLinks from '../components/LegalLinks'
import {
  COMPANY_PLANS,
  companyPlanMailto,
  isPaidCompanyPlan,
} from '../data/companyPlans'
import { fetchSaasBillingStatus, startSaasPlanCheckout } from '../services/saasBilling'
import styles from './CompanyPlansPage.module.css'

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.check}>
      <path
        d="M4.5 10.4 8.2 14l7.3-8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CompanyPlansPage() {
  const [searchParams] = useSearchParams()
  const cancelled = searchParams.get('cancelado') === '1'
  const [billingConfigured, setBillingConfigured] = useState<boolean | null>(null)
  const [testMode, setTestMode] = useState(true)
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    let cancelledFetch = false
    void fetchSaasBillingStatus()
      .then((status) => {
        if (cancelledFetch) {
          return
        }
        setBillingConfigured(status.configured)
        setTestMode(status.testMode)
      })
      .catch(() => {
        if (!cancelledFetch) {
          setBillingConfigured(false)
        }
      })

    return () => {
      cancelledFetch = true
    }
  }, [])

  const startCheckout = async (planId: string) => {
    setCheckoutError(null)
    setBusyPlanId(planId)
    try {
      const session = await startSaasPlanCheckout(planId)
      window.location.assign(session.url)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'No se pudo abrir el pago.')
      setBusyPlanId(null)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/empresa" className={styles.brand} aria-label="Adelia empresas">
            <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
            <span>Adelia</span>
          </Link>

          <div className={styles.headerActions}>
            <Link to="/login" className={styles.headerGhost}>
              Iniciar sesión
            </Link>
            <Link to="/" className={styles.headerUserLink}>
              ¿Eres usuario?
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Planes para restaurantes</p>
          <h1>Elige cómo quieres trabajar con Adelia</h1>
          <p>
            Sin comisión por reserva. Mesa es gratis. Sala y Local se pagan a Adelia con Stripe,
            a la cuenta de la plataforma.
          </p>
        </header>

        {testMode && billingConfigured ? (
          <p className={styles.testBanner} role="status">
            Modo prueba de Stripe. No se cobra dinero real. Tarjeta de test:
            {' '}
            <strong>4242 4242 4242 4242</strong>
            , fecha futura y CVC 123. Apple Pay sale en Safari si lo tienes activo en el Dashboard de Stripe (modo test).
          </p>
        ) : null}

        {billingConfigured === false ? (
          <p className={styles.notice} role="status">
            El pago online aún no está disponible en este entorno. Mesa sigue abierto por correo.
          </p>
        ) : null}

        {cancelled ? (
          <p className={styles.notice} role="status">
            Has cancelado el pago. Puedes elegir otro plan cuando quieras.
          </p>
        ) : null}

        {checkoutError ? (
          <p className={styles.error} role="alert">
            {checkoutError}
          </p>
        ) : null}

        <section className={styles.grid} aria-label="Planes Adelia">
          {COMPANY_PLANS.map((plan) => {
            const paid = isPaidCompanyPlan(plan)
            const busy = busyPlanId === plan.id

            return (
              <article
                key={plan.id}
                className={`${styles.card} ${plan.highlighted ? styles.cardHighlight : ''}`}
              >
                {plan.badge ? <p className={styles.ribbon}>{plan.badge}</p> : null}

                <div className={styles.cardHead}>
                  <p className={styles.planName}>{plan.name}</p>
                  <p className={styles.audience}>{plan.audience}</p>
                </div>

                {plan.priceMonthly === 0 ? (
                  <p className={styles.price}>
                    <span className={styles.gratis}>Gratis</span>
                  </p>
                ) : (
                  <p className={styles.price}>
                    <span className={styles.amount}>{plan.priceMonthly}</span>
                    <span className={styles.currency}>€</span>
                    <span className={styles.period}>{plan.period}</span>
                  </p>
                )}
                <p className={styles.vat}>{plan.vatNote}</p>

                <ul className={styles.chips} aria-label={`Incluye en ${plan.name}`}>
                  {plan.chips.map((chip) => (
                    <li key={chip}>{chip}</li>
                  ))}
                </ul>

                <ul className={styles.features}>
                  {plan.includesPrevious ? (
                    <li className={styles.includes}>
                      <CheckIcon />
                      {plan.includesPrevious}
                    </li>
                  ) : null}
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {paid ? (
                  <button
                    type="button"
                    className={styles.cta}
                    disabled={busy || billingConfigured === false}
                    onClick={() => void startCheckout(plan.id)}
                  >
                    {busy ? 'Abriendo Stripe…' : plan.ctaLabel}
                  </button>
                ) : (
                  <a href={companyPlanMailto(plan)} className={`${styles.cta} ${styles.ctaGhost}`}>
                    {plan.ctaLabel}
                  </a>
                )}

                {paid ? (
                  <p className={styles.ctaHint}>
                    Tarjeta, Apple Pay o Google Pay. Cancela cuando quieras.
                  </p>
                ) : (
                  <p className={styles.ctaHint}>Te activamos la cuenta. Sin tarjeta.</p>
                )}
              </article>
            )
          })}
        </section>

        <ul className={styles.trust}>
          <li>El cobro entra en la cuenta Stripe de Adelia, no en la del restaurante.</li>
          <li>En iPhone o Mac con Safari puedes pagar con Apple Pay; en Chrome, con Google Pay.</li>
          <li>Las fianzas de reserva, cuando las actives, van al Stripe Connect de cada local.</li>
          <li>Sin comisión por cubierto ni por reserva.</li>
        </ul>
      </main>

      <footer className={styles.siteFooter}>
        <LegalLinks from="/empresa/planes" />
        <p>© {new Date().getFullYear()} Adelia · Reservas para restaurantes</p>
      </footer>
    </div>
  )
}

export default CompanyPlansPage
