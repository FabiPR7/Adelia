import type { ReactNode } from 'react'
import styles from './AdminKpiCard.module.css'

interface AdminKpiCardProps {
  title: string
  value: number
  subtitle?: string
  suffix?: string
  decimals?: number
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  icon?: ReactNode
  accent?: 'coral' | 'gold' | 'teal' | 'ink'
  sparkline?: number[]
}

function Sparkline({ values, accent }: { values: number[]; accent: string }) {
  const width = 88
  const height = 28
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values
    .map((value, index) => {
      const x = index * step
      const y = height - (value / max) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className={styles.spark} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const ACCENT_STROKE = {
  coral: '#e25a3c',
  gold: '#c49a3a',
  teal: '#2e7d6b',
  ink: '#2a211c',
}

function AdminKpiCard({
  title,
  value,
  subtitle,
  suffix,
  decimals = 0,
  trend,
  icon,
  accent = 'ink',
  sparkline,
}: AdminKpiCardProps) {
  const formatted = value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <article className={`${styles.card} ${styles[accent]}`}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
      </div>

      <div className={styles.valueRow}>
        <p className={styles.mainValue}>
          {formatted}
          {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
        </p>
        {sparkline && sparkline.length > 1 ? (
          <Sparkline values={sparkline} accent={ACCENT_STROKE[accent]} />
        ) : null}
      </div>

      {trend ? (
        <p className={`${styles.trend} ${trend.positive ? styles.trendPositive : styles.trendNegative}`}>
          <span className={styles.trendValue}>
            {trend.positive ? '▲' : '▼'} {trend.value.toLocaleString('es-ES')}
          </span>
          <span className={styles.trendLabel}>{trend.label}</span>
        </p>
      ) : null}
    </article>
  )
}

export default AdminKpiCard
