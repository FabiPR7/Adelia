import type { WeekdayChartData } from '../../utils/reservationReports'
import shared from './reportCharts.module.css'
import styles from './ReservationWeekdayChart.module.css'

interface ReservationWeekdayChartProps {
  data: WeekdayChartData
}

const WIDTH = 360
const HEIGHT = 180
const PADDING = { top: 12, right: 8, bottom: 28, left: 8 }

function ReservationWeekdayChart({ data }: ReservationWeekdayChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const hasData = data.values.some((value) => value > 0)
  const barGap = 10
  const barWidth = (plotWidth - barGap * (data.labels.length - 1)) / data.labels.length

  return (
    <div className={shared.chartBody}>
      {!hasData ? (
        <div className={shared.empty}>Sin reservas en este periodo</div>
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
                  rx={6}
                  fill={isPeak ? '#6b5344' : 'rgba(107, 83, 68, 0.55)'}
                  className={styles.bar}
                />
                {value > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="#6b5344"
                  >
                    {value}
                  </text>
                )}
                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#8a7a6e"
                >
                  {data.labels[index]}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export default ReservationWeekdayChart
