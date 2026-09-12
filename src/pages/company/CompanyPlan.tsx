import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import {
  formatCompanyPlanBilling,
  formatCompanyPlanPrice,
  formatCompanyPlanStartedAt,
  getCompanyPlan,
  includedPlanCapabilities,
  parseCompanyPlanBilling,
  parseCompanyPlanId,
  type CompanyPlanId,
} from '../../data/companyPlans'
import { logout } from '../../services/auth'
import { LEMONSQUEEZY_CUSTOMER_PORTAL_URL } from '../../data/lemonSqueezyCheckout'
import {
  deleteCompanyAccount,
  fetchCompanyBillingStatus,
  type CompanyBillingStatus,
} from '../../services/companyBilling'
import styles from './CompanyPlan.module.css'

const PLAN_TONE: Record<CompanyPlanId, string> = {
  free: 'mesa',
  basic: 'sala',
  premium: 'local',
  premium_plus: 'casa',
}

function Icon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'mesa':
      return (
        <svg {...common}>
          <path d="M4 10h16M6 10v8M18 10v8M8 6h8l1 4H7l1-4z" />
        </svg>
      )
    case 'sala':
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M8 9h3v3H8zM13 9h3v3h-3zM8 14h8" />
        </svg>
      )
    case 'local':
      return (
        <svg {...common}>
          <path d="M4 20V9l8-5 8 5v11" />
          <path d="M9 20v-7h6v7" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 13l4 4 10-10" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      )
  }
}

function planIcon(id: CompanyPlanId): string {
  if (id === 'free') return 'mesa'
  if (id === 'basic') return 'sala'
  return 'local'
}

function CompanyPlan() {
  const { company } = useAuth()
  const demo = useCompanyDemo()
  const currentPlanId = parseCompanyPlanId(company?.planId)
  const currentBilling = parseCompanyPlanBilling(company?.planBilling, currentPlanId)
  const currentPlan = getCompanyPlan(currentPlanId)
  const [billing, setBilling] = useState<CompanyBillingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteName, setDeleteName] = useState('')

  const pendingPlanId = billing?.pendingPlanId ?? company?.pendingPlanId ?? null
  const periodEnd = billing?.pendingPlanAt || billing?.currentPeriodEnd
    ? new Date(billing?.pendingPlanAt || billing?.currentPeriodEnd || '')
    : (company?.pendingPlanAt as Date | null | undefined) ?? null
  const included = useMemo(() => includedPlanCapabilities(currentPlanId), [currentPlanId])
  const savedPortalUrl = billing?.portalUrl ?? null
  const isPaid = currentPlanId === 'basic' || currentPlanId === 'premium'
  // URL para gestionar la suscripción: la concreta de esta suscripción si la
  // tenemos, si no el portal genérico de Lemon Squeezy (entra con su correo).
  const manageUrl = savedPortalUrl ?? (isPaid ? LEMONSQUEEZY_CUSTOMER_PORTAL_URL : null)
  const paymentState = billing?.paymentState ?? null

  useEffect(() => {
    let cancelled = false
    void fetchCompanyBillingStatus()
      .then((status) => {
        if (!cancelled) {
          setBilling(status)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [company?.id, company?.planId, company?.pendingPlanId])

  const runDelete = async () => {
    if (!company) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteCompanyAccount(deleteName.trim())
      await logout()
      window.location.assign('/empresa')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.')
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  if (!company) {
    return <p className={styles.loading}>Cargando tu plan…</p>
  }

  const renewalLabel = periodEnd
    ? `Próximo ciclo: ${formatCompanyPlanStartedAt(periodEnd)}`
    : currentPlanId === 'free'
      ? 'Sin renovación'
      : currentBilling === 'perpetual'
        ? 'Plan perpetuo · sin renovación mensual'
        : 'Renovación mensual'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Facturación</p>
        <h2>Plan de {company.name}</h2>
        <p className={styles.heroLead}>
          Aquí ves el plan contratado y lo que incluye. El pago mensual de Sala y Local se gestiona
          en Lemon Squeezy.
        </p>
      </header>

      <section className={`${styles.statusCard} ${styles[`glow_${PLAN_TONE[currentPlanId]}`]}`} aria-label="Plan actual">
        <div className={styles.statusIcon}>
          <Icon name={planIcon(currentPlanId)} />
        </div>
        <div className={styles.statusCopy}>
          <p className={styles.statusEyebrow}>Plan actual</p>
          <h3>{currentPlan.name}</h3>
          <p className={styles.statusMeta}>
            {[
              currentPlanId === 'free' ? 'Gratis' : formatCompanyPlanBilling(currentBilling),
              renewalLabel,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className={styles.statusPrice}>
          <strong>
            {currentBilling === 'perpetual' ? 'Perpetuo' : formatCompanyPlanPrice(currentPlan, currentBilling)}
          </strong>
          <span>{currentPlan.vatNote}</span>
        </div>
      </section>

      {paymentState === 'past_due' ? (
        <div className={styles.pendingBanner} role="status">
          <div>
            <strong>Tu último pago no se completó</strong>
            <p>Actualiza la tarjeta para no perder el plan.</p>
          </div>
          {manageUrl ? (
            <a className={styles.ghostBtn} href={manageUrl} target="_blank" rel="noreferrer">
              Actualizar tarjeta
            </a>
          ) : null}
        </div>
      ) : null}

      {pendingPlanId && pendingPlanId !== currentPlanId ? (
        <div className={styles.pendingBanner} role="status">
          <div>
            <strong>Cambio programado a {getCompanyPlan(pendingPlanId).name}</strong>
            <p>
              Sigues con {currentPlan.name}
              {periodEnd ? ` hasta el ${formatCompanyPlanStartedAt(periodEnd)}` : ''}. Después se
              aplica {getCompanyPlan(pendingPlanId).name}
              {pendingPlanId === 'free' ? ' y se deja de cobrar.' : '.'}
            </p>
          </div>
          {manageUrl ? (
            <a className={styles.ghostBtn} href={manageUrl} target="_blank" rel="noreferrer">
              Gestionar en Lemon Squeezy
            </a>
          ) : null}
        </div>
      ) : null}

      {demo ? (
        <p className={styles.requestNote}>En esta vista de ejemplo el plan no se puede cambiar ni cancelar.</p>
      ) : (
        <>
          <section className={styles.ladder} aria-label="Gestionar suscripción">
            <div className={styles.ladderHead}>
              <h3>Tu suscripción</h3>
              <p>
                {isPaid
                  ? savedPortalUrl
                    ? 'Se abre el portal de Lemon Squeezy en una pestaña nueva; los cambios se reflejan aquí en unos minutos.'
                    : 'Se abre Lemon Squeezy en una pestaña nueva — entra con el correo que usaste al pagar y desde ahí gestionas todo.'
                  : 'Estás en Mesa (gratis). Pasa a Sala o Local para desbloquear más funciones.'}
              </p>
            </div>

            {isPaid ? (
              <>
                <div className={styles.actionGrid}>
                  <a className={styles.actionCard} href={manageUrl ?? undefined} target="_blank" rel="noreferrer">
                    <span className={styles.actionIcon}>
                      <Icon name="local" />
                    </span>
                    <span>
                      <strong>Cambiar de plan</strong>
                      <em>Pasa de Sala a Local o al revés</em>
                    </span>
                  </a>
                  <a className={styles.actionCard} href={manageUrl ?? undefined} target="_blank" rel="noreferrer">
                    <span className={styles.actionIcon}>
                      <Icon name="check" />
                    </span>
                    <span>
                      <strong>Facturas</strong>
                      <em>Ver y descargar recibos</em>
                    </span>
                  </a>
                  <a className={styles.actionCard} href={manageUrl ?? undefined} target="_blank" rel="noreferrer">
                    <span className={styles.actionIcon}>
                      <Icon name="lock" />
                    </span>
                    <span>
                      <strong>Método de pago</strong>
                      <em>Actualizar la tarjeta</em>
                    </span>
                  </a>
                  <a className={`${styles.actionCard} ${styles.actionCardDanger}`} href={manageUrl ?? undefined} target="_blank" rel="noreferrer">
                    <span className={styles.actionIcon}>
                      <Icon name="mesa" />
                    </span>
                    <span>
                      <strong>Cancelar plan</strong>
                      <em>Vuelves a Mesa al fin del ciclo</em>
                    </span>
                  </a>
                </div>
                <Link className={styles.mailFallback} to="/empresa/planes">
                  Ver todos los planes y precios →
                </Link>
              </>
            ) : (
              <Link className={styles.cta} to="/empresa/planes">
                Ver planes de pago
              </Link>
            )}
          </section>

          <section className={styles.includedPanel} aria-label="Lo incluido">
            <div className={styles.panelHead}>
              <h3>Incluido en {currentPlan.name}</h3>
              <p>{currentPlan.audience}</p>
            </div>
            <ul className={styles.perkGrid}>
              {included.map((item) => (
                <li key={item.id}>
                  <span className={styles.perkIcon}>
                    <Icon name="check" />
                  </span>
                  <span>
                    {item.label}
                    {item.showValue ? <em> · {item.valueLabel}</em> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {error ? <p className={styles.errorNote}>{error}</p> : null}

          <section className={styles.dangerZone} aria-label="Eliminar cuenta">
            <h3>Eliminar la cuenta</h3>
            <p>
              Borra {company.name}, el acceso, las reservas y deja de cobrar. Esta acción no se puede
              deshacer.
            </p>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={busy}
              onClick={() => {
                setDeleteName('')
                setConfirmDelete(true)
              }}
            >
              Eliminar restaurante
            </button>
          </section>

          {confirmDelete ? (
            <div className={styles.deleteOverlay} role="presentation" onClick={() => setConfirmDelete(false)}>
              <div
                className={styles.deleteDialog}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-plan-title"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 id="delete-plan-title">Eliminar {company.name}</h2>
                <p>
                  Se borrará el restaurante. Si tienes plan de pago, cancélalo antes en Lemon Squeezy.
                  Escribe <strong>{company.name}</strong> para confirmar.
                </p>
                <input
                  className={styles.deleteInput}
                  value={deleteName}
                  onChange={(event) => setDeleteName(event.target.value)}
                  placeholder={company.name}
                  autoComplete="off"
                />
                {error ? <p className={styles.errorNote}>{error}</p> : null}
                <div className={styles.deleteActions}>
                  <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={busy || deleteName.trim() !== company.name.trim()}
                    onClick={() => void runDelete()}
                  >
                    {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default CompanyPlan
