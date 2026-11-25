import type { TrendChartData } from '../../utils/reservationReports'
import shared from './reportCharts.module.css'
import styles from './ReservationTrendChart.module.css'

interface ReservationTrendChartProps {
  data: TrendChartData
}

const WIDTH = 640
const HEIGHT = 180
const PADDING = { top: 14, right: 12, bottom: 28, left: 32 }

const SERIES = [
  { key: 'confirmed' as const, label: 'Asistieron', color: '#5c6b3a', fill: 'rgba(92, 107, 58, 0.24)' },
  { key: 'completed' as const, label: 'Reservadas', color: '#2c241d', fill: 'rgba(44, 36, 29, 0.14)' },
  { key: 'cancelled' as const, label: 'Canceladas', color: '#b5532e', fill: 'rgba(181, 83, 46, 0.18)' },
]

export function buildAreaPath(
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
  // El borde de abajo se recorre de derecha a izquierda: x y valor del mismo día.
  // (Antes se tomaba el valor del día opuesto y cada pico salía repetido en espejo.)
  const bottomPoints = bottomValues
    .map((_value, index) => {
      const day = bottomValues.length - 1 - index
      return `${xAt(day)},${yAt(bottomValues[day])}`
    })
    .join(' L ')

  return `M ${xAt(0)},${yAt(topValues[0])} L ${topPoints} L ${bottomPoints} Z`
}

function ReservationTrendChart({ data }: ReservationTrendChartProps) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const stackedConfirmed = data.confirmed
  const stackedCompleted = data.confirmed.map((value, index) => value + data.completed[index])
  const stackedCancelled = data.confirmed.map(
    (value, index) => value + data.completed[index] + data.cancelled[index],
  )

  const maxValue = Math.max(1, ...stackedCancelled)
  const hasData = data.total.some((value) => value > 0)
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue]

  // Una capa sin datos no se dibuja: su borde pintaba encima de la de abajo
  // (picos rojos de «canceladas» con 0 canceladas).
  const stacks = [
    { bottom: data.confirmed.map(() => 0), top: stackedConfirmed, values: data.confirmed, ...SERIES[0] },
    { bottom: stackedConfirmed, top: stackedCompleted, values: data.completed, ...SERIES[1] },
    { bottom: stackedCompleted, top: stackedCancelled, values: data.cancelled, ...SERIES[2] },
  ].filter((stack) => stack.values.some((value) => value > 0))

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
        <div className={shared.empty}>Sin reservas en este periodo</div>
      ) : (
        <svg
          className={`${shared.plot} ${styles.plot}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Tendencia apilada de reservas por estado"
        >
          <defs>
            {SERIES.map((series) => (
              <linearGradient key={series.key} id={`grad-${series.key}`} x1="0" y1="0" x2="0" y2="1">
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
                  stroke="rgba(28, 25, 23, 0.07)"
                />
                <text x={PADDING.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#a29a91">
                  {tick}
                </text>
              </g>
            )
          })}

          {stacks.map((stack) => (
            <path
              key={stack.key}
              d={buildAreaPath(stack.bottom, stack.top, maxValue, plotWidth, plotHeight)}
              fill={`url(#grad-${stack.key})`}
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
                fill="#a29a91"
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

export default ReservationTrendChart
