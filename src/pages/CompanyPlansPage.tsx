import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ADELIA_LOGO_URL } from '../constants/brand'
import LegalLinks from '../components/LegalLinks'
import {
  COMPANY_PLANS,
  isPaidCompanyPlan,
} from '../data/companyPlans'
import { DemoCompanyAuthProvider } from '../context/CompanyDemoContext'
import { fetchSaasBillingStatus, startSaasPlanCheckout } from '../services/saasBilling'
import styles from './CompanyPlansPage.module.css'

const CompanyDashboard = lazy(() => import('./CompanyDashboard'))

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
          <h1>Tres planes. Sin comisión por reserva.</h1>
          <p>
            Mesa es gratis. Sala (39 €/mes) digitaliza la sala. Local (59 €/mes) desbloquea informes,
            todas las promociones, Compite y más visibilidad.
          </p>
          <p className={styles.demoJump}>
            <a href="#demo-panel">Prueba el panel con datos de ejemplo</a>
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
            El pago online aún no está disponible en este entorno. Sala y Local no se pueden contratar ahora. Mesa sigue gratis.
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
                className={`${styles.card} ${styles[`card_${plan.id}`]} ${plan.highlighted ? styles.cardHighlight : ''}`}
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

                <ul className={styles.specs} aria-label={`Límites de ${plan.name}`}>
                  {plan.specs.map((spec) => (
                    <li key={spec.label}>
                      <strong>{spec.value}</strong>
                      <span>{spec.label}</span>
                    </li>
                  ))}
                </ul>

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
                  <Link to="/empresa/alta?plan=mesa" className={`${styles.cta} ${styles.ctaGhost}`}>
                    {plan.ctaLabel}
                  </Link>
                )}

                {paid ? (
                  <p className={styles.ctaHint}>
                    Tarjeta, Apple Pay o Google Pay. Cancela cuando quieras.
                  </p>
                ) : (
                  <p className={styles.ctaHint}>
                    Alta ahora, sin tarjeta. Reservas, 1 carta en lista y QR.
                  </p>
                )}
              </article>
            )
          })}
        </section>

        <section className={styles.compare} aria-label="Comparar planes">
          <h2>Comparativa</h2>
          <div className={styles.compareWrap}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th scope="col"> </th>
                  {COMPANY_PLANS.map((plan) => (
                    <th key={plan.id} scope="col">
                      {plan.name}
                      <span>{plan.priceMonthly === 0 ? 'Gratis' : `${plan.priceMonthly} €/mes`}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Cartas', '1 en lista', '3 con fotos', '5 digital o PDF'],
                  ['Excel de productos', '—', 'Incluido', 'Incluido'],
                  ['Carta PDF', '—', '—', 'Incluido'],
                  ['Mesas', '8', '15', '50'],
                  ['Mapas activos', '—', '1', '5'],
                  ['Promociones', '—', '3 Oferta', '5 de cada tipo'],
                  ['Informes', '—', 'Reservas y clientes', 'Todos'],
                  ['Compite', '—', '—', 'Premios y descuentos'],
                  ['Fianzas', '—', 'Incluido', 'Incluido'],
                  ['Visibilidad', 'Ficha pública', 'Ficha pública', 'Mayor visibilidad'],
                ].map(([label, mesa, sala, local]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{mesa}</td>
                    <td>{sala}</td>
                    <td>{local}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ul className={styles.trust}>
          <li>
            <strong>Cobro a Adelia</strong>
            El plan entra en la cuenta Stripe de la plataforma, no en la del restaurante.
          </li>
          <li>
            <strong>Apple Pay y Google Pay</strong>
            En Safari puedes pagar con Apple Pay; en Chrome, con Google Pay.
          </li>
          <li>
            <strong>Fianzas aparte</strong>
            Cuando las actives, van al Stripe Connect de cada local.
          </li>
          <li>
            <strong>Sin comisión</strong>
            Ni por cubierto ni por reserva. Solo el plan mensual.
          </li>
        </ul>
      </main>

      <section className={styles.demoBand} id="demo-panel" aria-labelledby="demo-panel-title">
        <div className={styles.demoInner}>
          <header className={styles.demoIntro}>
            <p className={styles.eyebrow}>Prueba el panel</p>
            <h2 id="demo-panel-title">Así se trabaja un restaurante en Adelia</h2>
            <p>
              Entra en reservas, carta, clientes, informes y Compite. Es el panel real, con un local de
              ejemplo: puedes navegar, no se guarda nada y no hay alta, edición ni borrado.
            </p>
          </header>
          <Suspense
            fallback={
              <p className={styles.demoFallback}>Cargando el panel de ejemplo…</p>
            }
          >
            <DemoCompanyAuthProvider>
              <CompanyDashboard demo />
            </DemoCompanyAuthProvider>
          </Suspense>
        </div>
      </section>

      <footer className={styles.siteFooter}>
        <LegalLinks from="/empresa/planes" />
        <p>© {new Date().getFullYear()} Adelia · Reservas para restaurantes</p>
      </footer>
    </div>
  )
}

export default CompanyPlansPage
