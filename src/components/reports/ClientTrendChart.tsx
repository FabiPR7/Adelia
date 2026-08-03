import type { ClientTrendData } from '../../utils/clientReports'
import shared from './reportCharts.module.css'
import styles from './ClientTrendChart.module.css'

interface ClientTrendChartProps {
  data: ClientTrendData
}

const WIDTH = 640
const HEIGHT = 180
const PADDING = { top: 14, right: 12, bottom: 28, left: 32 }

const SERIES = [
  { key: 'newClients' as const, label: 'Nuevos', color: '#2e7d6b', fill: 'rgba(46, 125, 107, 0.35)' },
  { key: 'returning' as const, label: 'Recurrentes', color: '#6b5344', fill: 'rgba(107, 83, 68, 0.35)' },
]

function buildAreaPath(
  bottomValues: number[],
  topValues: number[],
  maxValue: number,
  plotWidth: number,
  plotHeight: number,
): string {
  if (bottomValues.length === 0) {
    return ''
  }

  const xAt = (index: number) => {
    if (bottomValues.length === 1) {
      return PADDING.left + plotWidth / 2
    }
    return PADDING.left + (index / (bottomValues.length - 1)) * plotWidth
  }

  const yAt = (value: number) => PADDING.top + plotHeight - (value / maxValue) * plotHeight

  const topPoints = topValues.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' L ')
  const bottomPoints = bottomValues
    .map((value, index) => `${xAt(bottomValues.length - 1 - index)},${yAt(value)}`)
    .join(' L ')

  return `M ${xAt(0)},${yAt(topValues[0])} L ${topPoints} L ${bottomPoints} Z`
}

function ClientTrendChart({ data }: ClientTrendChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const stackedReturning = data.newClients.map(
    (value, index) => value + data.returning[index],
  )
  const maxValue = Math.max(1, ...stackedReturning)
  const hasData = data.newClients.some((value) => value > 0) || data.returning.some((value) => value > 0)
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue]

  const stacks = [
    { bottom: data.newClients.map(() => 0), top: data.newClients, ...SERIES[0] },
    { bottom: data.newClients, top: stackedReturning, ...SERIES[1] },
  ]

  return (
    <div className={shared.chartBody}>
      <div className={shared.legend} aria-hidden="true">
        {SERIES.map((series) => (
          <span key={series.key} className={shared.legendItem}>
            <span className={shared.legendSwatch} style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>

      {!hasData ? (
        <div className={shared.empty}>Sin actividad de clientes en este periodo</div>
      ) : (
        <svg
          className={`${shared.plot} ${styles.plot}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Clientes nuevos y recurrentes por periodo"
        >
          <defs>
            {SERIES.map((series) => (
              <linearGradient key={series.key} id={`client-grad-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.color} stopOpacity="0.45" />
                <stop offset="100%" stopColor={series.color} stopOpacity="0.08" />
              </linearGradient>
            ))}
          </defs>

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
                />
                <text x={PADDING.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#8a7a6e">
                  {tick}
                </text>
              </g>
            )
          })}

          {stacks.map((stack) => (
            <path
              key={stack.key}
              d={buildAreaPath(stack.bottom, stack.top, maxValue, plotWidth, plotHeight)}
              fill={`url(#client-grad-${stack.key})`}
              stroke={stack.color}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ))}

          {data.labels.map((label, index) => {
            if (data.labels.length > 16 && index % 2 !== 0) {
              return null
            }

            const x = data.labels.length === 1
              ? PADDING.left + plotWidth / 2
              : PADDING.left + (index / (data.labels.length - 1)) * plotWidth

            return (
              <text
                key={`${label}-${index}`}
                x={x}
                y={HEIGHT - 8}
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

export default ClientTrendChart
