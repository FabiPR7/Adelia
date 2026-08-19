export type StopwatchPhase = 'idle' | 'running' | 'done'

export interface StopwatchGame {
  phase: StopwatchPhase
  turnIndex: number
  targetHundredths: number
  targetHundredthsList: number[]
  challengerUid: string
  challengedUid: string
  firstUid: string
  challengerTimes: number[]
  challengedTimes: number[]
  startedAt: string | null
  turnDeadlineAt: string | null
  winnerUid: string | null
}

export const MAX_RUN_MS = 20_000
export const MIN_TARGET = 300
export const MAX_TARGET = 1000

function isoIn(ms: number, now = Date.now()): string {
  return new Date(now + ms).toISOString()
}

function otherUid(game: StopwatchGame, uid: string): string {
  return uid === game.challengerUid ? game.challengedUid : game.challengerUid
}

function cloneGame(game: StopwatchGame): StopwatchGame {
  return JSON.parse(JSON.stringify(game)) as StopwatchGame
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

function asTimes(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => asInt(item))
    .filter((item): item is number => item != null && item >= 0 && item <= 2_000)
}

export function randomTargetHundredths(): number {
  return MIN_TARGET + Math.floor(Math.random() * (MAX_TARGET - MIN_TARGET + 1))
}

function asTarget(value: unknown): number | null {
  const parsed = asInt(value)
  if (parsed == null || parsed < MIN_TARGET || parsed > MAX_TARGET) {
    return null
  }
  return parsed
}

function asTargets(value: unknown, fallback: number): number[] {
  if (Array.isArray(value)) {
    const parsed = value.map((item) => asTarget(item)).filter((item): item is number => item != null)
    if (parsed.length > 0) {
      return parsed
    }
  }
  return [fallback]
}

function nextTarget(previous: number): number {
  let next = randomTargetHundredths()
  for (let step = 0; step < 16 && next === previous; step += 1) {
    next = randomTargetHundredths()
  }
  return next
}

function currentTarget(game: StopwatchGame): number {
  const index = Math.floor(Math.max(0, game.turnIndex) / 2)
  return game.targetHundredthsList[index]
    ?? game.targetHundredthsList[game.targetHundredthsList.length - 1]
    ?? game.targetHundredths
}

export function turnUidForIndex(game: Pick<StopwatchGame, 'firstUid' | 'challengerUid' | 'challengedUid'>, turnIndex: number): string {
  const first = game.firstUid || game.challengerUid
  const second = first === game.challengerUid ? game.challengedUid : game.challengerUid
  const round = Math.floor(turnIndex / 2) + 1
  const firstOfRound = turnIndex % 2 === 0
  if (round % 2 === 1) {
    return firstOfRound ? first : second
  }
  return firstOfRound ? second : first
}

export function roundForTurnIndex(turnIndex: number): number {
  return Math.floor(turnIndex / 2) + 1
}

export function timesFor(game: StopwatchGame, uid: string): number[] {
  return uid === game.challengerUid ? game.challengerTimes : game.challengedTimes
}

function setTimes(game: StopwatchGame, uid: string, times: number[]) {
  if (uid === game.challengerUid) {
    game.challengerTimes = times
    return
  }
  game.challengedTimes = times
}

export function errorForTime(timeHundredths: number, targetHundredths: number): number {
  return Math.abs(timeHundredths - targetHundredths)
}

export function totalError(times: number[], targets: number[]): number {
  return times.reduce((sum, time, index) => {
    const target = targets[index] ?? targets[targets.length - 1] ?? MIN_TARGET
    return sum + errorForTime(time, target)
  }, 0)
}

function maybeFinish(game: StopwatchGame) {
  const needed = Math.max(3, Math.floor(game.turnIndex / 2))
  if (game.turnIndex < 6 || game.turnIndex % 2 !== 0) {
    return
  }
  if (game.challengerTimes.length < needed || game.challengedTimes.length < needed) {
    return
  }
  const left = totalError(game.challengerTimes, game.targetHundredthsList)
  const right = totalError(game.challengedTimes, game.targetHundredthsList)
  if (left === right) {
    return
  }
  game.phase = 'done'
  game.winnerUid = left < right ? game.challengerUid : game.challengedUid
  game.startedAt = null
  game.turnDeadlineAt = null
}

function recordTime(game: StopwatchGame, uid: string, hundredths: number) {
  const nextTimes = [...timesFor(game, uid), hundredths]
  setTimes(game, uid, nextTimes)
  game.turnIndex += 1
  game.phase = 'idle'
  game.startedAt = null
  game.turnDeadlineAt = null
  maybeFinish(game)
  if (game.phase !== 'done' && game.turnIndex % 2 === 0) {
    const fresh = nextTarget(currentTarget(game))
    game.targetHundredthsList = [...game.targetHundredthsList, fresh]
  }
  game.targetHundredths = currentTarget(game)
}

function clampHundredths(value: number): number {
  return Math.max(0, Math.min(2_000, Math.round(value)))
}

export function serializeStopwatchGame(game: StopwatchGame): Record<string, unknown> {
  return {
    phase: game.phase,
    turnIndex: game.turnIndex,
    targetHundredths: game.targetHundredths,
    targetHundredthsList: [...game.targetHundredthsList],
    challengerUid: game.challengerUid,
    challengedUid: game.challengedUid,
    firstUid: game.firstUid,
    challengerTimes: [...game.challengerTimes],
    challengedTimes: [...game.challengedTimes],
    startedAt: game.startedAt ?? '',
    turnDeadlineAt: game.turnDeadlineAt ?? '',
    winnerUid: game.winnerUid ?? '',
  }
}

export function createStopwatchGame(challengerUid: string, challengedUid: string): StopwatchGame {
  const targetHundredths = randomTargetHundredths()
  return {
    phase: 'idle',
    turnIndex: 0,
    targetHundredths,
    targetHundredthsList: [targetHundredths],
    challengerUid,
    challengedUid,
    firstUid: challengerUid,
    challengerTimes: [],
    challengedTimes: [],
    startedAt: null,
    turnDeadlineAt: null,
    winnerUid: null,
  }
}

export function parseStopwatchGame(value: unknown): StopwatchGame | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const data = value as Record<string, unknown>
  const challengerUid = typeof data.challengerUid === 'string' ? data.challengerUid : ''
  const challengedUid = typeof data.challengedUid === 'string' ? data.challengedUid : ''
  if (!challengerUid || !challengedUid) {
    return null
  }
  const target = asTarget(data.targetHundredths) ?? MIN_TARGET
  const targetHundredthsList = asTargets(data.targetHundredthsList, target)
  return {
    phase: data.phase === 'running' || data.phase === 'done' ? data.phase : 'idle',
    turnIndex: Math.max(0, asInt(data.turnIndex) ?? 0),
    targetHundredths: targetHundredthsList[Math.floor(Math.max(0, asInt(data.turnIndex) ?? 0) / 2)] ?? target,
    targetHundredthsList,
    challengerUid,
    challengedUid,
    firstUid: typeof data.firstUid === 'string' && data.firstUid ? data.firstUid : challengerUid,
    challengerTimes: asTimes(data.challengerTimes),
    challengedTimes: asTimes(data.challengedTimes),
    startedAt: typeof data.startedAt === 'string' && data.startedAt ? data.startedAt : null,
    turnDeadlineAt: typeof data.turnDeadlineAt === 'string' && data.turnDeadlineAt ? data.turnDeadlineAt : null,
    winnerUid: typeof data.winnerUid === 'string' && data.winnerUid ? data.winnerUid : null,
  }
}

export function tickStopwatch(game: StopwatchGame, now = Date.now()): { game: StopwatchGame; changed: boolean } {
  const next = cloneGame(game)
  const before = JSON.stringify(serializeStopwatchGame(next))

  if (next.phase === 'running' && next.turnDeadlineAt && now >= Date.parse(next.turnDeadlineAt)) {
    const uid = turnUidForIndex(next, next.turnIndex)
    const started = next.startedAt ? Date.parse(next.startedAt) : now - MAX_RUN_MS
    const elapsed = clampHundredths((now - started) / 10)
    recordTime(next, uid, elapsed)
  }

  maybeFinish(next)

  return { game: next, changed: JSON.stringify(serializeStopwatchGame(next)) !== before }
}

export function startStopwatch(game: StopwatchGame, uid: string, now = Date.now()): StopwatchGame {
  const next = cloneGame(game)
  if (next.phase === 'done') {
    return next
  }
  if (next.phase === 'running' && turnUidForIndex(next, next.turnIndex) === uid) {
    return next
  }
  if (next.phase !== 'idle') {
    throw new Error('Ahora no se puede iniciar.')
  }
  if (uid !== turnUidForIndex(next, next.turnIndex)) {
    throw new Error('Le toca al otro.')
  }
  next.phase = 'running'
  next.startedAt = new Date(now).toISOString()
  next.turnDeadlineAt = isoIn(MAX_RUN_MS, now)
  return next
}

export function stopStopwatch(game: StopwatchGame, uid: string, hundredths: number, now = Date.now()): StopwatchGame {
  const next = cloneGame(game)
  if (next.phase === 'done') {
    return next
  }
  if (next.phase !== 'running') {
    throw new Error('Primero tienes que iniciar.')
  }
  if (uid !== turnUidForIndex(next, next.turnIndex)) {
    throw new Error('Le toca al otro.')
  }
  const started = next.startedAt ? Date.parse(next.startedAt) : now
  const serverElapsed = clampHundredths((now - started) / 10)
  const reported = Number.isFinite(hundredths) ? clampHundredths(hundredths) : serverElapsed
  recordTime(next, uid, reported)
  return next
}

export function forfeitStopwatch(game: StopwatchGame, uid: string): StopwatchGame {
  const next = cloneGame(game)
  if (uid !== next.challengerUid && uid !== next.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (next.phase === 'done' && next.winnerUid) {
    return next
  }
  next.phase = 'done'
  next.winnerUid = otherUid(next, uid)
  next.startedAt = null
  next.turnDeadlineAt = null
  return next
}

export function sanitizeStopwatchForUser(game: StopwatchGame, uid: string) {
  const rivalUid = otherUid(game, uid)
  const myTimes = timesFor(game, uid)
  const rivalTimes = timesFor(game, rivalUid)
  const currentUid = turnUidForIndex(game, game.turnIndex)
  const myTurn = game.phase !== 'done' && currentUid === uid
  const displayRound = game.phase === 'done'
    ? Math.max(3, Math.floor(Math.max(game.challengerTimes.length, game.challengedTimes.length)))
    : roundForTurnIndex(game.turnIndex)

  let prompt = 'Esperando el cronómetro.'
  if (game.phase === 'done') {
    prompt = game.winnerUid === uid ? 'Has ganado.' : 'Has perdido.'
  } else if (myTurn && game.phase === 'idle') {
    prompt = 'Inicia el cronómetro y páralo lo más cerca posible.'
  } else if (myTurn && game.phase === 'running') {
    prompt = '¡Para!'
  } else if (game.phase === 'running') {
    prompt = 'El rival está cronometrando.'
  } else {
    prompt = 'Esperando al rival.'
  }

  return {
    phase: game.phase,
    round: displayRound,
    turnIndex: game.turnIndex,
    targetHundredths: currentTarget(game),
    roundTargets: [...game.targetHundredthsList],
    myTimes,
    rivalTimes,
    myError: totalError(myTimes, game.targetHundredthsList),
    rivalError: totalError(rivalTimes, game.targetHundredthsList),
    myTurn,
    canStart: myTurn && game.phase === 'idle',
    canStop: myTurn && game.phase === 'running',
    running: game.phase === 'running' && myTurn,
    rivalRunning: game.phase === 'running' && !myTurn,
    startedAt: myTurn && game.phase === 'running' ? game.startedAt : null,
    iWon: game.phase === 'done' && game.winnerUid ? game.winnerUid === uid : null,
    prompt,
  }
}
