import type { NamedCount } from '../../utils/adminOverview'
import styles from './AdminColumnChart.module.css'

interface AdminColumnChartProps {
  title: string
  subtitle?: string
  data: NamedCount[]
  color?: string
}

function AdminColumnChart({ title, subtitle, data, color = '#e25a3c' }: AdminColumnChartProps) {
  const max = Math.max(1, ...data.map((item) => item.count))
  const hasData = data.some((item) => item.count > 0)

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {!hasData ? (
        <div className={styles.empty}>Sin reservas en este periodo</div>
      ) : (
        <div className={styles.plot}>
          {data.map((item) => (
            <div key={item.label} className={styles.col}>
              <span className={styles.value}>{item.count > 0 ? item.count : ''}</span>
              <div className={styles.track}>
                <div
                  className={styles.bar}
                  style={{ height: `${(item.count / max) * 100}%`, background: color }}
                />
              </div>
              <span className={styles.label}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default AdminColumnChart
