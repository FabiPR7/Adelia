import type { ProductSalesAggregate } from '../../utils/productReports'
import shared from './reportCharts.module.css'
import styles from './ProductTopBarChart.module.css'

interface ProductTopBarChartProps {
  products: ProductSalesAggregate[]
  metric: 'quantity' | 'revenue'
}

const WIDTH = 640
const HEIGHT = 220
const PADDING = { top: 12, right: 12, bottom: 12, left: 120 }

function ProductTopBarChart({ products, metric }: ProductTopBarChartProps) {
  const values = products.map((product) => (metric === 'quantity' ? product.quantity : product.totalCents))
  const maxValue = Math.max(1, ...values)
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const barGap = 8
  const barHeight = products.length > 0
    ? (plotHeight - barGap * (products.length - 1)) / products.length
    : 0
  const hasData = values.some((value) => value > 0)

  return (
    <div className={shared.chartBody}>
      {!hasData ? (
        <div className={shared.empty}>Sin productos verificados en este periodo</div>
      ) : (
        <svg
          className={`${shared.plot} ${styles.plot}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Productos más vendidos en verificaciones"
        >
          {products.map((product, index) => {
            const value = metric === 'quantity' ? product.quantity : product.totalCents
            const barWidth = (value / maxValue) * plotWidth
            const y = PADDING.top + index * (barHeight + barGap)
            const isTop = index === 0 && value > 0
            const label = product.name.length > 16 ? `${product.name.slice(0, 15)}…` : product.name

            return (
              <g key={product.nodeId}>
                <text
                  x={PADDING.left - 8}
                  y={y + barHeight / 2 + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#6b5344"
                >
                  {label}
                </text>
                <rect
                  x={PADDING.left}
                  y={y}
                  width={Math.max(barWidth, value > 0 ? 4 : 0)}
                  height={barHeight}
                  rx={6}
                  fill={isTop ? '#2e7d6b' : 'rgba(107, 83, 68, 0.55)'}
                />
                {value > 0 && (
                  <text
                    x={PADDING.left + barWidth + 6}
                    y={y + barHeight / 2 + 4}
                    fontSize="10"
                    fontWeight="600"
                    fill="#6b5344"
                  >
                    {metric === 'quantity' ? value : `${(value / 100).toFixed(2).replace('.', ',')} €`}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export default ProductTopBarChart
