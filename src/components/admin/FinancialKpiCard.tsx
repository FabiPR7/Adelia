import styles from './FinancialKpiCard.module.css'

interface FinancialKpiCardProps {
  title: string
  value: string | number
  trend?: {
    value: number
    isPositive: boolean
  }
  icon?: string
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
  subtitle?: string
}

export default function FinancialKpiCard({
  title,
  value,
  trend,
  icon = '💰',
  color = 'blue',
  subtitle
}: FinancialKpiCardProps) {
  return (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <h3 className={styles.title}>{title}</h3>
      </div>
      
      <div className={styles.value}>{value}</div>
      
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      
      {trend && (
        <div className={`${styles.trend} ${trend.isPositive ? styles.trendUp : styles.trendDown}`}>
          <span className={styles.trendIcon}>{trend.isPositive ? '↗' : '↘'}</span>
          <span className={styles.trendValue}>{Math.abs(trend.value).toFixed(1)}%</span>
          <span className={styles.trendLabel}>vs mes anterior</span>
        </div>
      )}
    </div>
  )
}
