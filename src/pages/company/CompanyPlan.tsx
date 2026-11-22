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
import {
  ArrowLeftRight,
  Building2,
  CalendarClock,
  Check,
  CircleAlert,
  CircleX,
  CreditCard,
  ExternalLink,
  ListChecks,
  Receipt,
  Settings2,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { ReportCard, ReportHeader } from '../../components/reports/ReportKit'
import styles from './CompanyPlan.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

function planIcon(id: CompanyPlanId): LucideIcon {
  if (id === 'free') return UtensilsCrossed
  if (id === 'basic') return Store
  return Building2
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
      setError(friendlyErrorMessage(err, 'No se pudo eliminar la cuenta.'))
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
        : currentBilling === 'annual'
          ? 'Renovación anual'
          : 'Renovación mensual'

  const PlanIcon = planIcon(currentPlanId)
  const billingLabel = currentPlanId === 'free' ? 'Gratis' : formatCompanyPlanBilling(currentBilling)
  const priceLabel = currentBilling === 'perpetual' ? 'Pago único' : formatCompanyPlanPrice(currentPlan, currentBilling)
  const paymentChip = currentPlanId === 'free'
    ? null
    : paymentState === 'past_due'
      ? { label: 'Pago pendiente', className: styles.chipDanger }
      : { label: 'Al día', className: styles.chipOk }

  const manageActions = [
    { id: 'change', icon: ArrowLeftRight, title: 'Cambiar de plan', text: 'Pasa de Sala a Local o al revés' },
    { id: 'invoices', icon: Receipt, title: 'Facturas', text: 'Ver y descargar los recibos' },
    { id: 'card', icon: CreditCard, title: 'Método de pago', text: 'Actualizar la tarjeta' },
    { id: 'cancel', icon: CircleX, title: 'Cancelar plan', text: 'Vuelves a Mesa al terminar el ciclo', danger: true },
  ]

  return (
    <div className={styles.page}>
      <ReportHeader
        title="Plan y facturación"
        subtitle="Tu plan, lo que incluye y cómo gestionar el pago. Sala y Local se cobran con Lemon Squeezy."
        actions={
          <Link className={styles.secondaryButton} to="/empresa/planes">
            Ver planes y precios
          </Link>
        }
      />

      <section className={styles.summary} aria-label="Plan actual">
        <span className={styles.summaryIcon} aria-hidden="true">
          <PlanIcon size={22} />
        </span>
        <div className={styles.summaryMain}>
          <span className={styles.summaryLabel}>Plan actual</span>
          <div className={styles.summaryNameRow}>
            <h3 className={styles.summaryName}>{currentPlan.name}</h3>
            <span className={styles.chip}>{billingLabel}</span>
            {paymentChip ? <span className={`${styles.chip} ${paymentChip.className}`}>{paymentChip.label}</span> : null}
          </div>
          <span className={styles.summaryMeta}>{renewalLabel}</span>
        </div>
        <div className={styles.summaryPrice}>
          <strong>{priceLabel}</strong>
          <span>{currentPlan.vatNote}</span>
        </div>
      </section>

      {paymentState === 'past_due' ? (
        <div className={`${styles.notice} ${styles.noticeDanger}`} role="status">
          <CircleAlert size={18} aria-hidden="true" />
          <div className={styles.noticeText}>
            <strong>Tu último pago no se completó</strong>
            <span>Actualiza la tarjeta para no perder el plan.</span>
          </div>
          {manageUrl ? (
            <a className={styles.secondaryButton} href={manageUrl} target="_blank" rel="noreferrer">
              Actualizar tarjeta
            </a>
          ) : null}
        </div>
      ) : null}

      {pendingPlanId && pendingPlanId !== currentPlanId ? (
        <div className={styles.notice} role="status">
          <CalendarClock size={18} aria-hidden="true" />
          <div className={styles.noticeText}>
            <strong>Cambio programado a {getCompanyPlan(pendingPlanId).name}</strong>
            <span>
              Sigues con {currentPlan.name}
              {periodEnd ? ` hasta el ${formatCompanyPlanStartedAt(periodEnd)}` : ''}. Después se aplica{' '}
              {getCompanyPlan(pendingPlanId).name}
              {pendingPlanId === 'free' ? ' y se deja de cobrar.' : '.'}
            </span>
          </div>
          {manageUrl ? (
            <a className={styles.secondaryButton} href={manageUrl} target="_blank" rel="noreferrer">
              Gestionar
            </a>
          ) : null}
        </div>
      ) : null}

      {demo ? (
        <p className={styles.demoNote}>En esta vista de ejemplo el plan no se puede cambiar ni cancelar.</p>
      ) : (
        <>
          <div className={styles.grid}>
            <ReportCard
              title="Gestionar la suscripción"
              subtitle={
                isPaid && currentBilling === 'perpetual'
                  ? 'Tienes el plan de por vida: no hay cuotas que renovar ni nada que cancelar.'
                  : isPaid
                    ? 'Se abre Lemon Squeezy en una pestaña nueva. Entra con el correo con el que pagaste; los cambios se ven aquí en unos minutos.'
                    : 'Estás en Mesa (gratis). Pasa a Sala o Local para desbloquear más funciones.'
              }
              icon={Settings2}
            >
              {isPaid && currentBilling === 'perpetual' ? (
                <ul className={styles.actionList}>
                  <li>
                    <a className={styles.actionRow} href={LEMONSQUEEZY_CUSTOMER_PORTAL_URL} target="_blank" rel="noreferrer">
                      <span className={styles.actionIcon} aria-hidden="true"><Receipt size={17} /></span>
                      <span className={styles.actionText}>
                        <strong>Factura del pago único</strong>
                        <span>Entra con el correo con el que pagaste</span>
                      </span>
                      <ExternalLink size={15} className={styles.actionArrow} aria-hidden="true" />
                    </a>
                  </li>
                </ul>
              ) : isPaid ? (
                <ul className={styles.actionList}>
                  {manageActions.map((action) => {
                    const ActionIcon = action.icon
                    return (
                      <li key={action.id}>
                        <a
                          className={`${styles.actionRow} ${action.danger ? styles.actionRowDanger : ''}`}
                          href={manageUrl ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className={styles.actionIcon} aria-hidden="true"><ActionIcon size={17} /></span>
                          <span className={styles.actionText}>
                            <strong>{action.title}</strong>
                            <span>{action.text}</span>
                          </span>
                          <ExternalLink size={15} className={styles.actionArrow} aria-hidden="true" />
                        </a>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <Link className={styles.primaryButton} to="/empresa/planes">
                  Ver planes de pago
                </Link>
              )}
            </ReportCard>

            <ReportCard title={`Incluido en ${currentPlan.name}`} subtitle={currentPlan.audience} icon={ListChecks}>
              <ul className={styles.perkList}>
                {included.map((item) => (
                  <li key={item.id} className={styles.perk}>
                    <Check size={15} className={styles.perkIcon} aria-hidden="true" />
                    <span>
                      {item.label}
                      {item.showValue ? <span className={styles.perkValue}> · {item.valueLabel}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </ReportCard>
          </div>

          {error ? <p className={styles.errorNote}>{error}</p> : null}

          <section className={styles.dangerZone} aria-label="Eliminar cuenta">
            <div className={styles.dangerText}>
              <h3>Eliminar la cuenta</h3>
              <p>
                Borra {company.name}, el acceso, las reservas, los clientes y las reseñas, y cancela tu
                suscripción. No se puede deshacer.
              </p>
            </div>
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
                  Se borrará el restaurante. Si tienes plan de pago, lo cancelamos primero; si no
                  pudiéramos, te avisamos y no se borra nada. Escribe{' '}
                  <strong>{company.name}</strong> para confirmar.
                </p>
                <input
                  className={styles.deleteInput}
                  value={deleteName}
                  onChange={(event) => setDeleteName(event.target.value)}
                  placeholder={company.name}
                  aria-label={`Escribe ${company.name} para confirmar`}
                  autoComplete="off"
                />
                {error ? <p className={styles.errorNote}>{error}</p> : null}
                <div className={styles.deleteActions}>
                  <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setConfirmDelete(false)}>
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
