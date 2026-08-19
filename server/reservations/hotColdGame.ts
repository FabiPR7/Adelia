export type HotColdPhase = 'pick_secret' | 'probe' | 'guess' | 'done'
export type HotColdTemperature = 'boiling' | 'hot' | 'warm' | 'cold' | 'freezing'
export type HotColdDirection = 'higher' | 'lower' | 'exact'
export type HotColdGuessOutcome = 'tie' | 'both_miss' | null

export const HOT_COLD_MIN = 1
export const HOT_COLD_MAX = 99
export const HOT_COLD_GUESS_COUNTDOWN_MS = 3_000
export const HOT_COLD_TIE_MS = 80

export interface HotColdGame {
  phase: HotColdPhase
  round: number
  challengerUid: string
  challengedUid: string
  challengerSecretOptions: number[]
  challengedSecretOptions: number[]
  challengerSecret: number | null
  challengedSecret: number | null
  challengerProbe1Options: number[]
  challengedProbe1Options: number[]
  challengerProbe1: number | null
  challengedProbe1: number | null
  challengerProbe2Options: number[]
  challengedProbe2Options: number[]
  challengerProbe2: number | null
  challengedProbe2: number | null
  challengerGuessOptions: number[]
  challengedGuessOptions: number[]
  challengerGuess: number | null
  challengedGuess: number | null
  challengerGuessAt: number
  challengedGuessAt: number
  guessStartAt: number
  guessAttempt: number
  lastGuessOutcome: HotColdGuessOutcome
  winnerUid: string | null
}

function otherUid(game: HotColdGame, uid: string) {
  return uid === game.challengerUid ? game.challengedUid : game.challengerUid
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

function asHotNumber(value: unknown): number | null {
  const parsed = asInt(value)
  if (parsed == null || parsed < HOT_COLD_MIN || parsed > HOT_COLD_MAX) {
    return null
  }
  return parsed
}

function asNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  const unique: number[] = []
  for (const item of value) {
    const parsed = asHotNumber(item)
    if (parsed == null || unique.includes(parsed)) {
      continue
    }
    unique.push(parsed)
    if (unique.length >= 3) {
      break
    }
  }
  return unique
}

function asIsoMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return 0
}

function asPhase(value: unknown): HotColdPhase {
  if (value === 'probe' || value === 'guess' || value === 'done' || value === 'pick_secret') {
    return value
  }
  return 'pick_secret'
}

function asOutcome(value: unknown): HotColdGuessOutcome {
  return value === 'tie' || value === 'both_miss' ? value : null
}

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    return 0
  }
  const bytes = new Uint32Array(1)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    bytes[0] = Math.floor(Math.random() * 0xffffffff)
  }
  return (bytes[0] ?? 0) % maxExclusive
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1)
    const current = next[index]!
    next[index] = next[swap]!
    next[swap] = current
  }
  return next
}

function pickDistinct(count: number, exclude: number[] = []): number[] {
  const banned = new Set(exclude)
  const pool: number[] = []
  for (let value = HOT_COLD_MIN; value <= HOT_COLD_MAX; value += 1) {
    if (!banned.has(value)) {
      pool.push(value)
    }
  }
  const picked: number[] = []
  while (picked.length < count && pool.length > 0) {
    const index = randomInt(pool.length)
    picked.push(pool.splice(index, 1)[0]!)
  }
  return picked
}

const HEAT_BANDS: Record<HotColdTemperature, { min: number; max: number }> = {
  boiling: { min: 1, max: 3 },
  hot: { min: 4, max: 8 },
  warm: { min: 9, max: 18 },
  cold: { min: 19, max: 32 },
  freezing: { min: 33, max: 98 },
}

const ALL_HEAT_BANDS: HotColdTemperature[] = ['boiling', 'hot', 'warm', 'cold', 'freezing']

function placements(secret: number, distance: number, banned: Set<number>): number[] {
  const out: number[] = []
  const low = secret - distance
  const high = secret + distance
  if (low >= HOT_COLD_MIN && low <= HOT_COLD_MAX && !banned.has(low)) {
    out.push(low)
  }
  if (high >= HOT_COLD_MIN && high <= HOT_COLD_MAX && !banned.has(high) && high !== low) {
    out.push(high)
  }
  return out
}

function pickDistanceInBand(secret: number, band: HotColdTemperature, banned: Set<number>): number | null {
  const range = HEAT_BANDS[band]
  const pool: number[] = []
  for (let distance = range.min; distance <= range.max; distance += 1) {
    if (placements(secret, distance, banned).length > 0) {
      pool.push(distance)
    }
  }
  if (pool.length === 0) {
    return null
  }
  return pool[randomInt(pool.length)] ?? null
}

function randomProbeBands(round: 1 | 2): HotColdTemperature[] {
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const bands = shuffle(ALL_HEAT_BANDS).slice(0, 3)
    const closeCount = bands.filter((band) => band === 'boiling' || band === 'hot').length
    const hasFar = bands.includes('cold') || bands.includes('freezing')
    if (round === 1 && hasFar && closeCount <= 1) {
      return bands
    }
    if (round === 2 && closeCount >= 1) {
      return bands
    }
  }
  return round === 1 ? ['warm', 'cold', 'freezing'] : ['boiling', 'hot', 'warm']
}

function randomDecoyBands(): HotColdTemperature[] {
  const first = ALL_HEAT_BANDS[randomInt(ALL_HEAT_BANDS.length)] ?? 'hot'
  const rest = ALL_HEAT_BANDS.filter((band) => band !== first)
  const second = rest[randomInt(rest.length)] ?? 'cold'
  return [first, second]
}

function numbersFromBands(secret: number, bands: HotColdTemperature[], extraBan: number[] = []): number[] {
  const banned = new Set<number>([secret, ...extraBan.filter((value) => value >= HOT_COLD_MIN)])
  const picked: number[] = []
  for (const band of bands) {
    const distance = pickDistanceInBand(secret, band, banned)
    if (distance == null) {
      continue
    }
    const options = placements(secret, distance, banned)
    const value = options[randomInt(options.length)]
    if (value == null) {
      continue
    }
    picked.push(value)
    banned.add(value)
  }
  if (picked.length < bands.length) {
    picked.push(...pickDistinct(bands.length - picked.length, [...banned]))
  }
  return shuffle(picked)
}

function fairGuessSet(secret: number, decoyBands: HotColdTemperature[]): number[] {
  const decoys = numbersFromBands(secret, decoyBands)
  return shuffle([secret, ...decoys.slice(0, 2)])
}

function isChallenger(game: HotColdGame, uid: string) {
  return uid === game.challengerUid
}

function secretOf(game: HotColdGame, uid: string) {
  return isChallenger(game, uid) ? game.challengerSecret : game.challengedSecret
}

function setSecret(game: HotColdGame, uid: string, value: number) {
  if (isChallenger(game, uid)) {
    game.challengerSecret = value
    return
  }
  game.challengedSecret = value
}

function currentOptions(game: HotColdGame, uid: string): number[] {
  const mine = isChallenger(game, uid)
  if (game.phase === 'pick_secret') {
    return mine ? game.challengerSecretOptions : game.challengedSecretOptions
  }
  if (game.phase === 'probe' && game.round === 1) {
    return mine ? game.challengerProbe1Options : game.challengedProbe1Options
  }
  if (game.phase === 'probe' && game.round === 2) {
    return mine ? game.challengerProbe2Options : game.challengedProbe2Options
  }
  if (game.phase === 'guess') {
    return mine ? game.challengerGuessOptions : game.challengedGuessOptions
  }
  return []
}

function currentPick(game: HotColdGame, uid: string): number | null {
  const mine = isChallenger(game, uid)
  if (game.phase === 'pick_secret') {
    return secretOf(game, uid)
  }
  if (game.phase === 'probe' && game.round === 1) {
    return mine ? game.challengerProbe1 : game.challengedProbe1
  }
  if (game.phase === 'probe' && game.round === 2) {
    return mine ? game.challengerProbe2 : game.challengedProbe2
  }
  if (game.phase === 'guess') {
    return mine ? game.challengerGuess : game.challengedGuess
  }
  return null
}

function setCurrentPick(game: HotColdGame, uid: string, value: number, now: number) {
  const mine = isChallenger(game, uid)
  if (game.phase === 'pick_secret') {
    setSecret(game, uid, value)
    return
  }
  if (game.phase === 'probe' && game.round === 1) {
    if (mine) {
      game.challengerProbe1 = value
    } else {
      game.challengedProbe1 = value
    }
    return
  }
  if (game.phase === 'probe' && game.round === 2) {
    if (mine) {
      game.challengerProbe2 = value
    } else {
      game.challengedProbe2 = value
    }
    return
  }
  if (game.phase === 'guess') {
    if (mine) {
      game.challengerGuess = value
      game.challengerGuessAt = now
    } else {
      game.challengedGuess = value
      game.challengedGuessAt = now
    }
  }
}

function temperatureFor(distance: number): HotColdTemperature {
  if (distance <= 3) {
    return 'boiling'
  }
  if (distance <= 8) {
    return 'hot'
  }
  if (distance <= 18) {
    return 'warm'
  }
  if (distance <= 32) {
    return 'cold'
  }
  return 'freezing'
}

function clueFor(pick: number | null, secret: number | null, round: number) {
  if (pick == null || secret == null) {
    return null
  }
  const distance = Math.abs(pick - secret)
  const direction: HotColdDirection = pick === secret ? 'exact' : pick < secret ? 'higher' : 'lower'
  return {
    round,
    pick,
    temperature: temperatureFor(distance),
    direction,
    distance,
  }
}

function beginProbeRound(game: HotColdGame, round: 1 | 2) {
  const secretA = game.challengerSecret
  const secretB = game.challengedSecret
  if (secretA == null || secretB == null) {
    return
  }
  const bands = randomProbeBands(round)
  game.phase = 'probe'
  game.round = round
  if (round === 1) {
    game.challengerProbe1Options = numbersFromBands(secretB, bands)
    game.challengedProbe1Options = numbersFromBands(secretA, bands)
    game.challengerProbe1 = null
    game.challengedProbe1 = null
    return
  }
  game.challengerProbe2Options = numbersFromBands(secretB, bands, game.challengerProbe1Options)
  game.challengedProbe2Options = numbersFromBands(secretA, bands, game.challengedProbe1Options)
  game.challengerProbe2 = null
  game.challengedProbe2 = null
}

function beginGuess(game: HotColdGame, outcome: HotColdGuessOutcome, now: number) {
  if (game.challengerSecret == null || game.challengedSecret == null) {
    return
  }
  const decoyBands = randomDecoyBands()
  game.phase = 'guess'
  game.round = 3
  game.challengerGuessOptions = fairGuessSet(game.challengedSecret, decoyBands)
  game.challengedGuessOptions = fairGuessSet(game.challengerSecret, decoyBands)
  game.challengerGuess = null
  game.challengedGuess = null
  game.challengerGuessAt = 0
  game.challengedGuessAt = 0
  game.guessStartAt = now + HOT_COLD_GUESS_COUNTDOWN_MS
  game.guessAttempt += 1
  game.lastGuessOutcome = outcome
}

function maybeAdvanceAfterProbe(game: HotColdGame, now: number) {
  if (game.phase !== 'probe') {
    return
  }
  if (game.round === 1 && game.challengerProbe1 != null && game.challengedProbe1 != null) {
    beginProbeRound(game, 2)
    return
  }
  if (game.round === 2 && game.challengerProbe2 != null && game.challengedProbe2 != null) {
    beginGuess(game, null, now)
  }
}

function resolveGuess(game: HotColdGame) {
  if (game.phase !== 'guess' || game.challengerSecret == null || game.challengedSecret == null) {
    return
  }
  const challengerOk = game.challengerGuess != null && game.challengerGuess === game.challengedSecret
  const challengedOk = game.challengedGuess != null && game.challengedGuess === game.challengerSecret
  const challengerPicked = game.challengerGuess != null
  const challengedPicked = game.challengedGuess != null

  if (challengerOk && !challengedPicked) {
    game.phase = 'done'
    game.winnerUid = game.challengerUid
    return
  }
  if (challengedOk && !challengerPicked) {
    game.phase = 'done'
    game.winnerUid = game.challengedUid
    return
  }
  if (!challengerPicked || !challengedPicked) {
    return
  }

  if (challengerOk && challengedOk) {
    const delta = Math.abs(game.challengerGuessAt - game.challengedGuessAt)
    if (delta <= HOT_COLD_TIE_MS) {
      beginGuess(game, 'tie', Date.now())
      return
    }
    game.phase = 'done'
    game.winnerUid = game.challengerGuessAt <= game.challengedGuessAt
      ? game.challengerUid
      : game.challengedUid
    return
  }
  if (challengerOk) {
    game.phase = 'done'
    game.winnerUid = game.challengerUid
    return
  }
  if (challengedOk) {
    game.phase = 'done'
    game.winnerUid = game.challengedUid
    return
  }
  beginGuess(game, 'both_miss', Date.now())
}

function cloneGame(game: HotColdGame): HotColdGame {
  return {
    ...game,
    challengerSecretOptions: [...game.challengerSecretOptions],
    challengedSecretOptions: [...game.challengedSecretOptions],
    challengerProbe1Options: [...game.challengerProbe1Options],
    challengedProbe1Options: [...game.challengedProbe1Options],
    challengerProbe2Options: [...game.challengerProbe2Options],
    challengedProbe2Options: [...game.challengedProbe2Options],
    challengerGuessOptions: [...game.challengerGuessOptions],
    challengedGuessOptions: [...game.challengedGuessOptions],
  }
}

export function serializeHotColdGame(game: HotColdGame): Record<string, unknown> {
  return {
    phase: game.phase,
    round: game.round,
    challengerUid: game.challengerUid,
    challengedUid: game.challengedUid,
    challengerSecretOptions: [...game.challengerSecretOptions],
    challengedSecretOptions: [...game.challengedSecretOptions],
    challengerSecret: game.challengerSecret ?? 0,
    challengedSecret: game.challengedSecret ?? 0,
    challengerProbe1Options: [...game.challengerProbe1Options],
    challengedProbe1Options: [...game.challengedProbe1Options],
    challengerProbe1: game.challengerProbe1 ?? 0,
    challengedProbe1: game.challengedProbe1 ?? 0,
    challengerProbe2Options: [...game.challengerProbe2Options],
    challengedProbe2Options: [...game.challengedProbe2Options],
    challengerProbe2: game.challengerProbe2 ?? 0,
    challengedProbe2: game.challengedProbe2 ?? 0,
    challengerGuessOptions: [...game.challengerGuessOptions],
    challengedGuessOptions: [...game.challengedGuessOptions],
    challengerGuess: game.challengerGuess ?? 0,
    challengedGuess: game.challengedGuess ?? 0,
    challengerGuessAt: game.challengerGuessAt,
    challengedGuessAt: game.challengedGuessAt,
    guessStartAt: game.guessStartAt > 0 ? new Date(game.guessStartAt).toISOString() : '',
    guessAttempt: game.guessAttempt,
    lastGuessOutcome: game.lastGuessOutcome ?? '',
    winnerUid: game.winnerUid ?? '',
  }
}

export function createHotColdGame(challengerUid: string, challengedUid: string): HotColdGame {
  return {
    phase: 'pick_secret',
    round: 0,
    challengerUid,
    challengedUid,
    challengerSecretOptions: pickDistinct(3),
    challengedSecretOptions: pickDistinct(3),
    challengerSecret: null,
    challengedSecret: null,
    challengerProbe1Options: [],
    challengedProbe1Options: [],
    challengerProbe1: null,
    challengedProbe1: null,
    challengerProbe2Options: [],
    challengedProbe2Options: [],
    challengerProbe2: null,
    challengedProbe2: null,
    challengerGuessOptions: [],
    challengedGuessOptions: [],
    challengerGuess: null,
    challengedGuess: null,
    challengerGuessAt: 0,
    challengedGuessAt: 0,
    guessStartAt: 0,
    guessAttempt: 0,
    lastGuessOutcome: null,
    winnerUid: null,
  }
}

export function parseHotColdGame(value: unknown): HotColdGame | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const data = value as Record<string, unknown>
  const challengerUid = typeof data.challengerUid === 'string' ? data.challengerUid : ''
  const challengedUid = typeof data.challengedUid === 'string' ? data.challengedUid : ''
  if (!challengerUid || !challengedUid) {
    return null
  }
  const zeroAsNull = (raw: unknown) => {
    const parsed = asHotNumber(raw)
    return parsed && parsed > 0 ? parsed : null
  }
  return {
    phase: asPhase(data.phase),
    round: Math.max(0, Math.min(3, asInt(data.round) ?? 0)),
    challengerUid,
    challengedUid,
    challengerSecretOptions: asNumbers(data.challengerSecretOptions),
    challengedSecretOptions: asNumbers(data.challengedSecretOptions),
    challengerSecret: zeroAsNull(data.challengerSecret),
    challengedSecret: zeroAsNull(data.challengedSecret),
    challengerProbe1Options: asNumbers(data.challengerProbe1Options),
    challengedProbe1Options: asNumbers(data.challengedProbe1Options),
    challengerProbe1: zeroAsNull(data.challengerProbe1),
    challengedProbe1: zeroAsNull(data.challengedProbe1),
    challengerProbe2Options: asNumbers(data.challengerProbe2Options),
    challengedProbe2Options: asNumbers(data.challengedProbe2Options),
    challengerProbe2: zeroAsNull(data.challengerProbe2),
    challengedProbe2: zeroAsNull(data.challengedProbe2),
    challengerGuessOptions: asNumbers(data.challengerGuessOptions),
    challengedGuessOptions: asNumbers(data.challengedGuessOptions),
    challengerGuess: zeroAsNull(data.challengerGuess),
    challengedGuess: zeroAsNull(data.challengedGuess),
    challengerGuessAt: Math.max(0, asIsoMillis(data.challengerGuessAt)),
    challengedGuessAt: Math.max(0, asIsoMillis(data.challengedGuessAt)),
    guessStartAt: asIsoMillis(data.guessStartAt),
    guessAttempt: Math.max(0, asInt(data.guessAttempt) ?? 0),
    lastGuessOutcome: asOutcome(data.lastGuessOutcome),
    winnerUid: typeof data.winnerUid === 'string' && data.winnerUid ? data.winnerUid : null,
  }
}

export function tickHotCold(game: HotColdGame): { game: HotColdGame; changed: boolean } {
  const next = cloneGame(game)
  let changed = false
  if (next.phase === 'pick_secret') {
    if (next.challengerSecretOptions.length < 3) {
      next.challengerSecretOptions = pickDistinct(3)
      changed = true
    }
    if (next.challengedSecretOptions.length < 3) {
      next.challengedSecretOptions = pickDistinct(3)
      changed = true
    }
  }
  if (
    next.phase === 'probe'
    && next.round === 1
    && next.challengerSecret != null
    && next.challengedSecret != null
    && next.challengerProbe1 == null
    && next.challengedProbe1 == null
    && (next.challengerProbe1Options.length < 3 || next.challengedProbe1Options.length < 3)
  ) {
    beginProbeRound(next, 1)
    changed = true
  }
  if (
    next.phase === 'guess'
    && next.challengerSecret != null
    && next.challengedSecret != null
    && next.challengerGuess == null
    && next.challengedGuess == null
    && (next.challengerGuessOptions.length < 3 || next.challengedGuessOptions.length < 3)
  ) {
    const attempt = next.guessAttempt
    beginGuess(next, next.lastGuessOutcome, Date.now())
    next.guessAttempt = Math.max(attempt, 1)
    changed = true
  }
  return { game: changed ? next : game, changed }
}

export function pickHotColdNumber(game: HotColdGame, uid: string, value: number, now = Date.now()): HotColdGame {
  if (uid !== game.challengerUid && uid !== game.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (game.phase === 'done' && game.winnerUid) {
    return game
  }
  const picked = Math.trunc(Number(value))
  if (!Number.isInteger(picked) || picked < HOT_COLD_MIN || picked > HOT_COLD_MAX) {
    throw new Error('Elige uno de los tres números.')
  }

  const next = cloneGame(game)
  if (next.phase === 'guess' && next.guessStartAt > 0 && now < next.guessStartAt) {
    return next
  }

  const options = currentOptions(next, uid)
  if (!options.includes(picked)) {
    throw new Error('Ese número no está en tus burbujas.')
  }

  const already = currentPick(next, uid)
  if (already != null) {
    return next
  }

  setCurrentPick(next, uid, picked, now)

  if (next.phase === 'pick_secret' && next.challengerSecret != null && next.challengedSecret != null) {
    beginProbeRound(next, 1)
    return next
  }
  if (next.phase === 'probe') {
    maybeAdvanceAfterProbe(next, now)
    return next
  }
  if (next.phase === 'guess') {
    resolveGuess(next)
  }
  return next
}

export function forfeitHotCold(game: HotColdGame, uid: string): HotColdGame {
  if (uid !== game.challengerUid && uid !== game.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (game.phase === 'done' && game.winnerUid) {
    return game
  }
  const next = cloneGame(game)
  next.phase = 'done'
  next.winnerUid = otherUid(next, uid)
  return next
}

export function sanitizeHotColdForUser(game: HotColdGame, uid: string) {
  const rivalUid = otherUid(game, uid)
  const mine = isChallenger(game, uid)
  const mySecret = secretOf(game, uid)
  const rivalSecret = secretOf(game, rivalUid)
  const options = currentOptions(game, uid)
  const myPick = currentPick(game, uid)
  const rivalPick = currentPick(game, rivalUid)
  const done = game.phase === 'done'
  const guessOpen = game.phase !== 'guess' || game.guessStartAt <= 0 || Date.now() >= game.guessStartAt

  const probe1 = clueFor(mine ? game.challengerProbe1 : game.challengedProbe1, rivalSecret, 1)
  const probe2 = clueFor(mine ? game.challengerProbe2 : game.challengedProbe2, rivalSecret, 2)
  const clues = [probe1, probe2].filter((item): item is NonNullable<typeof item> => Boolean(item))
  const latest = clues[clues.length - 1] ?? null

  let prompt = 'Elige uno de los tres números. Será tu secreto.'
  if (game.phase === 'pick_secret' && mySecret != null) {
    prompt = 'Tu número ya está guardado. Esperando al rival.'
  } else if (game.phase === 'probe' && myPick == null) {
    prompt = game.round === 1
      ? 'Ronda 1 · Elige un número para oler el del rival.'
      : 'Ronda 2 · Otra pista. Elige otro número.'
  } else if (game.phase === 'probe') {
    prompt = 'Pista lista. Esperando a que el rival elija.'
  } else if (game.phase === 'guess' && !guessOpen) {
    prompt = 'Ronda 3 · Entre esas tres burbujas está el número del rival. Salís a la vez.'
  } else if (game.phase === 'guess' && myPick == null) {
    prompt = '¡Ahora! El primero que acierte el número del rival gana.'
  } else if (game.phase === 'guess') {
    prompt = 'Ya elegiste. Si fallas, el rival aún puede llevarse la mesa.'
  } else if (done) {
    prompt = game.winnerUid === uid ? 'Has ganado el duelo.' : 'Has perdido el duelo.'
  }

  return {
    phase: game.phase,
    round: game.round,
    options,
    mySecret,
    myPick,
    rivalReady: game.phase === 'pick_secret' ? rivalSecret != null : rivalPick != null,
    rivalPicked: rivalPick != null,
    rivalHasSecret: rivalSecret != null,
    clues,
    lastTemperature: latest?.temperature ?? null,
    lastDirection: latest?.direction ?? null,
    guessStartAt: game.guessStartAt > 0 ? new Date(game.guessStartAt).toISOString() : null,
    canPick: !done && myPick == null && (game.phase !== 'guess' || guessOpen),
    guessAttempt: game.guessAttempt,
    lastGuessOutcome: game.lastGuessOutcome,
    iWon: done && game.winnerUid ? game.winnerUid === uid : null,
    winnerUid: game.winnerUid,
    rivalSecret: done ? rivalSecret : null,
    myGuess: done ? (mine ? game.challengerGuess : game.challengedGuess) : (game.phase === 'guess' ? myPick : null),
    rivalGuess: done ? (mine ? game.challengedGuess : game.challengerGuess) : null,
    prompt,
  }
}
