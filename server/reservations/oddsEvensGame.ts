export type OddsEvensPhase = 'choose_side' | 'pick_number' | 'reveal' | 'done'
export type OddsEvensSide = 'even' | 'odd'

export interface OddsEvensGame {
  phase: OddsEvensPhase
  round: number
  chooserUid: string
  challengerUid: string
  challengedUid: string
  challengerSide: OddsEvensSide | null
  challengedSide: OddsEvensSide | null
  challengerScore: number
  challengedScore: number
  challengerPick: number | null
  challengedPick: number | null
  chooseDeadlineAt: string | null
  pickDeadlineAt: string | null
  revealUntil: string | null
  lastSum: number | null
  lastParity: OddsEvensSide | null
  lastRoundWinnerUid: string | null
  winnerUid: string | null
  roundLog: OddsEvensRoundLogEntry[]
}

export interface OddsEvensRoundLogEntry {
  round: number
  challengerPick: number
  challengedPick: number
  sum: number
  parity: OddsEvensSide
  winnerUid: string
}

export const TURN_MS = 15_000
export const REVEAL_MS = 3_400

function isoIn(ms: number, now: number): string {
  return new Date(now + ms).toISOString()
}

function otherUid(game: OddsEvensGame, uid: string): string {
  return uid === game.challengerUid ? game.challengedUid : game.challengerUid
}

function opposite(side: OddsEvensSide): OddsEvensSide {
  return side === 'even' ? 'odd' : 'even'
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

function asPick(value: unknown): number | null {
  const parsed = asInt(value)
  if (parsed == null || parsed < 1 || parsed > 9) {
    return null
  }
  return parsed
}

function asSide(value: unknown): OddsEvensSide | null {
  return value === 'even' || value === 'odd' ? value : null
}

function asIso(value: unknown): string | null {
  if (typeof value === 'string' && value) {
    return value
  }
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      const date = (value as { toDate: () => Date }).toDate()
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date.toISOString()
      }
    } catch {
      return null
    }
  }
  return null
}

function copyLog(game: OddsEvensGame): OddsEvensRoundLogEntry[] {
  return [...(game.roundLog ?? [])]
}

function pickOf(game: OddsEvensGame, uid: string): number | null {
  if (uid === game.challengerUid) {
    return game.challengerPick
  }
  if (uid === game.challengedUid) {
    return game.challengedPick
  }
  return null
}

function setPickOf(game: OddsEvensGame, uid: string, value: number | null) {
  if (uid === game.challengerUid) {
    game.challengerPick = value
    return
  }
  if (uid === game.challengedUid) {
    game.challengedPick = value
  }
}

function bothPicked(game: OddsEvensGame): boolean {
  return game.challengerPick != null && game.challengedPick != null
}

function clearPicks(game: OddsEvensGame) {
  game.challengerPick = null
  game.challengedPick = null
}

function randomPick(): number {
  return 1 + Math.floor(Math.random() * 9)
}

function parseLog(value: unknown): OddsEvensRoundLogEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const rows: OddsEvensRoundLogEntry[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    const challengerPick = asPick(row.challengerPick)
    const challengedPick = asPick(row.challengedPick)
    const sum = asInt(row.sum)
    const parity = asSide(row.parity)
    const winnerUid = typeof row.winnerUid === 'string' ? row.winnerUid : ''
    const round = asInt(row.round)
    if (challengerPick == null || challengedPick == null || sum == null || !parity || !winnerUid || round == null) {
      continue
    }
    rows.push({ round, challengerPick, challengedPick, sum, parity, winnerUid })
  }
  return rows
}

export function serializeOddsEvensGame(game: OddsEvensGame): Record<string, unknown> {
  return {
    phase: game.phase,
    round: game.round,
    chooserUid: game.chooserUid,
    challengerUid: game.challengerUid,
    challengedUid: game.challengedUid,
    challengerSide: game.challengerSide ?? '',
    challengedSide: game.challengedSide ?? '',
    challengerScore: game.challengerScore,
    challengedScore: game.challengedScore,
    challengerPick: game.challengerPick ?? 0,
    challengedPick: game.challengedPick ?? 0,
    chooseDeadlineAt: game.chooseDeadlineAt ?? '',
    pickDeadlineAt: game.pickDeadlineAt ?? '',
    revealUntil: game.revealUntil ?? '',
    lastSum: game.lastSum ?? 0,
    lastParity: game.lastParity ?? '',
    lastRoundWinnerUid: game.lastRoundWinnerUid ?? '',
    winnerUid: game.winnerUid ?? '',
    roundLog: game.roundLog,
  }
}

export function createOddsEvensGame(challengerUid: string, challengedUid: string): OddsEvensGame {
  return {
    phase: 'choose_side',
    round: 1,
    chooserUid: Math.random() < 0.5 ? challengerUid : challengedUid,
    challengerUid,
    challengedUid,
    challengerSide: null,
    challengedSide: null,
    challengerScore: 0,
    challengedScore: 0,
    challengerPick: null,
    challengedPick: null,
    chooseDeadlineAt: isoIn(TURN_MS, Date.now()),
    pickDeadlineAt: null,
    revealUntil: null,
    lastSum: null,
    lastParity: null,
    lastRoundWinnerUid: null,
    winnerUid: null,
    roundLog: [],
  }
}

export function parseOddsEvensGame(value: unknown): OddsEvensGame | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const data = value as Record<string, unknown>
  const challengerUid = typeof data.challengerUid === 'string' ? data.challengerUid : ''
  const challengedUid = typeof data.challengedUid === 'string' ? data.challengedUid : ''
  const chooserUid = typeof data.chooserUid === 'string' && data.chooserUid
    ? data.chooserUid
    : challengerUid
  if (!challengerUid || !challengedUid) {
    return null
  }

  const nestedSides = data.sides && typeof data.sides === 'object' && !Array.isArray(data.sides)
    ? data.sides as Record<string, unknown>
    : {}
  const nestedScores = data.scores && typeof data.scores === 'object' && !Array.isArray(data.scores)
    ? data.scores as Record<string, unknown>
    : {}
  const nestedPicks = data.picks && typeof data.picks === 'object' && !Array.isArray(data.picks)
    ? data.picks as Record<string, unknown>
    : {}

  const phase: OddsEvensPhase = data.phase === 'pick_number' || data.phase === 'reveal' || data.phase === 'done'
    ? data.phase
    : 'choose_side'

  return {
    phase,
    round: Math.max(1, asInt(data.round) ?? 1),
    chooserUid,
    challengerUid,
    challengedUid,
    challengerSide: asSide(data.challengerSide) ?? asSide(nestedSides[challengerUid]),
    challengedSide: asSide(data.challengedSide) ?? asSide(nestedSides[challengedUid]),
    challengerScore: Math.max(0, asInt(data.challengerScore) ?? asInt(nestedScores[challengerUid]) ?? 0),
    challengedScore: Math.max(0, asInt(data.challengedScore) ?? asInt(nestedScores[challengedUid]) ?? 0),
    challengerPick: asPick(data.challengerPick) ?? asPick(nestedPicks[challengerUid]),
    challengedPick: asPick(data.challengedPick) ?? asPick(nestedPicks[challengedUid]),
    chooseDeadlineAt: asIso(data.chooseDeadlineAt),
    pickDeadlineAt: asIso(data.pickDeadlineAt),
    revealUntil: asIso(data.revealUntil),
    lastSum: (() => {
      const sum = asInt(data.lastSum)
      return sum != null && sum > 0 ? sum : null
    })(),
    lastParity: asSide(data.lastParity),
    lastRoundWinnerUid: typeof data.lastRoundWinnerUid === 'string' && data.lastRoundWinnerUid
      ? data.lastRoundWinnerUid
      : null,
    winnerUid: typeof data.winnerUid === 'string' && data.winnerUid ? data.winnerUid : null,
    roundLog: parseLog(data.roundLog),
  }
}

function beginNumberPick(game: OddsEvensGame, now: number) {
  game.phase = 'pick_number'
  clearPicks(game)
  game.chooseDeadlineAt = null
  game.pickDeadlineAt = isoIn(TURN_MS, now)
  game.revealUntil = null
  game.lastSum = null
  game.lastParity = null
  game.lastRoundWinnerUid = null
}

function beginReveal(game: OddsEvensGame, now: number) {
  const left = game.challengerPick
  const right = game.challengedPick
  if (left == null || right == null) {
    return
  }
  const sum = left + right
  const parity: OddsEvensSide = sum % 2 === 0 ? 'even' : 'odd'
  const winnerUid = game.challengerSide === parity ? game.challengerUid : game.challengedUid
  game.phase = 'reveal'
  game.lastSum = sum
  game.lastParity = parity
  game.lastRoundWinnerUid = winnerUid
  game.pickDeadlineAt = null
  game.revealUntil = isoIn(REVEAL_MS, now)
  game.roundLog = [
    ...copyLog(game).filter((entry) => entry.round !== game.round),
    { round: game.round, challengerPick: left, challengedPick: right, sum, parity, winnerUid },
  ]
}

function finishRound(game: OddsEvensGame, now: number) {
  const winnerUid = game.lastRoundWinnerUid
  if (winnerUid === game.challengerUid) {
    game.challengerScore += 1
  } else if (winnerUid === game.challengedUid) {
    game.challengedScore += 1
  }

  if (game.challengerScore >= 2) {
    finishMatch(game, game.challengerUid)
    return
  }
  if (game.challengedScore >= 2) {
    finishMatch(game, game.challengedUid)
    return
  }

  game.round += 1
  beginNumberPick(game, now)
}

function finishMatch(game: OddsEvensGame, winnerUid: string) {
  game.phase = 'done'
  game.winnerUid = winnerUid
  game.pickDeadlineAt = null
  game.chooseDeadlineAt = null
  game.revealUntil = null
}

export function tickOddsEvens(game: OddsEvensGame, now = Date.now()): { game: OddsEvensGame; changed: boolean } {
  const next: OddsEvensGame = {
    ...game,
    roundLog: copyLog(game),
  }
  const before = JSON.stringify(serializeOddsEvensGame(next))

  if (next.phase === 'choose_side' && next.chooseDeadlineAt && now >= Date.parse(next.chooseDeadlineAt)) {
    const side: OddsEvensSide = Math.random() < 0.5 ? 'even' : 'odd'
    if (next.chooserUid === next.challengerUid) {
      next.challengerSide = side
      next.challengedSide = opposite(side)
    } else {
      next.challengedSide = side
      next.challengerSide = opposite(side)
    }
    beginNumberPick(next, now)
  }

  if (next.phase === 'pick_number' && bothPicked(next)) {
    beginReveal(next, now)
  } else if (next.phase === 'pick_number' && next.pickDeadlineAt && now >= Date.parse(next.pickDeadlineAt)) {
    if (next.challengerPick == null) {
      next.challengerPick = randomPick()
    }
    if (next.challengedPick == null) {
      next.challengedPick = randomPick()
    }
    beginReveal(next, now)
  }

  if (next.phase === 'reveal' && next.revealUntil && now >= Date.parse(next.revealUntil)) {
    finishRound(next, now)
  }

  return { game: next, changed: JSON.stringify(serializeOddsEvensGame(next)) !== before }
}

export function pickOddsEvensSide(game: OddsEvensGame, uid: string, side: OddsEvensSide, now = Date.now()): OddsEvensGame {
  if (game.phase !== 'choose_side') {
    return game
  }
  if (uid !== game.chooserUid) {
    throw new Error('Le toca elegir al otro.')
  }
  if (side !== 'even' && side !== 'odd') {
    throw new Error('Elige pares o nones.')
  }
  const next: OddsEvensGame = { ...game, roundLog: copyLog(game) }
  if (uid === next.challengerUid) {
    next.challengerSide = side
    next.challengedSide = opposite(side)
  } else {
    next.challengedSide = side
    next.challengerSide = opposite(side)
  }
  beginNumberPick(next, now)
  return next
}

export function pickOddsEvensNumber(game: OddsEvensGame, uid: string, value: number, now = Date.now()): OddsEvensGame {
  const picked = Math.trunc(Number(value))
  if (!Number.isInteger(picked) || picked < 1 || picked > 9) {
    throw new Error('Elige un número del 1 al 9.')
  }
  if (uid !== game.challengerUid && uid !== game.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (game.phase !== 'pick_number') {
    return game
  }
  if (pickOf(game, uid) != null) {
    return game
  }

  const next: OddsEvensGame = { ...game, roundLog: copyLog(game) }
  setPickOf(next, uid, picked)
  if (bothPicked(next)) {
    beginReveal(next, now)
  }
  return next
}

export function forfeitOddsEvens(game: OddsEvensGame, uid: string): OddsEvensGame {
  if (uid !== game.challengerUid && uid !== game.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (game.phase === 'done' && game.winnerUid) {
    return game
  }
  const next: OddsEvensGame = { ...game, roundLog: copyLog(game) }
  finishMatch(next, otherUid(next, uid))
  return next
}

export function sanitizeOddsEvensForUser(game: OddsEvensGame, uid: string) {
  const rivalUid = otherUid(game, uid)
  const revealed = game.phase === 'reveal' || game.phase === 'done'
  const mySide = uid === game.challengerUid ? game.challengerSide : game.challengedSide
  const rivalSide = uid === game.challengerUid ? game.challengedSide : game.challengerSide
  const myPick = pickOf(game, uid)
  const rivalPick = pickOf(game, rivalUid)
  const myScore = uid === game.challengerUid ? game.challengerScore : game.challengedScore
  const rivalScore = uid === game.challengerUid ? game.challengedScore : game.challengerScore
  const iWonRound = game.lastRoundWinnerUid ? game.lastRoundWinnerUid === uid : null

  let prompt = 'Se sortea quién elige.'
  if (game.phase === 'choose_side' && uid === game.chooserUid) {
    prompt = 'Elige: ¿pares o nones?'
  } else if (game.phase === 'choose_side') {
    prompt = 'El rival está eligiendo pares o nones.'
  } else if (game.phase === 'pick_number' && myPick == null) {
    prompt = 'Elige un número del 1 al 9.'
  } else if (game.phase === 'pick_number') {
    prompt = 'Esperando al rival.'
  } else if (game.phase === 'reveal') {
    prompt = iWonRound ? 'Ronda para ti.' : 'Ronda para el rival.'
  } else if (game.phase === 'done') {
    prompt = game.winnerUid === uid ? 'Has ganado.' : 'Has perdido.'
  }

  return {
    phase: game.phase,
    round: game.round,
    chooserUid: game.chooserUid,
    mySide,
    rivalSide,
    myScore,
    rivalScore,
    myPick,
    rivalPicked: rivalPick != null,
    rivalPick: revealed ? rivalPick : null,
    pickDeadlineAt: game.pickDeadlineAt,
    chooseDeadlineAt: game.chooseDeadlineAt,
    revealUntil: game.revealUntil,
    lastSum: revealed ? game.lastSum : null,
    lastParity: revealed ? game.lastParity : null,
    lastRoundWinnerUid: revealed ? game.lastRoundWinnerUid : null,
    iWonRound: revealed ? iWonRound : null,
    iWon: game.phase === 'done' && game.winnerUid ? game.winnerUid === uid : null,
    autoPicked: false,
    prompt,
    rounds: copyLog(game).map((entry) => ({
      round: entry.round,
      myPick: uid === game.challengerUid ? entry.challengerPick : entry.challengedPick,
      rivalPick: uid === game.challengerUid ? entry.challengedPick : entry.challengerPick,
      sum: entry.sum,
      parity: entry.parity,
      iWon: entry.winnerUid === uid,
    })),
  }
}
