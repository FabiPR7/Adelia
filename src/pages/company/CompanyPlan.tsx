import { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import {
  COMPANY_PLANS,
  companyPlanChangeBillingCopy,
  formatCompanyPlanBilling,
  formatCompanyPlanPrice,
  formatCompanyPlanStartedAt,
  getCompanyPlan,
  includedPlanCapabilities,
  parseCompanyPlanBilling,
  parseCompanyPlanId,
  previewCompanyPlanChange,
  type CompanyPlanId,
} from '../../data/companyPlans'
import { logout } from '../../services/auth'
import {
  cancelPendingCompanyPlanChange,
  changeCompanyPlan,
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

function formatMoneyCents(cents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function CompanyPlan() {
  const { company, refreshCompany } = useAuth()
  const demo = useCompanyDemo()
  const currentPlanId = parseCompanyPlanId(company?.planId)
  const currentBilling = parseCompanyPlanBilling(company?.planBilling, currentPlanId)
  const currentPlan = getCompanyPlan(currentPlanId)
  const [selectedId, setSelectedId] = useState<CompanyPlanId>(currentPlanId)
  const [billing, setBilling] = useState<CompanyBillingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmKind, setConfirmKind] = useState<'change' | 'delete' | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const pendingPlanId = billing?.pendingPlanId ?? company?.pendingPlanId ?? null
  const periodEnd = billing?.pendingPlanAt || billing?.currentPeriodEnd
    ? new Date(billing?.pendingPlanAt || billing?.currentPeriodEnd || '')
    : company?.pendingPlanAt ?? null
  const included = useMemo(() => includedPlanCapabilities(currentPlanId), [currentPlanId])
  const selectedPlan = getCompanyPlan(selectedId)
  const preview = useMemo(
    () => previewCompanyPlanChange(currentPlanId, selectedId),
    [currentPlanId, selectedId],
  )
  const billingCopy = useMemo(
    () => companyPlanChangeBillingCopy(preview, periodEnd),
    [preview, periodEnd],
  )

  useEffect(() => {
    setSelectedId(currentPlanId)
  }, [currentPlanId])

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

  const loadBilling = async () => {
    const status = await fetchCompanyBillingStatus()
    setBilling(status)
    await refreshCompany()
  }

  const runChange = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await changeCompanyPlan(selectedId)
      if (result.action === 'checkout' && result.url) {
        window.location.assign(result.url)
        return
      }
      await loadBilling()
      if (result.action === 'upgraded') {
        setMessage(
          result.chargeNowCents
            ? `Plan actualizado. Se ha cobrado ${formatMoneyCents(result.chargeNowCents)}.`
            : `Ya estás en ${selectedPlan.name}.`,
        )
      } else if (result.action === 'scheduled' || result.action === 'canceled_at_period_end') {
        setMessage(billingCopy.charge)
      } else {
        setMessage('Sin cambios.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el plan.')
    } finally {
      setBusy(false)
      setConfirmKind(null)
    }
  }

  const runCancelPending = async () => {
    setBusy(true)
    setError(null)
    try {
      await cancelPendingCompanyPlanChange()
      await loadBilling()
      setMessage('Se ha cancelado el cambio programado. Sigues en tu plan actual.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar el cambio.')
    } finally {
      setBusy(false)
    }
  }

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
      setConfirmKind(null)
    }
  }

  if (!company) {
    return <p className={styles.loading}>Cargando tu plan…</p>
  }

  const ctaLabel =
    preview.kind === 'none'
      ? `Estás en ${currentPlan.name}`
      : preview.kind === 'start_paid'
        ? `Pagar ${selectedPlan.priceMonthly} € y activar ${selectedPlan.name}`
        : preview.kind === 'upgrade_now'
          ? `Pagar la diferencia y pasar a ${selectedPlan.name}`
          : preview.kind === 'downgrade_later'
            ? `Programar bajada a ${selectedPlan.name}`
            : 'Dejar de cobrar y pasar a Mesa'

  const renewalLabel = periodEnd
    ? `Próximo ciclo: ${formatCompanyPlanStartedAt(periodEnd)}`
    : currentPlanId === 'free'
      ? 'Sin renovación'
      : currentBilling === 'perpetual'
        ? 'Plan perpetuo · sin renovación mensual'
        : 'Fecha de renovación pendiente'

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Facturación</p>
        <h2>Plan de {company.name}</h2>
        <p className={styles.heroLead}>
          Aquí ves el plan contratado, lo que incluye y cómo cambiarlo. Los cobros los hace Stripe
          sobre la tarjeta del restaurante.
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
            {currentBilling === 'perpetual' ? 'Perpetuo' : formatCompanyPlanPrice(currentPlan)}
          </strong>
          <span>{currentPlan.vatNote}</span>
        </div>
      </section>

      {pendingPlanId ? (
        <div className={styles.pendingBanner} role="status">
          <div>
            <strong>Cambio programado a {getCompanyPlan(pendingPlanId).name}</strong>
            <p>
              Sigues con las ventajas de {currentPlan.name}
              {periodEnd ? ` hasta el ${formatCompanyPlanStartedAt(periodEnd)}` : ''}.
              Después se aplica {getCompanyPlan(pendingPlanId).name}
              {pendingPlanId === 'free' ? ' y se deja de cobrar.' : '.'}
            </p>
          </div>
          <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => void runCancelPending()}>
            Mantener {currentPlan.name}
          </button>
        </div>
      ) : null}

      {demo ? (
        <p className={styles.requestNote}>En esta vista de ejemplo el plan no se puede cambiar ni cancelar.</p>
      ) : (
        <>
      <section className={styles.ladder} aria-label="Cambiar de plan">
        <div className={styles.ladderHead}>
          <h3>Cambiar de plan</h3>
          <p>Elige Mesa, Sala o Local. Te decimos qué se cobra hoy y qué pasa en la siguiente renovación.</p>
        </div>

        <div className={styles.planGrid}>
          {COMPANY_PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlanId
            const isSelected = plan.id === selectedId
            const isPending = plan.id === pendingPlanId

            return (
              <button
                key={plan.id}
                type="button"
                className={`${styles.planCard} ${styles[`card_${PLAN_TONE[plan.id]}`]} ${isSelected ? styles.planCardOn : ''} ${plan.highlighted ? styles.planCardStar : ''}`}
                onClick={() => setSelectedId(plan.id)}
                aria-pressed={isSelected}
              >
                {isCurrent ? <span className={styles.youAre}>Actual</span> : null}
                {isPending ? <span className={styles.soon}>Programado</span> : null}
                <span className={styles.cardIcon}>
                  <Icon name={planIcon(plan.id)} />
                </span>
                <strong className={styles.cardName}>{plan.name}</strong>
                <span className={styles.cardPrice}>{formatCompanyPlanPrice(plan)}</span>
                <span className={styles.cardHook}>{plan.audience}</span>
                <ul className={styles.cardSpecs} aria-hidden="true">
                  {plan.specs.map((spec) => (
                    <li key={spec.label}>
                      <strong>{spec.value}</strong>
                      <span>{spec.label}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </section>

      {preview.kind === 'none' ? (
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
      ) : (
        <section
          className={`${styles.compare} ${preview.kind === 'upgrade_now' || preview.kind === 'start_paid' ? styles.compareUp : styles.compareDown}`}
        >
          <div className={styles.compareHero}>
            <p className={styles.compareKicker}>{billingCopy.title}</p>
            <h3>
              {currentPlan.name} → {selectedPlan.name}
            </h3>
            <p>{billingCopy.charge}</p>
            {billingCopy.next ? <p>{billingCopy.next}</p> : null}
          </div>

          <div className={styles.billingBox}>
            <p>
              <strong>Hoy: </strong>
              {preview.chargeNowMonthly > 0
                ? preview.kind === 'start_paid'
                  ? `${preview.chargeNowMonthly} €`
                  : `diferencia de ${preview.monthlyDelta} € (prorrateada)`
                : '0 €'}
            </p>
            <p>
              <strong>Siguiente factura: </strong>
              {selectedPlan.priceMonthly > 0 ? `${selectedPlan.priceMonthly} €/mes` : 'sin cobro'}
            </p>
          </div>

          <div className={styles.deltaGrid}>
            {preview.comparison.gained.length > 0 ? (
              <div className={styles.gainCol}>
                <h4>Se activa</h4>
                <ul>
                  {preview.comparison.gained.map((item) => (
                    <li key={item.id}>
                      <span className={styles.deltaIcon}>
                        <Icon name="check" />
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <em>{item.toLabel}</em>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview.comparison.lost.length > 0 ? (
              <div className={styles.loseCol}>
                <h4>Se pierde al aplicar el cambio</h4>
                <ul>
                  {preview.comparison.lost.map((item) => (
                    <li key={item.id}>
                      <span className={styles.deltaIcon}>
                        <Icon name="lock" />
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <em>
                          {preview.kind === 'downgrade_later' || preview.kind === 'cancel_later'
                            ? `A partir del ${formatCompanyPlanStartedAt(periodEnd) || 'fin de ciclo'}`
                            : item.toLabel}
                        </em>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={`${styles.cta} ${preview.kind === 'downgrade_later' || preview.kind === 'cancel_later' ? styles.ctaDown : ''}`}
            disabled={busy}
            onClick={() => setConfirmKind('change')}
          >
            {busy ? 'Procesando…' : ctaLabel}
          </button>
          {message ? <p className={styles.requestNote}>{message}</p> : null}
          {error ? <p className={styles.errorNote}>{error}</p> : null}
        </section>
      )}

      {preview.kind === 'none' && (message || error) ? (
        <p className={error ? styles.errorNote : styles.requestNote}>{error ?? message}</p>
      ) : null}

      <section className={styles.dangerZone} aria-label="Eliminar cuenta">
        <h3>Eliminar la cuenta</h3>
        <p>
          Borra {company.name}, el acceso, las reservas y deja de cobrar. Esta acción no se puede deshacer.
        </p>
        <button
          type="button"
          className={styles.dangerBtn}
          disabled={busy}
          onClick={() => {
            setDeleteName('')
            setConfirmKind('delete')
          }}
        >
          Eliminar restaurante
        </button>
      </section>

      <ConfirmDialog
        isOpen={confirmKind === 'change'}
        title={billingCopy.title}
        message={`${billingCopy.charge} ${billingCopy.next}`.trim()}
        confirmLabel={ctaLabel}
        variant={preview.kind === 'cancel_later' || preview.kind === 'downgrade_later' ? 'danger' : 'default'}
        isLoading={busy}
        onConfirm={() => void runChange()}
        onCancel={() => setConfirmKind(null)}
      />

      {confirmKind === 'delete' ? (
        <div className={styles.deleteOverlay} role="presentation" onClick={() => setConfirmKind(null)}>
          <div
            className={styles.deleteDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-plan-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-plan-title">Eliminar {company.name}</h2>
            <p>
              Se cancelará la suscripción y se borrará el restaurante. Escribe <strong>{company.name}</strong> para
              confirmar.
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
              <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => setConfirmKind(null)}>
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
