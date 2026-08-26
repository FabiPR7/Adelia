import { useId, useState } from 'react'
import styles from './AdminGrowthLineChart.module.css'

interface AdminGrowthLineChartProps {
  title: string
  subtitle?: string
  data: {
    labels: string[]
    values: number[]
  }
  color?: string
  onExport?: () => void
}

const WIDTH = 700
const HEIGHT = 240
const PADDING = { top: 18, right: 18, bottom: 38, left: 38 }

function AdminGrowthLineChart({
  title,
  subtitle,
  data,
  color = '#e25a3c',
  onExport,
}: AdminGrowthLineChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null)
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxValue = Math.max(1, ...data.values)
  const hasData = data.values.some((value) => value > 0)
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue]

  const xAt = (index: number) => {
    if (data.labels.length <= 1) {
      return PADDING.left + plotWidth / 2
    }
    return PADDING.left + (index / (data.labels.length - 1)) * plotWidth
  }
  const yAt = (value: number) => PADDING.top + plotHeight - (value / maxValue) * plotHeight
  const linePath = data.values.length
    ? `M ${data.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' L ')}`
    : ''
  const areaPath = data.values.length
    ? `M ${xAt(0)},${yAt(0)} L ${linePath.slice(2)} L ${xAt(data.values.length - 1)},${yAt(0)} Z`
    : ''

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

      {!hasData ? (
        <div className={styles.empty}>Sin movimiento en este periodo</div>
      ) : (
        <svg className={styles.plot} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => {
            const y = yAt(tick)
            return (
              <g key={tick}>
                <line x1={PADDING.left} y1={y} x2={WIDTH - PADDING.right} y2={y} stroke="rgba(28,20,15,0.08)" />
                <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#8a7a6e">
                  {tick}
                </text>
              </g>
            )
          })}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
          {data.values.map((value, index) => (
            <g key={`${data.labels[index]}-${index}`}>
              <circle cx={xAt(index)} cy={yAt(value)} r="4" fill={color} stroke="#fffdf9" strokeWidth="2" />
              <circle
                cx={xAt(index)}
                cy={yAt(value)}
                r="14"
                fill="transparent"
                onMouseEnter={() => setTooltip({ x: xAt(index), y: yAt(value), label: data.labels[index], value })}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          ))}
          {data.labels.map((label, index) => {
            const skip = data.labels.length > 14 && index % Math.ceil(data.labels.length / 8) !== 0
            if (skip) {
              return null
            }
            return (
              <text key={`${label}-${index}`} x={xAt(index)} y={HEIGHT - 14} textAnchor="middle" fontSize="10" fill="#8a7a6e">
                {label}
              </text>
            )
          })}
        </svg>
      )}

      {tooltip ? (
        <div
          className={styles.tooltip}
          style={{ left: `${(tooltip.x / WIDTH) * 100}%`, top: `${(tooltip.y / HEIGHT) * 100}%` }}
        >
          <div className={styles.tooltipLabel}>{tooltip.label}</div>
          <div className={styles.tooltipValue}>{tooltip.value}</div>
        </div>
      ) : null}
    </section>
  )
}

export default AdminGrowthLineChart
