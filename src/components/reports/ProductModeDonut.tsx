import shared from './reportCharts.module.css'
import styles from './ProductModeDonut.module.css'

interface ProductModeDonutProps {
  withProducts: number
  totalOnly: number
}

const SLICES = [
  { key: 'withProducts' as const, label: 'Detalle por productos', color: '#2e7d6b' },
  { key: 'totalOnly' as const, label: 'Solo importe total', color: '#8b6914' },
]

function describeArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const startOuter = {
    x: cx + outerR * Math.cos(startAngle),
    y: cy + outerR * Math.sin(startAngle),
  }
  const endOuter = {
    x: cx + outerR * Math.cos(endAngle),
    y: cy + outerR * Math.sin(endAngle),
  }
  const startInner = {
    x: cx + innerR * Math.cos(endAngle),
    y: cy + innerR * Math.sin(endAngle),
  }
  const endInner = {
    x: cx + innerR * Math.cos(startAngle),
    y: cy + innerR * Math.sin(startAngle),
  }
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

function ProductModeDonut({ withProducts, totalOnly }: ProductModeDonutProps) {
  const total = withProducts + totalOnly
  const cx = 90
  const cy = 90
  const outerR = 72
  const innerR = 48

  if (total === 0) {
    return <div className={shared.empty}>Sin verificaciones en este periodo</div>
  }

  const values = { withProducts, totalOnly }
  let angle = -Math.PI / 2

  const arcs = SLICES.map((slice) => {
    const value = values[slice.key]
    const sliceAngle = (value / total) * Math.PI * 2
    const startAngle = angle
    const endAngle = angle + sliceAngle
    angle = endAngle

    return {
      ...slice,
      value,
      percent: Math.round((value / total) * 100),
      path: value > 0
        ? describeArc(cx, cy, outerR, innerR, startAngle, endAngle - 0.001)
        : '',
    }
  })

  return (
    <div className={styles.wrap}>
      <svg className={styles.donut} viewBox="0 0 180 180" role="img" aria-label="Modo de verificación de consumo">
        {arcs.map((arc) => (
          arc.path ? (
            <path
              key={arc.key}
              d={arc.path}
              fill={arc.color}
              stroke="#fff"
              strokeWidth="2"
            />
          ) : null
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="600" fill="#6b5344">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#8a7a6e">
          verificaciones
        </text>
      </svg>

      <ul className={styles.legend}>
        {arcs.map((arc) => (
          <li key={arc.key}>
            <span className={styles.legendDot} style={{ background: arc.color }} />
            <span className={styles.legendLabel}>{arc.label}</span>
            <span className={styles.legendValue}>
              {arc.value}
              <em>{arc.percent}%</em>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ProductModeDonut
