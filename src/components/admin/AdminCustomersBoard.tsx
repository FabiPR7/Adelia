import { useMemo, useState } from 'react'
import type { AdminCustomerRow } from '../../types/adminOps'
import { IconSearch } from './AdminIcons'
import styles from './AdminOpsBoard.module.css'

interface AdminCustomersBoardProps {
  customers: AdminCustomerRow[]
  totalCount?: number
  isLoading: boolean
  isSaving: boolean
  error: string | null
  onToggleBlocked: (customer: AdminCustomerRow) => Promise<void>
}

function AdminCustomersBoard({
  customers,
  totalCount,
  isLoading,
  isSaving,
  error,
  onToggleBlocked,
}: AdminCustomersBoardProps) {
  const [query, setQuery] = useState('')
  const [onlyBlocked, setOnlyBlocked] = useState(false)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return customers.filter((customer) => {
      if (onlyBlocked && !customer.blocked) return false
      if (!needle) return true
      return [customer.displayName, customer.email, customer.phone, customer.homeCity]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [customers, onlyBlocked, query])

  const verified = customers.filter((customer) => customer.phoneVerified).length

  return (
    <div className={styles.wrap}>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.kpis}>
        <article>
          <strong>{totalCount ?? customers.length}</strong>
          <span>Comensales</span>
        </article>
        <article>
          <strong>{verified}</strong>
          <span>Teléfono verificado</span>
        </article>
        <article>
          <strong>{customers.filter((customer) => customer.blocked).length}</strong>
          <span>Bloqueados</span>
        </article>
        <article>
          <strong>{customers.length}</strong>
          <span>En esta lista</span>
        </article>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <IconSearch />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, email o teléfono" />
        </label>
        <div className={styles.filters}>
          <button type="button" className={!onlyBlocked ? styles.filterOn : ''} onClick={() => setOnlyBlocked(false)}>Todos</button>
          <button type="button" className={onlyBlocked ? styles.filterOn : ''} onClick={() => setOnlyBlocked(true)}>Bloqueados</button>
        </div>
      </div>

      <div className={styles.panel}>
        {isLoading ? (
          <p className={styles.empty}>Cargando comensales…</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>Ningún comensal coincide.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Verificado</th>
                <th>Reservas</th>
                <th>Adelinás / XP</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <strong>{customer.displayName}</strong>
                    <em>{customer.email}{customer.phone ? ` · ${customer.phone}` : ''}</em>
                  </td>
                  <td>
                    {customer.phoneVerified ? 'Teléfono sí' : 'Teléfono no'}
                    <em>{customer.onboardingCompleted ? 'Onboarding hecho' : 'Onboarding pendiente'}</em>
                  </td>
                  <td>{customer.reservationCount}</td>
                  <td>
                    {customer.adelinas} Adelinás
                    <em>{customer.xp} XP</em>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={customer.blocked ? styles.primary : styles.danger}
                      disabled={isSaving}
                      onClick={() => void onToggleBlocked(customer)}
                    >
                      {customer.blocked ? 'Desbloquear' : 'Bloquear'}
                    </button>
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

export default AdminCustomersBoard
