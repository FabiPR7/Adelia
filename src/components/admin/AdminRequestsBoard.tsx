import { useMemo, useState } from 'react'
import type { AdminCompany } from '../../types'
import type { PlanChangeRequest } from '../../types/adminOps'
import {
  dateToInputValue,
  getCompanyPlan,
  isAllowedMonthlyBillingDate,
  parseDateInput,
  type CompanyPlanBilling,
} from '../../data/companyPlans'
import styles from './AdminOpsBoard.module.css'

interface AdminRequestsBoardProps {
  requests: PlanChangeRequest[]
  companies: AdminCompany[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  onReject: (request: PlanChangeRequest) => Promise<void>
  onApply: (input: {
    request: PlanChangeRequest
    planBilling: CompanyPlanBilling
    planStartedOn: string
  }) => Promise<void>
}

function AdminRequestsBoard({
  requests,
  companies,
  isLoading,
  isSaving,
  error,
  onReject,
  onApply,
}: AdminRequestsBoardProps) {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [billing, setBilling] = useState<CompanyPlanBilling>('monthly')
  const [startedOn, setStartedOn] = useState(dateToInputValue(new Date()))
  const todayInput = dateToInputValue(new Date())
  const applyDate = parseDateInput(startedOn)
  const canConfirmMonthly = Boolean(applyDate && isAllowedMonthlyBillingDate(applyDate))

  const rows = useMemo(() => {
    return requests.filter((request) => filter === 'all' || request.status === 'pending')
  }, [filter, requests])

  const pending = requests.filter((request) => request.status === 'pending').length

  return (
    <div className={styles.wrap}>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.kpis}>
        <article>
          <strong>{pending}</strong>
          <span>Pendientes</span>
        </article>
        <article>
          <strong>{requests.filter((request) => request.status === 'applied').length}</strong>
          <span>Aplicadas</span>
        </article>
        <article>
          <strong>{requests.filter((request) => request.status === 'rejected').length}</strong>
          <span>Rechazadas</span>
        </article>
        <article>
          <strong>{requests.length}</strong>
          <span>Total</span>
        </article>
      </div>

      <div className={styles.filters}>
        <button type="button" className={filter === 'pending' ? styles.filterOn : ''} onClick={() => setFilter('pending')}>Bandeja</button>
        <button type="button" className={filter === 'all' ? styles.filterOn : ''} onClick={() => setFilter('all')}>Historial</button>
      </div>

      <div className={styles.panel}>
        {isLoading ? (
          <p className={styles.empty}>Cargando solicitudes…</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>No hay solicitudes {filter === 'pending' ? 'pendientes' : ''}.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Restaurante</th>
                <th>Cambio</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => {
                const toPlan = getCompanyPlan(request.toPlanId)
                const fromPlan = getCompanyPlan(request.fromPlanId)
                const company = companies.find((item) => item.id === request.companyId)
                const isApplying = applyingId === request.id
                return (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.companyName}</strong>
                      <em>{new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(request.createdAt)}</em>
                    </td>
                    <td>
                      {fromPlan.name} → {toPlan.name}
                      {toPlan.comingSoon ? <em>Lista de espera</em> : null}
                    </td>
                    <td>
                      <span className={`${styles.chip} ${request.status === 'pending' ? styles.pending : request.status === 'applied' ? styles.paid : styles.overdue}`}>
                        {request.status === 'pending' ? 'Pendiente' : request.status === 'applied' ? 'Aplicada' : 'Rechazada'}
                      </span>
                    </td>
                    <td>
                      {request.status === 'pending' && company ? (
                        <div className={styles.actions}>
                          {isApplying && toPlan.id !== 'free' ? (
                            <>
                              <label className={styles.field}>
                                Cobro
                                <select
                                  className={styles.select}
                                  value={billing}
                                  onChange={(event) => setBilling(event.target.value === 'perpetual' ? 'perpetual' : 'monthly')}
                                >
                                  <option value="monthly">Mensual</option>
                                  <option value="perpetual">Perpetua</option>
                                </select>
                              </label>
                              {billing === 'monthly' ? (
                                <label className={styles.field}>
                                  Fecha
                                  <input
                                    type="date"
                                    value={startedOn}
                                    min={todayInput}
                                    onChange={(event) => setStartedOn(event.target.value)}
                                  />
                                </label>
                              ) : null}
                              <button
                                type="button"
                                className={styles.primary}
                                disabled={isSaving || (billing === 'monthly' && !canConfirmMonthly)}
                                onClick={() => void onApply({ request, planBilling: billing, planStartedOn: startedOn })}
                              >
                                Confirmar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={styles.primary}
                              disabled={isSaving}
                              onClick={() => {
                                if (toPlan.id === 'free') {
                                  void onApply({ request, planBilling: 'monthly', planStartedOn: '' })
                                  return
                                }
                                setApplyingId(request.id)
                                setBilling('monthly')
                                setStartedOn(dateToInputValue(new Date()))
                              }}
                            >
                              Aplicar
                            </button>
                          )}
                          <button type="button" className={styles.danger} disabled={isSaving} onClick={() => void onReject(request)}>
                            Rechazar
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AdminRequestsBoard
