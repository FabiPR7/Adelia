import type { DonutSlice } from '../../utils/adminOverview'
import styles from './AdminDonutChart.module.css'

interface AdminDonutChartProps {
  title: string
  subtitle?: string
  slices: DonutSlice[]
  centerLabel?: string
  onExport?: () => void
}

function describeArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = { x: cx + outerR * Math.cos(startAngle), y: cy + outerR * Math.sin(startAngle) }
  const endOuter = { x: cx + outerR * Math.cos(endAngle), y: cy + outerR * Math.sin(endAngle) }
  const startInner = { x: cx + innerR * Math.cos(endAngle), y: cy + innerR * Math.sin(endAngle) }
  const endInner = { x: cx + innerR * Math.cos(startAngle), y: cy + innerR * Math.sin(startAngle) }
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

function AdminDonutChart({ title, subtitle, slices, centerLabel = 'total', onExport }: AdminDonutChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const cx = 90
  const cy = 90
  let angle = -Math.PI / 2
  const arcs = slices.map((slice) => {
    const sliceAngle = total === 0 ? 0 : (slice.value / total) * Math.PI * 2
    const startAngle = angle
    const endAngle = angle + Math.max(sliceAngle, 0)
    angle = endAngle
    return {
      ...slice,
      percent: total === 0 ? 0 : Math.round((slice.value / total) * 100),
      path: slice.value > 0 ? describeArc(cx, cy, 74, 48, startAngle, endAngle - 0.001) : '',
    }
  })

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {onExport ? (
          <button type="button" className={styles.export} onClick={onExport}>
            CSV
          </button>
        ) : null}
      </header>

      {total === 0 ? (
        <div className={styles.empty}>Todavía no hay datos</div>
      ) : (
        <div className={styles.body}>
          <svg className={styles.donut} viewBox="0 0 180 180" role="img" aria-label={title}>
            {arcs.map((arc) =>
              arc.path ? <path key={arc.key} d={arc.path} fill={arc.color} /> : null,
            )}
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1c140f">
              {total.toLocaleString('es-ES')}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="#8a7a6e">
              {centerLabel}
            </text>
          </svg>
          <ul className={styles.legend}>
            {arcs.map((arc) => (
              <li key={arc.key}>
                <span className={styles.dot} style={{ background: arc.color }} />
                <span className={styles.label}>{arc.label}</span>
                <strong>
                  {arc.value.toLocaleString('es-ES')}
                  <em>{arc.percent}%</em>
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default AdminDonutChart
