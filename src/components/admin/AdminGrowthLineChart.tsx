import styles from './AdminGrowthLineChart.module.css'

interface AdminGrowthLineChartProps {
  title: string
  data: {
    labels: string[]
    values: number[]
  }
  color?: string
}

const WIDTH = 700
const HEIGHT = 220
const PADDING = { top: 20, right: 16, bottom: 40, left: 40 }

function AdminGrowthLineChart({ 
  title, 
  data, 
  color = '#2e7d6b'
}: AdminGrowthLineChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const maxValue = Math.max(1, ...data.values)
  const hasData = data.values.some((value) => value > 0)
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue]

  const xAt = (index: number) => {
    if (data.labels.length === 1) {
      return PADDING.left + plotWidth / 2
    }
    return PADDING.left + (index / (data.labels.length - 1)) * plotWidth
  }

  const yAt = (value: number) => PADDING.top + plotHeight - (value / maxValue) * plotHeight

  // Build line path
  const linePath = data.values.length === 0
    ? ''
    : `M ${data.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' L ')}`

  // Build area path
  const areaPath = data.values.length === 0
    ? ''
    : `M ${xAt(0)},${yAt(0)} L ${linePath.slice(2)} L ${xAt(data.values.length - 1)},${yAt(0)} Z`

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{title}</h3>
      
      {!hasData ? (
        <div className={styles.empty}>Sin datos en este periodo</div>
      ) : (
        <svg
          className={styles.plot}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = PADDING.top + plotHeight - (tick / maxValue) * plotHeight
            return (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={WIDTH - PADDING.right}
                  y2={y}
                  stroke="rgba(107, 83, 68, 0.1)"
                  strokeWidth="1"
                />
                <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#8a7a6e">
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Area fill */}
          <path
            d={areaPath}
            fill={`url(#grad-${title})`}
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Data points */}
          {data.values.map((value, index) => (
            <circle
              key={`${index}-${value}`}
              cx={xAt(index)}
              cy={yAt(value)}
              r="4"
              fill={color}
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}

          {/* X-axis labels */}
          {data.labels.map((label, index) => {
            // Skip some labels if too many
            if (data.labels.length > 20 && index % 2 !== 0) {
              return null
            }
            if (data.labels.length > 40 && index % 4 !== 0) {
              return null
            }

            const x = xAt(index)

            return (
              <text
                key={`${label}-${index}`}
                x={x}
                y={HEIGHT - 18}
                textAnchor="middle"
                fontSize="10"
                fill="#8a7a6e"
              >
                {label}
              </text>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export default AdminGrowthLineChart
