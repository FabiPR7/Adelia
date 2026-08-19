import { useState } from 'react'
import styles from './AdminGeographicBarChart.module.css'

interface AdminGeographicBarChartProps {
  title: string
  data: Array<{ country: string; count: number }>
  color?: string
  maxBars?: number
}

const WIDTH = 700
const HEIGHT_PER_BAR = 40
const PADDING = { top: 20, right: 60, bottom: 20, left: 150 }

function AdminGeographicBarChart({ 
  title, 
  data, 
  color = '#2e7d6b',
  maxBars = 10
}: AdminGeographicBarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)
  const displayData = data.slice(0, maxBars)
  const HEIGHT = Math.max(200, PADDING.top + PADDING.bottom + displayData.length * HEIGHT_PER_BAR)
  
  const plotWidth = WIDTH - PADDING.left - PADDING.right

  const maxValue = Math.max(1, ...displayData.map(d => d.count))
  const hasData = displayData.length > 0

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{title}</h3>
      
      {!hasData ? (
        <div className={styles.empty}>Sin datos disponibles</div>
      ) : (
        <svg
          className={styles.plot}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id={`bar-grad-${title}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {displayData.map((item, index) => {
            const y = PADDING.top + index * HEIGHT_PER_BAR
            const barWidth = (item.count / maxValue) * plotWidth
            const barHeight = HEIGHT_PER_BAR - 12

            return (
              <g key={item.country}>
                {/* Country label */}
                <text
                  x={PADDING.left - 12}
                  y={y + barHeight / 2 + 4}
                  textAnchor="end"
                  fontSize="13"
                  fill="#2e1f14"
                  fontWeight="500"
                >
                  {item.country}
                </text>

                {/* Bar background */}
                <rect
                  x={PADDING.left}
                  y={y}
                  width={plotWidth}
                  height={barHeight}
                  fill="rgba(107, 83, 68, 0.05)"
                  rx="4"
                />

                {/* Bar */}
                <rect
                  x={PADDING.left}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={hoveredBar === item.country ? color : `url(#bar-grad-${title})`}
                  rx="4"
                  style={{ cursor: 'pointer', transition: 'fill 0.2s' }}
                  onMouseEnter={() => setHoveredBar(item.country)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <animate
                    attributeName="width"
                    from="0"
                    to={barWidth}
                    dur="0.8s"
                    fill="freeze"
                  />
                </rect>

                {/* Count label */}
                <text
                  x={PADDING.left + barWidth + 8}
                  y={y + barHeight / 2 + 4}
                  textAnchor="start"
                  fontSize="12"
                  fill="#6b5344"
                  fontWeight="600"
                >
                  {item.count}
                </text>
              </g>
            )
          })}
        </svg>
      )}

      {data.length > maxBars && (
        <div className={styles.footnote}>
          Mostrando top {maxBars} de {data.length} países
        </div>
      )}
    </div>
  )
}

export default AdminGeographicBarChart
