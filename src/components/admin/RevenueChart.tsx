import { useMemo } from 'react'
import styles from './RevenueChart.module.css'

interface RevenueChartProps {
  labels: string[]
  revenue: number[]
  deposits: number[]
  refunds: number[]
}

export default function RevenueChart({ labels, revenue, deposits, refunds }: RevenueChartProps) {
  const maxValue = useMemo(() => {
    const allValues = [...revenue, ...deposits, ...refunds]
    return Math.max(...allValues, 100)
  }, [revenue, deposits, refunds])

  if (labels.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>📊</span>
        <p>No hay datos de revenue disponibles</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Revenue por Día</h3>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.revenue}`}></span>
            <span>Revenue Total</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.deposits}`}></span>
            <span>Fianzas</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.refunds}`}></span>
            <span>Reembolsos</span>
          </div>
        </div>
      </div>

      <div className={styles.chart}>
        <svg className={styles.svg} viewBox="0 0 800 300" preserveAspectRatio="none">
          {/* Grid lines */}
          <g className={styles.grid}>
            {[0, 1, 2, 3, 4].map((i) => {
              const y = (i * 300) / 4
              return (
                <line
                  key={i}
                  x1="0"
                  y1={y}
                  x2="800"
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
              )
            })}
          </g>

          {/* Revenue line */}
          <polyline
            className={styles.revenueLine}
            fill="none"
            stroke="url(#revenueGradient)"
            strokeWidth="3"
            points={revenue
              .map((value, i) => {
                const x = (i / (labels.length - 1)) * 800
                const y = 300 - (value / maxValue) * 280
                return `${x},${y}`
              })
              .join(' ')}
          />

          {/* Deposits line */}
          <polyline
            className={styles.depositsLine}
            fill="none"
            stroke="url(#depositsGradient)"
            strokeWidth="2"
            strokeDasharray="5,5"
            points={deposits
              .map((value, i) => {
                const x = (i / (labels.length - 1)) * 800
                const y = 300 - (value / maxValue) * 280
                return `${x},${y}`
              })
              .join(' ')}
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#667eea" />
              <stop offset="100%" stopColor="#764ba2" />
            </linearGradient>
            <linearGradient id="depositsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#11998e" />
              <stop offset="100%" stopColor="#38ef7d" />
            </linearGradient>
          </defs>
        </svg>

        {/* X-axis labels */}
        <div className={styles.xAxis}>
          {labels.map((label, i) => {
            if (i % Math.ceil(labels.length / 8) !== 0 && i !== labels.length - 1) {
              return null
            }
            return (
              <span key={i} className={styles.xLabel}>
                {label}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
