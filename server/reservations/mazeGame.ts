export const MAZE_SIZE = 15
export const MAZE_COUNTDOWN_MS = 5_000
export type MazePhase = 'playing' | 'done'
export type MazeDirection = 'up' | 'down' | 'left' | 'right'

const WALL_N = 1
const WALL_E = 2
const WALL_S = 4
const WALL_W = 8

const DIR: Record<MazeDirection, { dx: number; dy: number; wall: number; opposite: number }> = {
  up: { dx: 0, dy: -1, wall: WALL_N, opposite: WALL_S },
  right: { dx: 1, dy: 0, wall: WALL_E, opposite: WALL_W },
  down: { dx: 0, dy: 1, wall: WALL_S, opposite: WALL_N },
  left: { dx: -1, dy: 0, wall: WALL_W, opposite: WALL_E },
}

export interface MazeGame {
  phase: MazePhase
  size: number
  seed: number
  walls: number[]
  startX: number
  startY: number
  goalX: number
  goalY: number
  challengerUid: string
  challengedUid: string
  challengerX: number
  challengerY: number
  challengedX: number
  challengedY: number
  challengerMoves: number
  challengedMoves: number
  winnerUid: string | null
  startAt: number
}

interface MazeBuild {
  walls: number[]
  startX: number
  startY: number
  goalX: number
  goalY: number
}

export function mazeLayout(size: number) {
  return {
    size,
    startX: 0,
    startY: 0,
    goalX: size - 1,
    goalY: size - 1,
  }
}

function freshSeed() {
  const bytes = new Uint32Array(2)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    bytes[0] = Math.floor(Math.random() * 0xffffffff)
    bytes[1] = Math.floor(Math.random() * 0xffffffff)
  }
  return (bytes[0]! ^ bytes[1]! ^ Date.now() ^ (Math.floor(Math.random() * 0xffffffff))) >>> 0
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function idx(x: number, y: number, size: number) {
  return y * size + x
}

function inBounds(x: number, y: number, size: number) {
  return x >= 0 && y >= 0 && x < size && y < size
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = next[i]
    next[i] = next[j] as T
    next[j] = tmp as T
  }
  return next
}

function neighborsOf(x: number, y: number) {
  return [
    { key: 'up' as const, nx: x, ny: y - 1 },
    { key: 'right' as const, nx: x + 1, ny: y },
    { key: 'down' as const, nx: x, ny: y + 1 },
    { key: 'left' as const, nx: x - 1, ny: y },
  ]
}

function carveBetween(walls: number[], size: number, x: number, y: number, nx: number, ny: number, key: MazeDirection) {
  const here = idx(x, y, size)
  const there = idx(nx, ny, size)
  const delta = DIR[key]
  walls[here] = (walls[here] ?? 0) & ~delta.wall
  walls[there] = (walls[there] ?? 0) & ~delta.opposite
}

function closedGrid(size: number) {
  return Array.from({ length: size * size }, () => WALL_N | WALL_E | WALL_S | WALL_W)
}

function pickCell(size: number, rand: () => number) {
  return {
    x: Math.floor(rand() * size),
    y: Math.floor(rand() * size),
  }
}

function generateGrowingTree(size: number, rand: () => number, newestBias: number, river: number) {
  const walls = closedGrid(size)
  const visited = new Set<number>()
  const origin = pickCell(size, rand)
  const list: { x: number; y: number; from: MazeDirection | null }[] = [{ ...origin, from: null }]
  visited.add(idx(origin.x, origin.y, size))

  while (list.length) {
    const index = rand() < newestBias ? list.length - 1 : Math.floor(rand() * list.length)
    const cell = list[index]
    if (!cell) {
      break
    }
    const options = shuffle(neighborsOf(cell.x, cell.y), rand).filter((step) => (
      inBounds(step.nx, step.ny, size) && !visited.has(idx(step.nx, step.ny, size))
    ))
    if (!options.length) {
      list.splice(index, 1)
      continue
    }
    const continued = cell.from ? options.filter((step) => step.key === cell.from) : []
    const step = continued.length && rand() < river ? continued[0] : options[0]
    if (!step) {
      list.splice(index, 1)
      continue
    }
    carveBetween(walls, size, cell.x, cell.y, step.nx, step.ny, step.key)
    visited.add(idx(step.nx, step.ny, size))
    list.push({ x: step.nx, y: step.ny, from: step.key })
  }

  return walls
}

function generateHuntAndKill(size: number, rand: () => number) {
  const walls = closedGrid(size)
  const visited = new Set<number>()
  let current = pickCell(size, rand)
  visited.add(idx(current.x, current.y, size))

  const unvisitedNeighbors = (x: number, y: number) => shuffle(neighborsOf(x, y), rand).filter((step) => (
    inBounds(step.nx, step.ny, size) && !visited.has(idx(step.nx, step.ny, size))
  ))

  while (visited.size < size * size) {
    const walk = unvisitedNeighbors(current.x, current.y)
    if (walk.length && walk[0]) {
      const step = walk[0]
      carveBetween(walls, size, current.x, current.y, step.nx, step.ny, step.key)
      current = { x: step.nx, y: step.ny }
      visited.add(idx(current.x, current.y, size))
      continue
    }

    let hunted: { x: number; y: number; from: MazeDirection; vx: number; vy: number } | null = null
    hunt:
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (visited.has(idx(x, y, size))) {
          continue
        }
        const adjacent = shuffle(neighborsOf(x, y), rand).find((step) => (
          inBounds(step.nx, step.ny, size) && visited.has(idx(step.nx, step.ny, size))
        ))
        if (!adjacent) {
          continue
        }
        hunted = { x, y, from: adjacent.key, vx: adjacent.nx, vy: adjacent.ny }
        break hunt
      }
    }
    if (!hunted) {
      break
    }
    carveBetween(walls, size, hunted.x, hunted.y, hunted.vx, hunted.vy, hunted.from)
    current = { x: hunted.x, y: hunted.y }
    visited.add(idx(current.x, current.y, size))
  }

  return walls
}

function addWall(walls: number[], size: number, x: number, y: number, key: MazeDirection) {
  const delta = DIR[key]
  const nx = x + delta.dx
  const ny = y + delta.dy
  if (!inBounds(nx, ny, size)) {
    return
  }
  const here = idx(x, y, size)
  const there = idx(nx, ny, size)
  walls[here] = (walls[here] ?? 0) | delta.wall
  walls[there] = (walls[there] ?? 0) | delta.opposite
}

function generateRecursiveDivision(size: number, rand: () => number) {
  const walls = Array.from({ length: size * size }, () => 0)
  for (let x = 0; x < size; x += 1) {
    walls[idx(x, 0, size)] |= WALL_N
    walls[idx(x, size - 1, size)] |= WALL_S
  }
  for (let y = 0; y < size; y += 1) {
    walls[idx(0, y, size)] |= WALL_W
    walls[idx(size - 1, y, size)] |= WALL_E
  }

  const divide = (x: number, y: number, width: number, height: number) => {
    if (width < 2 || height < 2) {
      return
    }
    const splitVertical = width > height || (width === height && rand() < 0.5)
    if (splitVertical) {
      const wallX = x + 1 + Math.floor(rand() * (width - 1))
      const gapY = y + Math.floor(rand() * height)
      for (let row = y; row < y + height; row += 1) {
        if (row === gapY) {
          continue
        }
        addWall(walls, size, wallX - 1, row, 'right')
      }
      divide(x, y, wallX - x, height)
      divide(wallX, y, x + width - wallX, height)
      return
    }
    const wallY = y + 1 + Math.floor(rand() * (height - 1))
    const gapX = x + Math.floor(rand() * width)
    for (let col = x; col < x + width; col += 1) {
      if (col === gapX) {
        continue
      }
      addWall(walls, size, col, wallY - 1, 'down')
    }
    divide(x, y, width, wallY - y)
    divide(x, wallY, width, y + height - wallY)
  }

  divide(0, 0, size, size)
  return walls
}

function braidMaze(walls: number[], size: number, rand: () => number, ratio: number) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (rand() > ratio) {
        continue
      }
      const closed = (['right', 'down'] as const).filter((key) => {
        const delta = DIR[key]
        const nx = x + delta.dx
        const ny = y + delta.dy
        if (!inBounds(nx, ny, size)) {
          return false
        }
        return ((walls[idx(x, y, size)] ?? 15) & delta.wall) !== 0
      })
      const pick = closed[Math.floor(rand() * closed.length)]
      if (pick) {
        const delta = DIR[pick]
        carveBetween(walls, size, x, y, x + delta.dx, y + delta.dy, pick)
      }
    }
  }
}

function rotateBitsCW(bits: number) {
  let next = 0
  if (bits & WALL_N) next |= WALL_E
  if (bits & WALL_E) next |= WALL_S
  if (bits & WALL_S) next |= WALL_W
  if (bits & WALL_W) next |= WALL_N
  return next
}

function rotateMazeCW(walls: number[], size: number) {
  const next = Array.from({ length: size * size }, () => 0)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = size - 1 - y
      const ny = x
      next[idx(nx, ny, size)] = rotateBitsCW(walls[idx(x, y, size)] ?? 15)
    }
  }
  return next
}

function flipMazeH(walls: number[], size: number) {
  const next = Array.from({ length: size * size }, () => 0)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const bits = walls[idx(x, y, size)] ?? 15
      let flipped = bits & (WALL_N | WALL_S)
      if (bits & WALL_E) flipped |= WALL_W
      if (bits & WALL_W) flipped |= WALL_E
      next[idx(size - 1 - x, y, size)] = flipped
    }
  }
  return next
}

function pickStartAndGoal(size: number, rand: () => number) {
  const last = size - 1
  const mid = Math.floor(last / 2)
  const ports = [
    { x: 0, y: 0 },
    { x: last, y: 0 },
    { x: 0, y: last },
    { x: last, y: last },
    { x: mid, y: 0 },
    { x: mid, y: last },
    { x: 0, y: mid },
    { x: last, y: mid },
  ]
  const start = ports[Math.floor(rand() * ports.length)] ?? ports[0]!
  const far = ports.filter((port) => Math.abs(port.x - start.x) + Math.abs(port.y - start.y) >= size - 2)
  const goal = (far.length ? far[Math.floor(rand() * far.length)] : null)
    ?? { x: last - start.x, y: last - start.y }
  if (goal.x === start.x && goal.y === start.y) {
    return { startX: 0, startY: 0, goalX: last, goalY: last }
  }
  return { startX: start.x, startY: start.y, goalX: goal.x, goalY: goal.y }
}

export function generateMaze(size: number, seed: number): MazeBuild {
  const rand = mulberry32(seed)
  const variant = Math.floor(rand() * 3)
  let walls = variant === 0
    ? generateGrowingTree(size, rand, 0.52 + rand() * 0.43, 0.18 + rand() * 0.55)
    : variant === 1
      ? generateRecursiveDivision(size, rand)
      : generateHuntAndKill(size, rand)

  if (rand() < 0.42) {
    braidMaze(walls, size, rand, 0.028 + rand() * 0.04)
  }

  const turns = Math.floor(rand() * 4)
  for (let i = 0; i < turns; i += 1) {
    walls = rotateMazeCW(walls, size)
  }
  if (rand() < 0.5) {
    walls = flipMazeH(walls, size)
  }

  const ports = pickStartAndGoal(size, rand)
  return { walls, ...ports }
}

export function generateMazeWalls(size: number, seed: number): number[] {
  return generateMaze(size, seed).walls
}

function shortestPath(
  walls: number[],
  size: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const goal = idx(toX, toY, size)
  const start = idx(fromX, fromY, size)
  if (start === goal) {
    return 0
  }
  const queue = [[fromX, fromY, 0]]
  const seen = new Set([start])
  while (queue.length) {
    const current = queue.shift()
    if (!current) {
      break
    }
    const [x, y, dist] = current
    const cell = idx(x, y, size)
    if (cell === goal) {
      return dist
    }
    for (const direction of Object.keys(DIR) as MazeDirection[]) {
      const delta = DIR[direction]
      if (((walls[cell] ?? 15) & delta.wall) !== 0) {
        continue
      }
      const nx = x + delta.dx
      const ny = y + delta.dy
      const next = idx(nx, ny, size)
      if (!inBounds(nx, ny, size) || seen.has(next)) {
        continue
      }
      seen.add(next)
      queue.push([nx, ny, dist + 1])
    }
  }
  return -1
}

function pathExists(
  walls: number[],
  size: number,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
): boolean {
  return shortestPath(walls, size, startX, startY, goalX, goalY) >= 0
}

function mazeIsChallenging(build: MazeBuild, size: number): boolean {
  const length = shortestPath(build.walls, size, build.startX, build.startY, build.goalX, build.goalY)
  const manhattan = Math.abs(build.goalX - build.startX) + Math.abs(build.goalY - build.startY)
  return length >= Math.max(manhattan + Math.floor(size * 0.8), Math.ceil(manhattan * 1.55))
}

export function canMove(walls: number[], size: number, x: number, y: number, direction: MazeDirection): boolean {
  const delta = DIR[direction]
  if (((walls[idx(x, y, size)] ?? 15) & delta.wall) !== 0) {
    return false
  }
  return inBounds(x + delta.dx, y + delta.dy, size)
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10)
  }
  return null
}

function asWalls(
  value: unknown,
  size: number,
  seed: number,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
): number[] {
  if (Array.isArray(value) && value.length === size * size) {
    const parsed = value.map((item) => {
      const wall = asInt(item)
      return wall == null ? 15 : Math.max(0, Math.min(15, wall))
    })
    if (pathExists(parsed, size, startX, startY, goalX, goalY)) {
      return parsed
    }
  }
  return generateMaze(size, seed).walls
}

function mazeHasStarted(game: MazeGame, now = Date.now()) {
  return now >= game.startAt
}

function otherUid(game: MazeGame, uid: string): string {
  return uid === game.challengerUid ? game.challengedUid : game.challengerUid
}

export function serializeMazeGame(game: MazeGame): Record<string, unknown> {
  return {
    phase: game.phase,
    size: game.size,
    seed: game.seed,
    walls: [...game.walls],
    startX: game.startX,
    startY: game.startY,
    goalX: game.goalX,
    goalY: game.goalY,
    startAt: new Date(game.startAt).toISOString(),
    challengerUid: game.challengerUid,
    challengedUid: game.challengedUid,
    challengerX: game.challengerX,
    challengerY: game.challengerY,
    challengedX: game.challengedX,
    challengedY: game.challengedY,
    challengerMoves: game.challengerMoves,
    challengedMoves: game.challengedMoves,
    winnerUid: game.winnerUid ?? '',
  }
}

function buildMaze(size: number, seed: number): MazeBuild & { seed: number } {
  let usedSeed = seed >>> 0
  let built = generateMaze(size, usedSeed)
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (pathExists(built.walls, size, built.startX, built.startY, built.goalX, built.goalY) && mazeIsChallenging(built, size)) {
      return { ...built, seed: usedSeed }
    }
    usedSeed = (usedSeed + 0x9e3779b9) >>> 0
    built = generateMaze(size, usedSeed)
  }
  if (!pathExists(built.walls, size, built.startX, built.startY, built.goalX, built.goalY)) {
    usedSeed = (seed ^ 7) >>> 0
    built = generateMaze(size, usedSeed)
  }
  return { ...built, seed: usedSeed }
}

export function createMazeGame(challengerUid: string, challengedUid: string): MazeGame {
  const built = buildMaze(MAZE_SIZE, freshSeed())
  return {
    phase: 'playing',
    size: MAZE_SIZE,
    seed: built.seed,
    walls: built.walls,
    startX: built.startX,
    startY: built.startY,
    goalX: built.goalX,
    goalY: built.goalY,
    challengerUid,
    challengedUid,
    challengerX: built.startX,
    challengerY: built.startY,
    challengedX: built.startX,
    challengedY: built.startY,
    challengerMoves: 0,
    challengedMoves: 0,
    winnerUid: null,
    startAt: Date.now() + MAZE_COUNTDOWN_MS,
  }
}

export function parseMazeGame(value: unknown): MazeGame | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const data = value as Record<string, unknown>
  const challengerUid = typeof data.challengerUid === 'string' ? data.challengerUid : ''
  const challengedUid = typeof data.challengedUid === 'string' ? data.challengedUid : ''
  if (!challengerUid || !challengedUid) {
    return null
  }
  const size = Math.min(17, Math.max(7, asInt(data.size) ?? MAZE_SIZE))
  const seed = (asInt(data.seed) ?? 1) >>> 0
  const clamp = (coord: unknown, fallback: number) => Math.max(0, Math.min(size - 1, asInt(coord) ?? fallback))
  const generated = generateMaze(size, seed)
  const startX = clamp(data.startX, generated.startX)
  const startY = clamp(data.startY, generated.startY)
  const goalX = clamp(data.goalX, generated.goalX)
  const goalY = clamp(data.goalY, generated.goalY)
  const startAt = (() => {
    if (typeof data.startAt === 'number' && Number.isFinite(data.startAt)) {
      return data.startAt
    }
    if (typeof data.startAt === 'string' && data.startAt.trim()) {
      const parsed = Date.parse(data.startAt)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
    return 0
  })()
  return {
    phase: data.phase === 'done' ? 'done' : 'playing',
    size,
    seed,
    walls: asWalls(data.walls, size, seed, startX, startY, goalX, goalY),
    startX,
    startY,
    goalX,
    goalY,
    challengerUid,
    challengedUid,
    challengerX: clamp(data.challengerX, startX),
    challengerY: clamp(data.challengerY, startY),
    challengedX: clamp(data.challengedX, startX),
    challengedY: clamp(data.challengedY, startY),
    challengerMoves: Math.max(0, asInt(data.challengerMoves) ?? 0),
    challengedMoves: Math.max(0, asInt(data.challengedMoves) ?? 0),
    winnerUid: typeof data.winnerUid === 'string' && data.winnerUid ? data.winnerUid : null,
    startAt,
  }
}

export function tickMaze(game: MazeGame): { game: MazeGame; changed: boolean } {
  return { game, changed: false }
}

export function moveMaze(game: MazeGame, uid: string, direction: MazeDirection): MazeGame {
  if (direction !== 'up' && direction !== 'down' && direction !== 'left' && direction !== 'right') {
    throw new Error('Esa dirección no vale.')
  }
  if (uid !== game.challengerUid && uid !== game.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (game.phase === 'done' && game.winnerUid) {
    return game
  }
  if (!mazeHasStarted(game)) {
    return game
  }

  const isChallenger = uid === game.challengerUid
  const x = isChallenger ? game.challengerX : game.challengedX
  const y = isChallenger ? game.challengerY : game.challengedY
  if (!canMove(game.walls, game.size, x, y, direction)) {
    return game
  }

  const delta = DIR[direction]
  const nextX = x + delta.dx
  const nextY = y + delta.dy
  const next: MazeGame = {
    ...game,
    walls: [...game.walls],
  }
  if (isChallenger) {
    next.challengerX = nextX
    next.challengerY = nextY
    next.challengerMoves += 1
  } else {
    next.challengedX = nextX
    next.challengedY = nextY
    next.challengedMoves += 1
  }

  if (nextX === next.goalX && nextY === next.goalY) {
    next.phase = 'done'
    next.winnerUid = uid
  }
  return next
}

export function forfeitMaze(game: MazeGame, uid: string): MazeGame {
  if (uid !== game.challengerUid && uid !== game.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (game.phase === 'done' && game.winnerUid) {
    return game
  }
  return {
    ...game,
    walls: [...game.walls],
    phase: 'done',
    winnerUid: otherUid(game, uid),
  }
}

export function sanitizeMazeForUser(game: MazeGame, uid: string) {
  const isChallenger = uid === game.challengerUid
  const myX = isChallenger ? game.challengerX : game.challengedX
  const myY = isChallenger ? game.challengerY : game.challengedY
  const rivalX = isChallenger ? game.challengedX : game.challengerX
  const rivalY = isChallenger ? game.challengedY : game.challengerY
  const playing = game.phase !== 'done'
  const started = mazeHasStarted(game)
  const atStart = myX === game.startX && myY === game.startY
  let prompt = 'Salís los dos desde la misma casilla. El primero en la meta gana.'
  if (game.phase === 'done') {
    prompt = game.winnerUid === uid ? 'Has ganado el duelo.' : 'Has perdido el duelo.'
  } else if (!started) {
    prompt = 'Salís a la vez. 5, 4, 3, 2, 1…'
  } else if (!atStart) {
    prompt = 'Cada duelo tiene un mapa distinto. Llega a la meta antes que tu rival.'
  }

  return {
    phase: game.phase,
    size: game.size,
    seed: game.seed,
    walls: [...game.walls],
    myX,
    myY,
    rivalX,
    rivalY,
    myMoves: isChallenger ? game.challengerMoves : game.challengedMoves,
    rivalMoves: isChallenger ? game.challengedMoves : game.challengerMoves,
    goalX: game.goalX,
    goalY: game.goalY,
    startX: game.startX,
    startY: game.startY,
    rivalStartX: game.startX,
    rivalStartY: game.startY,
    startAt: game.startAt > 0 ? new Date(game.startAt).toISOString() : null,
    canMove: playing && started,
    iWon: game.phase === 'done' && game.winnerUid ? game.winnerUid === uid : null,
    winnerUid: game.winnerUid,
    prompt,
  }
}
