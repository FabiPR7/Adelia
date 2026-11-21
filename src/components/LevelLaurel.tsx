/**
 * Corona de laurel alrededor de la foto (como en las tarjetas de nivel): dos ramas
 * de hojas en arco, del color del nivel. Se dibuja en SVG para que escale nítida.
 */
function leaves(side: -1 | 1, count: number, radius: number): string[] {
  const shapes: string[] = []
  for (let index = 0; index < count; index += 1) {
    // De abajo (110°) hacia arriba (-10°) por cada lado.
    const t = index / (count - 1)
    const angle = ((110 - t * 120) * Math.PI) / 180
    const x = 50 + side * radius * Math.cos(angle)
    const y = 50 + radius * Math.sin(angle)
    const rotate = side === 1 ? 90 - (110 - t * 120) + 35 : -(90 - (110 - t * 120)) - 35
    shapes.push(`${x.toFixed(2)},${y.toFixed(2)},${rotate.toFixed(1)}`)
  }
  return shapes
}

function LevelLaurel({ color, className }: { color: string; className?: string }) {
  const radius = 46
  const left = leaves(-1, 8, radius)
  const right = leaves(1, 8, radius)
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {[...left, ...right].map((leaf, index) => {
        const [x, y, rotate] = leaf.split(',').map(Number)
        return (
          <ellipse
            key={index}
            cx={x}
            cy={y}
            rx="3.2"
            ry="7"
            fill={color}
            stroke="rgba(0, 0, 0, 0.25)"
            strokeWidth="0.5"
            transform={`rotate(${rotate} ${x} ${y})`}
          />
        )
      })}
    </svg>
  )
}

export default LevelLaurel
