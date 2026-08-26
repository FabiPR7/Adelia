export interface LadderMapNodePosition {
  x: number
  y: number
}

/** Margen lógico del viewBox para tarjetas centradas (escala ~0.72, ~11rem). */
const MAP_NODE_EDGE_MARGIN_RATIO = 0.18
const MAP_NODE_X_LEFT = 28
const MAP_NODE_X_RIGHT = 72

/** Altura lógica del viewBox: crece con cada hito para separar tarjetas. */
export function getLadderMapViewBoxHeight(count: number): number {
  if (count <= 0) {
    return 100
  }

  if (count === 1) {
    return 100
  }

  return 36 + count * 42
}

/** Altura del lienzo en px — mapa grande, casi pantalla completa. */
export function getLadderMapCanvasHeight(count: number): number {
  if (count <= 0) {
    return 0
  }

  if (count === 1) {
    return 380
  }

  if (count === 2) {
    return 560
  }

  return 220 + count * 210
}

export function buildLadderMapNodePositions(count: number): LadderMapNodePosition[] {
  if (count <= 0) {
    return []
  }

  const viewHeight = getLadderMapViewBoxHeight(count)

  if (count === 1) {
    return [{ x: 50, y: viewHeight / 2 }]
  }

  const edgePadding = viewHeight * MAP_NODE_EDGE_MARGIN_RATIO
  const verticalSpan = viewHeight - edgePadding * 2

  return Array.from({ length: count }, (_, index) => ({
    x: index % 2 === 0 ? MAP_NODE_X_LEFT : MAP_NODE_X_RIGHT,
    y: edgePadding + (index / (count - 1)) * verticalSpan,
  }))
}

function roundMap(value: number): number {
  return Math.round(value * 100) / 100
}

/** Sendero curvo tipo mapa del tesoro. */
export function buildLadderMapPath(positions: LadderMapNodePosition[]): string {
  if (positions.length < 2) {
    return ''
  }

  const first = positions[0]
  let path = `M ${roundMap(first.x)} ${roundMap(first.y)}`

  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1]
    const current = positions[index]
    const dx = current.x - previous.x
    const dy = current.y - previous.y
    const bulge = (index % 2 === 0 ? -1 : 1) * Math.min(16, Math.abs(dx) * 0.32)

    const c1x = previous.x + dx * 0.18 + bulge
    const c1y = previous.y + dy * 0.34
    const c2x = current.x - dx * 0.18 + bulge
    const c2y = current.y - dy * 0.34

    path += ` C ${roundMap(c1x)} ${roundMap(c1y)}, ${roundMap(c2x)} ${roundMap(c2y)}, ${roundMap(current.x)} ${roundMap(current.y)}`
  }

  return path
}

/** Cruces a mitad de tramo, entre premios. */
export function buildLadderMapTrailMarks(positions: LadderMapNodePosition[]): LadderMapNodePosition[] {
  if (positions.length < 2) {
    return []
  }

  return positions.slice(1).map((current, index) => {
    const previous = positions[index]
    return {
      x: previous.x + (current.x - previous.x) * 0.5,
      y: previous.y + (current.y - previous.y) * 0.5,
    }
  })
}

/** Posiciones de decoraciones del mapa (brújula, cofre). */
export function buildLadderMapDecorations(count: number): {
  compass: { x: number; y: number }
  start: { x: number; y: number }
  finish: { x: number; y: number }
} {
  const positions = buildLadderMapNodePositions(count)
  const viewHeight = getLadderMapViewBoxHeight(count)
  const first = positions[0] ?? { x: 50, y: viewHeight * 0.12 }
  const last = positions[positions.length - 1] ?? { x: 50, y: viewHeight * 0.88 }

  return {
    compass: { x: 88, y: 11 },
    start: { x: first.x, y: Math.max(4, first.y - 8) },
    finish: { x: last.x, y: Math.min(viewHeight - 4, last.y + 8) },
  }
}

export function toMapPercentY(y: number, count: number): number {
  const viewHeight = getLadderMapViewBoxHeight(count)
  if (viewHeight <= 0) {
    return y
  }

  return (y / viewHeight) * 100
}
