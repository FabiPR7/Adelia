import type { ProductTrendChartData } from '../../utils/productReports'
import shared from './reportCharts.module.css'
import styles from './ProductRevenueTrendChart.module.css'

interface ProductRevenueTrendChartProps {
  data: ProductTrendChartData
}

const WIDTH = 640
const HEIGHT = 180
const PADDING = { top: 14, right: 12, bottom: 28, left: 40 }

function buildLinePath(
  values: number[],
  maxValue: number,
  plotWidth: number,
  plotHeight: number,
): string {
  if (values.length === 0) {
    return ''
  }

  const xAt = (index: number) => {
    if (values.length === 1) {
      return PADDING.left + plotWidth / 2
    }
    return PADDING.left + (index / (values.length - 1)) * plotWidth
  }

  const yAt = (value: number) => PADDING.top + plotHeight - (value / maxValue) * plotHeight

  return values
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(value)}`)
    .join(' ')
}

function ProductRevenueTrendChart({ data }: ProductRevenueTrendChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxRevenue = Math.max(1, ...data.revenueCents)
  const maxUnits = Math.max(1, ...data.unitsSold)
  const hasData = data.revenueCents.some((value) => value > 0) || data.unitsSold.some((value) => value > 0)
  const revenueTicks = [0, Math.ceil(maxRevenue / 2), maxRevenue]

  return (
    <div className={shared.chartBody}>
      <div className={shared.legend} aria-hidden="true">
        <span className={shared.legendItem}>
          <span className={shared.legendSwatch} style={{ background: '#2e7d6b' }} />
          Ingresos verificados
        </span>
        <span className={shared.legendItem}>
          <span className={shared.legendSwatch} style={{ background: '#8b6914' }} />
          Unidades vendidas
        </span>
      </div>

      {!hasData ? (
        <div className={shared.empty}>Sin consumo verificado en este periodo</div>
      ) : (
        <svg
          className={`${shared.plot} ${styles.plot}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Tendencia de ingresos y unidades por productos verificados"
        >
          {revenueTicks.map((tick) => {
            const y = PADDING.top + plotHeight - (tick / maxRevenue) * plotHeight
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
                  {(tick / 100).toFixed(0)} €
                </text>
              </g>
            )
          })}

          <path
            d={buildLinePath(data.revenueCents, maxRevenue, plotWidth, plotHeight)}
            fill="none"
            stroke="#2e7d6b"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          <path
            d={buildLinePath(data.unitsSold, maxUnits, plotWidth, plotHeight)}
            fill="none"
            stroke="#8b6914"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinejoin="round"
          />

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

export default ProductRevenueTrendChart
