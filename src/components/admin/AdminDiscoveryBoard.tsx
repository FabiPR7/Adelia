import { useMemo, useState } from 'react'
import type { AdminCompany } from '../../types'
import { getCompanyPlan, parseCompanyPlanId } from '../../data/companyPlans'
import { companyHealthScore, companyProfileHealth } from '../../utils/companyHealth'
import { IconSearch } from './AdminIcons'
import styles from './AdminOpsBoard.module.css'

interface AdminDiscoveryBoardProps {
  companies: AdminCompany[]
  isSaving: boolean
  onOpenCompany: (companyId: string) => void
  onToggleFeatured: (company: AdminCompany) => Promise<void>
}

function AdminDiscoveryBoard({
  companies,
  isSaving,
  onOpenCompany,
  onToggleFeatured,
}: AdminDiscoveryBoardProps) {
  const [query, setQuery] = useState('')
  const [incompleteOnly, setIncompleteOnly] = useState(false)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return companies
      .map((company) => {
        const items = companyProfileHealth(company)
        return { company, score: companyHealthScore(items), items }
      })
      .filter((row) => {
        if (incompleteOnly && row.score >= 70) return false
        if (!needle) return true
        return [row.company.name, row.company.municipality, row.company.location]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((left, right) => {
        if (left.company.discoveryFeatured !== right.company.discoveryFeatured) {
          return left.company.discoveryFeatured ? -1 : 1
        }
        return left.score - right.score
      })
  }, [companies, incompleteOnly, query])

  const featuredCount = companies.filter((company) => company.discoveryFeatured).length

  return (
    <div className={styles.wrap}>
      <div className={styles.kpis}>
        <article>
          <strong>{featuredCount}</strong>
          <span>Destacados</span>
        </article>
        <article>
          <strong>{companies.filter((company) => companyHealthScore(companyProfileHealth(company)) < 70).length}</strong>
          <span>Ficha floja</span>
        </article>
        <article>
          <strong>{companies.filter((company) => (company.photos?.length ?? 0) === 0).length}</strong>
          <span>Sin fotos</span>
        </article>
        <article>
          <strong>{companies.filter((company) => parseCompanyPlanId(company.planId) === 'premium').length}</strong>
          <span>Local</span>
        </article>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <IconSearch />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar local" />
        </label>
        <div className={styles.filters}>
          <button type="button" className={!incompleteOnly ? styles.filterOn : ''} onClick={() => setIncompleteOnly(false)}>Todos</button>
          <button type="button" className={incompleteOnly ? styles.filterOn : ''} onClick={() => setIncompleteOnly(true)}>Incompletos</button>
        </div>
      </div>

      <div className={styles.panel}>
        {rows.length === 0 ? (
          <p className={styles.empty}>Nadie coincide.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Local</th>
                <th>Plan</th>
                <th>Ficha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ company, score }) => {
                const plan = getCompanyPlan(parseCompanyPlanId(company.planId))
                return (
                  <tr key={company.id}>
                    <td>
                      <strong>{company.name}</strong>
                      <em>{company.municipality || company.location || 'Sin ubicación'}</em>
                    </td>
                    <td>
                      {plan?.name}
                      {company.discoveryFeatured ? <em>Destacado</em> : null}
                    </td>
                    <td>{score}%</td>
                    <td>
                      <div className={styles.actions}>
                        <button type="button" className={styles.ghost} onClick={() => onOpenCompany(company.id)}>
                          Ficha
                        </button>
                        <button
                          type="button"
                          className={company.discoveryFeatured ? styles.primary : styles.ghost}
                          disabled={isSaving}
                          onClick={() => void onToggleFeatured(company)}
                        >
                          {company.discoveryFeatured ? 'Quitar destaco' : 'Destacar'}
                        </button>
                      </div>
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

export default AdminDiscoveryBoard
