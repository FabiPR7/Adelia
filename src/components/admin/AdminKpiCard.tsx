import styles from './AdminKpiCard.module.css'

interface AdminKpiCardProps {
  title: string
  value: number
  subtitle?: string
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  icon?: string
}

function AdminKpiCard({ title, value, subtitle, trend, icon }: AdminKpiCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <h3 className={styles.title}>{title}</h3>
        </div>
      </div>
      
      <div className={styles.body}>
        <div className={styles.mainValue}>{value.toLocaleString('es-ES')}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        
        {trend && (
          <div className={`${styles.trend} ${trend.positive ? styles.trendPositive : styles.trendNegative}`}>
            <span className={styles.trendValue}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </span>
            <span className={styles.trendLabel}>{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminKpiCard
