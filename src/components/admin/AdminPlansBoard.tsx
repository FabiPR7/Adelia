import { useEffect, useMemo, useState } from 'react'
import type { AdminCompany } from '../../types'
import type { SaasSubscriptionLead } from '../../types/adminOps'
import {
  formatCompanyPlanBilling,
  formatCompanyPlanStartedAt,
  getCompanyPlan,
  monthlyChargeLabel,
  monthlyChargeState,
  nextMonthlyChargeDate,
  parseCompanyPlanId,
  type MonthlyChargeState,
} from '../../data/companyPlans'
import { listSaasSubscriptionLeads } from '../../services/adminOps'
import { IconSearch } from './AdminIcons'
import styles from './AdminOpsBoard.module.css'

interface AdminPlansBoardProps {
  companies: AdminCompany[]
  isSaving: boolean
  onOpenCompany: (companyId: string) => void
  onMarkPaid: (company: AdminCompany) => Promise<void>
}

type PlanFilter = 'all' | 'monthly' | 'action'

function stateClass(state: MonthlyChargeState) {
  if (state === 'overdue') return styles.overdue
  if (state === 'due') return styles.due
  if (state === 'paid') return styles.paid
  if (state === 'future') return styles.future
  return styles.pending
}

function AdminPlansBoard({ companies, isSaving, onOpenCompany, onMarkPaid }: AdminPlansBoardProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PlanFilter>('all')
  const [leads, setLeads] = useState<SaasSubscriptionLead[]>([])

  useEffect(() => {
    let cancelled = false
    void listSaasSubscriptionLeads()
      .then((items) => {
        if (!cancelled) {
          setLeads(items)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLeads([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return companies
      .filter((company) => parseCompanyPlanId(company.planId) !== 'free')
      .map((company) => {
        const plan = getCompanyPlan(parseCompanyPlanId(company.planId))
        const monthly = company.planBilling !== 'perpetual' && company.planStartedAt
        const state = monthly && company.planStartedAt
          ? monthlyChargeState({ startedAt: company.planStartedAt, lastPaidAt: company.planLastPaidAt })
          : null
        return { company, plan, state, monthly: Boolean(monthly) }
      })
      .filter((row) => {
        if (filter === 'monthly' && !row.monthly) return false
        if (filter === 'action' && row.state !== 'due' && row.state !== 'overdue') return false
        if (!needle) return true
        return [row.company.name, row.plan?.name, row.company.municipality]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((left, right) => {
        const rank = (state: MonthlyChargeState | null) => {
          if (state === 'overdue') return 0
          if (state === 'due') return 1
          if (state === 'upcoming') return 2
          if (state === 'future') return 3
          return 4
        }
        return rank(left.state) - rank(right.state)
      })
  }, [companies, filter, query])

  const monthlyCount = companies.filter((company) => (
    parseCompanyPlanId(company.planId) !== 'free' && company.planBilling !== 'perpetual'
  )).length
  const actionCount = rows.filter((row) => row.state === 'due' || row.state === 'overdue').length
  const perpetualCount = companies.filter((company) => company.planBilling === 'perpetual').length

  return (
    <div className={styles.wrap}>
      <div className={styles.kpis}>
        <article>
          <strong>{monthlyCount}</strong>
          <span>Mensuales</span>
        </article>
        <article>
          <strong>{perpetualCount}</strong>
          <span>Perpetuas</span>
        </article>
        <article>
          <strong>{actionCount}</strong>
          <span>A cobrar ahora</span>
        </article>
        <article>
          <strong>{companies.filter((company) => parseCompanyPlanId(company.planId) !== 'free').length}</strong>
          <span>De pago</span>
        </article>
      </div>

      {leads.length > 0 ? (
        <div className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Pagos Stripe (cuenta Adelia)</th>
                <th>Plan</th>
                <th>Contacto</th>
                <th>Modo</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>{lead.restaurantName || 'Sin nombre de local'}</strong>
                    <em>{lead.city || lead.status}</em>
                  </td>
                  <td>
                    {lead.planName}
                    <em>
                      {lead.amountTotal
                        ? `${(lead.amountTotal / 100).toFixed(2)} ${lead.currency.toUpperCase()}`
                        : ''}
                    </em>
                  </td>
                  <td>{lead.customerEmail || '—'}</td>
                  <td>
                    <span className={`${styles.chip} ${lead.livemode ? styles.due : styles.future}`}>
                      {lead.livemode ? 'Live' : 'Test'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <IconSearch />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar restaurante" />
        </label>
        <div className={styles.filters}>
          <button type="button" className={filter === 'all' ? styles.filterOn : ''} onClick={() => setFilter('all')}>Todos</button>
          <button type="button" className={filter === 'monthly' ? styles.filterOn : ''} onClick={() => setFilter('monthly')}>Mensual</button>
          <button type="button" className={filter === 'action' ? styles.filterOn : ''} onClick={() => setFilter('action')}>Pendiente</button>
        </div>
      </div>

      <div className={styles.panel}>
        {rows.length === 0 ? (
          <p className={styles.empty}>Nadie en este filtro. Los de Mesa no salen aquí.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Local</th>
                <th>Plan</th>
                <th>Fecha</th>
                <th>Cobro</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ company, plan, state, monthly }) => (
                <tr key={company.id}>
                  <td>
                    <strong>{company.name}</strong>
                    <em>{company.municipality || company.location}</em>
                  </td>
                  <td>
                    {plan?.name}
                    <em>{formatCompanyPlanBilling(company.planBilling)}</em>
                  </td>
                  <td>
                    {company.planStartedAt ? formatCompanyPlanStartedAt(company.planStartedAt) : 'Sin fecha'}
                    {monthly && company.planStartedAt ? (
                      <em>Siguiente: {formatCompanyPlanStartedAt(nextMonthlyChargeDate(company.planStartedAt))}</em>
                    ) : null}
                  </td>
                  <td>
                    {state ? (
                      <span className={`${styles.chip} ${stateClass(state)}`}>{monthlyChargeLabel(state)}</span>
                    ) : (
                      <span className={`${styles.chip} ${styles.paid}`}>Sin renovación</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.ghost} onClick={() => onOpenCompany(company.id)}>
                        Ficha
                      </button>
                      {monthly && state !== 'paid' && state !== 'future' ? (
                        <button
                          type="button"
                          className={styles.primary}
                          disabled={isSaving}
                          onClick={() => void onMarkPaid(company)}
                        >
                          Marcar cobrado
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AdminPlansBoard
