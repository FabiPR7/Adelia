import type { NamedCount } from '../../utils/adminOverview'
import styles from './AdminGeographicBarChart.module.css'

interface AdminGeographicBarChartProps {
  title: string
  subtitle?: string
  data: NamedCount[]
  color?: string
  maxBars?: number
  onExport?: () => void
}

const WIDTH = 700
const HEIGHT_PER_BAR = 38
const PADDING = { top: 8, right: 52, bottom: 8, left: 132 }

function AdminGeographicBarChart({
  title,
  subtitle,
  data,
  color = '#2e7d6b',
  maxBars = 8,
  onExport,
}: AdminGeographicBarChartProps) {
  const displayData = data.slice(0, maxBars)
  const HEIGHT = Math.max(180, PADDING.top + PADDING.bottom + displayData.length * HEIGHT_PER_BAR)
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const maxValue = Math.max(1, ...displayData.map((item) => item.count))

  return (
    <section className={styles.container}>
      <header className={styles.head}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {onExport ? (
          <button type="button" className={styles.export} onClick={onExport}>
            CSV
          </button>
        ) : null}
      </header>

      {displayData.length === 0 ? (
        <div className={styles.empty}>Sin datos todavía</div>
      ) : (
        <svg className={styles.plot} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
          {displayData.map((item, index) => {
            const y = PADDING.top + index * HEIGHT_PER_BAR
            const barWidth = (item.count / maxValue) * plotWidth
            const barHeight = HEIGHT_PER_BAR - 10
            const label = item.label.length > 18 ? `${item.label.slice(0, 17)}…` : item.label
            return (
              <g key={`${item.label}-${index}`}>
                <text x={PADDING.left - 10} y={y + barHeight / 2 + 4} textAnchor="end" fontSize="12" fill="#2a211c">
                  {label}
                </text>
                <rect x={PADDING.left} y={y} width={plotWidth} height={barHeight} fill="rgba(28,20,15,0.05)" rx="8" />
                <rect x={PADDING.left} y={y} width={Math.max(barWidth, 6)} height={barHeight} fill={color} rx="8" />
                <text x={PADDING.left + Math.max(barWidth, 6) + 8} y={y + barHeight / 2 + 4} fontSize="12" fill="#6b5344" fontWeight="700">
                  {item.count}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </section>
  )
}

export default AdminGeographicBarChart
