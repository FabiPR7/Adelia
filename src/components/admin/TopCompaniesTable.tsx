import styles from './TopCompaniesTable.module.css'

interface TopCompany {
  companyId: string
  companyName: string
  totalRevenue: number
  totalReservations: number
  averageValue: number
}

interface TopCompaniesTableProps {
  companies: TopCompany[]
  isLoading?: boolean
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export default function TopCompaniesTable({ companies, isLoading }: TopCompaniesTableProps) {
  if (isLoading) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Top Empresas por Revenue</h3>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Top Empresas por Revenue</h3>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🏢</span>
          <p>No hay datos disponibles</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Top Empresas por Revenue</h3>
      
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.rank}>#</th>
              <th className={styles.company}>Empresa</th>
              <th className={styles.revenue}>Revenue</th>
              <th className={styles.reservations}>Reservas</th>
              <th className={styles.average}>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company, index) => (
              <tr key={company.companyId} className={styles.row}>
                <td className={styles.rank}>
                  <span className={`${styles.medal} ${index < 3 ? styles[`rank${index + 1}`] : ''}`}>
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                  </span>
                </td>
                <td className={styles.company}>
                  <span className={styles.companyName}>{company.companyName}</span>
                </td>
                <td className={styles.revenue}>
                  <span className={styles.revenueAmount}>
                    {formatCurrency(company.totalRevenue)}
                  </span>
                </td>
                <td className={styles.reservations}>
                  <span className={styles.count}>{company.totalReservations}</span>
                </td>
                <td className={styles.average}>
                  <span className={styles.avgAmount}>
                    {formatCurrency(company.averageValue)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
