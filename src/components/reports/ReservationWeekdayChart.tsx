import type { WeekdayChartData } from '../../utils/reservationReports'
import shared from './reportCharts.module.css'
import styles from './ReservationWeekdayChart.module.css'

interface ReservationWeekdayChartProps {
  data: WeekdayChartData
  emptyLabel?: string
}

const WIDTH = 360
const HEIGHT = 180
const PADDING = { top: 12, right: 8, bottom: 28, left: 8 }

function ReservationWeekdayChart({ data, emptyLabel = 'Sin reservas en este periodo' }: ReservationWeekdayChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const hasData = data.values.some((value) => value > 0)
  // Con muchas columnas (p. ej. los 30 días de un mes) se estrechan los huecos
  // y solo se rotulan algunas, para que no se amontonen los números.
  const many = data.labels.length > 12
  const barGap = many ? 2 : 10
  const labelStep = many ? Math.ceil(data.labels.length / 10) : 1
  const barWidth = (plotWidth - barGap * (data.labels.length - 1)) / data.labels.length

  return (
    <div className={shared.chartBody}>
      {!hasData ? (
        <div className={shared.empty}>{emptyLabel}</div>
      ) : (
        <svg
          className={shared.plot}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Reservas por día de la semana"
        >
          {data.values.map((value, index) => {
            const barHeight = (value / data.max) * plotHeight
            const x = PADDING.left + index * (barWidth + barGap)
            const y = PADDING.top + plotHeight - barHeight
            const isPeak = value === data.max && value > 0

            return (
              <g key={data.labels[index]}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, value > 0 ? 4 : 0)}
                  rx={Math.min(6, barWidth / 3)}
                  fill={isPeak ? '#8a3f1c' : 'rgba(138, 63, 28, 0.32)'}
                  className={styles.bar}
                />
                {value > 0 && (!many || isPeak) && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="#8a3f1c"
                  >
                    {value}
                  </text>
                )}
                {index % labelStep === 0 || index === data.labels.length - 1 ? (
                  <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a29a91"
                >
                  {data.labels[index]}
                </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export default ReservationWeekdayChart
