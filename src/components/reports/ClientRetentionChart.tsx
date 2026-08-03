import type { RetentionChartData } from '../../utils/clientReports'
import shared from './reportCharts.module.css'
import styles from './ClientRetentionChart.module.css'

interface ClientRetentionChartProps {
  data: RetentionChartData
}

const WIDTH = 640
const HEIGHT = 180
const PADDING = { top: 12, right: 12, bottom: 36, left: 12 }

function ClientRetentionChart({ data }: ClientRetentionChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const hasData = data.acquired.some((value) => value > 0) || data.returnedNextMonth.some((value) => value > 0)
  const maxValue = Math.max(1, ...data.acquired, ...data.returnedNextMonth)
  const groupCount = data.labels.length
  const groupGap = groupCount > 4 ? 8 : 14
  const groupWidth = (plotWidth - groupGap * (groupCount - 1)) / Math.max(groupCount, 1)
  const barGap = 4
  const barWidth = (groupWidth - barGap) / 2

  return (
    <div className={shared.chartBody}>
      <div className={shared.legend} aria-hidden="true">
        <span className={shared.legendItem}>
          <span className={shared.legendSwatch} style={{ background: '#2e7d6b' }} />
          Captados
        </span>
        <span className={shared.legendItem}>
          <span className={shared.legendSwatch} style={{ background: '#6b5344' }} />
          Volvieron al mes siguiente
        </span>
      </div>

      {!hasData ? (
        <div className={shared.empty}>Sin datos de retención en este periodo</div>
      ) : (
        <svg
          className={`${shared.plot} ${styles.plot}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Retención de clientes mes a mes"
        >
          {data.labels.map((label, index) => {
            const groupX = PADDING.left + index * (groupWidth + groupGap)
            const acquired = data.acquired[index]
            const returned = data.returnedNextMonth[index]
            const acquiredHeight = (acquired / maxValue) * plotHeight
            const returnedHeight = (returned / maxValue) * plotHeight
            const baseY = PADDING.top + plotHeight

            return (
              <g key={label}>
                <rect
                  x={groupX}
                  y={baseY - acquiredHeight}
                  width={barWidth}
                  height={Math.max(acquiredHeight, acquired > 0 ? 4 : 0)}
                  rx={5}
                  fill="#2e7d6b"
                  className={styles.bar}
                />
                <rect
                  x={groupX + barWidth + barGap}
                  y={baseY - returnedHeight}
                  width={barWidth}
                  height={Math.max(returnedHeight, returned > 0 ? 4 : 0)}
                  rx={5}
                  fill="#6b5344"
                  className={styles.bar}
                />
                {acquired > 0 && (
                  <text
                    x={groupX + barWidth / 2}
                    y={baseY - acquiredHeight - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#2e7d6b"
                  >
                    {acquired}
                  </text>
                )}
                {returned > 0 && (
                  <text
                    x={groupX + barWidth + barGap + barWidth / 2}
                    y={baseY - returnedHeight - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#6b5344"
                  >
                    {returned}
                  </text>
                )}
                <text
                  x={groupX + groupWidth / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize={groupCount > 6 ? 8 : 9}
                  fill="#8a7a6e"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export default ClientRetentionChart
