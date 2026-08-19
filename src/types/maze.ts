export type MazePhase = 'playing' | 'done'
export type MazeDirection = 'up' | 'down' | 'left' | 'right'

export interface MazePublicState {
  phase: MazePhase
  size: number
  seed: number
  walls: number[]
  myX: number
  myY: number
  rivalX: number
  rivalY: number
  myMoves: number
  rivalMoves: number
  goalX: number
  goalY: number
  startX: number
  startY: number
  rivalStartX: number
  rivalStartY: number
  startAt: string | null
  canMove: boolean
  iWon: boolean | null
  winnerUid: string | null
  prompt: string
}

export const MAZE_DIRECTIONS: MazeDirection[] = ['up', 'down', 'left', 'right']

export const MAZE_WALL_N = 1
export const MAZE_WALL_E = 2
export const MAZE_WALL_S = 4
export const MAZE_WALL_W = 8

const DELTA: Record<MazeDirection, { dx: number; dy: number; wall: number }> = {
  up: { dx: 0, dy: -1, wall: MAZE_WALL_N },
  right: { dx: 1, dy: 0, wall: MAZE_WALL_E },
  down: { dx: 0, dy: 1, wall: MAZE_WALL_S },
  left: { dx: -1, dy: 0, wall: MAZE_WALL_W },
}

export function isMazeDirection(value: unknown): value is MazeDirection {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right'
}

export function mazeCellIndex(x: number, y: number, size: number) {
  return y * size + x
}

export function mazeCanMove(
  walls: number[],
  size: number,
  x: number,
  y: number,
  direction: MazeDirection,
): boolean {
  const delta = DELTA[direction]
  const bits = walls[mazeCellIndex(x, y, size)] ?? 15
  if ((bits & delta.wall) !== 0) {
    return false
  }
  const nx = x + delta.dx
  const ny = y + delta.dy
  return nx >= 0 && ny >= 0 && nx < size && ny < size
}

export function mazeStep(x: number, y: number, direction: MazeDirection) {
  const delta = DELTA[direction]
  return { x: x + delta.dx, y: y + delta.dy }
}

export function mazeCellWalls(bits: number) {
  return {
    north: (bits & MAZE_WALL_N) !== 0,
    east: (bits & MAZE_WALL_E) !== 0,
    south: (bits & MAZE_WALL_S) !== 0,
    west: (bits & MAZE_WALL_W) !== 0,
  }
}

export function mazeCountdownLabel(startAt: string | null | undefined, now: number): string | null {
  if (!startAt) {
    return null
  }
  const remain = Date.parse(startAt) - now
  if (!Number.isFinite(remain)) {
    return null
  }
  if (remain > 0) {
    return String(Math.max(1, Math.ceil(remain / 1000)))
  }
  if (remain > -480) {
    return '¡Ya!'
  }
  return null
}

export function mazeRaceOpen(startAt: string | null | undefined, now: number): boolean {
  if (!startAt) {
    return true
  }
  const at = Date.parse(startAt)
  return Number.isFinite(at) && now >= at
}
