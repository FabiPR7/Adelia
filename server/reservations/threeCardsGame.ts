export type ThreeCardsPhase =
  | 'pick_deck'
  | 'remove'
  | 'reveal'
  | 'showdown'
  | 'tie'
  | 'final_pick'
  | 'done'

export interface ThreeCardsDeck {
  id: string
  cards: Array<{ id: string; rank: number }>
  takenBy: string | null
}

export interface ThreeCardsGame {
  phase: ThreeCardsPhase
  round: number
  tieCount: number
  decks: ThreeCardsDeck[]
  picks: Record<string, string | null>
  hands: Record<string, Array<{ id: string; rank: number; removed: boolean }>>
  challengerUid: string
  challengedUid: string
  firstPlayerUid: string
  turnUid: string | null
  turnDeadlineAt: string | null
  revealUntil: string | null
  lastRemoved: { cardId: string; rank: number; fromUid: string; byUid: string } | null
  showdown: { challengerRank: number; challengedRank: number } | null
  showdownUntil: string | null
  tieUntil: string | null
  finalCards: Array<{ id: string; rank: number; takenBy: string | null }>
  winnerUid: string | null
}

export const TURN_MS = 15_000
export const REVEAL_MS = 2_800
export const SHOWDOWN_MS = 4_500
export const TIE_MS = 3_200

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const left = next[i]
    const right = next[j]
    if (left === undefined || right === undefined) {
      continue
    }
    next[i] = right
    next[j] = left
  }
  return next
}

function isoIn(ms: number, now = Date.now()): string {
  return new Date(now + ms).toISOString()
}

function otherUid(game: ThreeCardsGame, uid: string): string {
  return uid === game.challengerUid ? game.challengedUid : game.challengerUid
}

function remaining(hand: Array<{ id: string; rank: number; removed: boolean }>) {
  return hand.filter((card) => !card.removed)
}

function cloneGame(game: ThreeCardsGame): ThreeCardsGame {
  return JSON.parse(JSON.stringify(game)) as ThreeCardsGame
}

function makeDeck(index: number): ThreeCardsDeck {
  const ranks = shuffle(RANKS).slice(0, 4)
  return {
    id: `d${index}`,
    cards: ranks.map((rank, cardIndex) => ({
      id: `d${index}c${cardIndex}`,
      rank,
    })),
    takenBy: null,
  }
}

export function createThreeCardsGame(challengerUid: string, challengedUid: string): ThreeCardsGame {
  const firstPlayerUid = Math.random() < 0.5 ? challengerUid : challengedUid
  return {
    phase: 'pick_deck',
    round: 1,
    tieCount: 0,
    decks: [0, 1, 2, 3, 4].map(makeDeck),
    picks: {
      [challengerUid]: null,
      [challengedUid]: null,
    },
    hands: {
      [challengerUid]: [],
      [challengedUid]: [],
    },
    challengerUid,
    challengedUid,
    firstPlayerUid,
    turnUid: null,
    turnDeadlineAt: null,
    revealUntil: null,
    lastRemoved: null,
    showdown: null,
    showdownUntil: null,
    tieUntil: null,
    finalCards: [],
    winnerUid: null,
  }
}

export function parseThreeCardsGame(value: unknown): ThreeCardsGame | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const data = value as Partial<ThreeCardsGame>
  if (!data.challengerUid || !data.challengedUid || !Array.isArray(data.decks)) {
    return null
  }
  const challengerUid = data.challengerUid
  const challengedUid = data.challengedUid
  return {
    ...data,
    challengerUid,
    challengedUid,
    decks: data.decks,
    picks: data.picks && typeof data.picks === 'object' ? data.picks : {
      [challengerUid]: null,
      [challengedUid]: null,
    },
    hands: data.hands && typeof data.hands === 'object' ? data.hands : {
      [challengerUid]: [],
      [challengedUid]: [],
    },
    finalCards: Array.isArray(data.finalCards) ? data.finalCards : [],
  } as ThreeCardsGame
}

function startRemoveRound(game: ThreeCardsGame, now: number) {
  const challengerDeckId = game.picks[game.challengerUid]
  const challengedDeckId = game.picks[game.challengedUid]
  const challengerDeck = game.decks.find((deck) => deck.id === challengerDeckId)
  const challengedDeck = game.decks.find((deck) => deck.id === challengedDeckId)
  if (!challengerDeck || !challengedDeck) {
    throw new Error('Faltan mazos para empezar.')
  }

  game.hands[game.challengerUid] = challengerDeck.cards.map((card) => ({
    id: card.id,
    rank: card.rank,
    removed: false,
  }))
  game.hands[game.challengedUid] = challengedDeck.cards.map((card) => ({
    id: card.id,
    rank: card.rank,
    removed: false,
  }))
  game.phase = 'remove'
  game.firstPlayerUid = Math.random() < 0.5 ? game.challengerUid : game.challengedUid
  game.turnUid = game.firstPlayerUid
  game.turnDeadlineAt = isoIn(TURN_MS, now)
  game.revealUntil = null
  game.lastRemoved = null
  game.showdown = null
  game.showdownUntil = null
}

function startPickRound(game: ThreeCardsGame) {
  game.phase = 'pick_deck'
  game.round += 1
  game.picks = {
    [game.challengerUid]: null,
    [game.challengedUid]: null,
  }
  game.hands = {
    [game.challengerUid]: [],
    [game.challengedUid]: [],
  }
  game.turnUid = null
  game.turnDeadlineAt = null
  game.revealUntil = null
  game.lastRemoved = null
  game.showdown = null
  game.showdownUntil = null
  game.tieUntil = null
  game.finalCards = []
}

function startFinalPick(game: ThreeCardsGame, now: number) {
  const leftover = game.decks.find((deck) => deck.takenBy == null)
  if (!leftover) {
    throw new Error('No queda mazo para el desempate.')
  }
  leftover.takenBy = '__table__'
  game.finalCards = leftover.cards.map((card) => ({
    id: card.id,
    rank: card.rank,
    takenBy: null,
  }))
  game.phase = 'final_pick'
  game.firstPlayerUid = Math.random() < 0.5 ? game.challengerUid : game.challengedUid
  game.turnUid = game.firstPlayerUid
  game.turnDeadlineAt = isoIn(TURN_MS, now)
  game.tieUntil = null
  game.lastRemoved = null
}

function finishWith(game: ThreeCardsGame, winnerUid: string) {
  game.phase = 'done'
  game.winnerUid = winnerUid
  game.turnUid = null
  game.turnDeadlineAt = null
}

function resolveShowdown(game: ThreeCardsGame, now: number) {
  if (!game.showdown) {
    return
  }
  const { challengerRank, challengedRank } = game.showdown
  if (challengerRank > challengedRank) {
    finishWith(game, game.challengerUid)
    return
  }
  if (challengedRank > challengerRank) {
    finishWith(game, game.challengedUid)
    return
  }

  game.tieCount += 1
  if (game.tieCount >= 2) {
    startFinalPick(game, now)
    return
  }

  game.phase = 'tie'
  game.tieUntil = isoIn(TIE_MS, now)
  game.turnUid = null
  game.turnDeadlineAt = null
}

function afterReveal(game: ThreeCardsGame, now: number) {
  game.revealUntil = null
  const challengerLeft = remaining(game.hands[game.challengerUid] ?? []).length
  const challengedLeft = remaining(game.hands[game.challengedUid] ?? []).length
  if (challengerLeft === 1 && challengedLeft === 1) {
    const mine = remaining(game.hands[game.challengerUid] ?? [])[0]
    const theirs = remaining(game.hands[game.challengedUid] ?? [])[0]
    if (!mine || !theirs) {
      return
    }
    game.phase = 'showdown'
    game.showdown = {
      challengerRank: mine.rank,
      challengedRank: theirs.rank,
    }
    game.showdownUntil = isoIn(SHOWDOWN_MS, now)
    game.turnUid = null
    game.turnDeadlineAt = null
    return
  }

  if (!game.turnUid) {
    return
  }
  game.phase = 'remove'
  game.turnUid = otherUid(game, game.turnUid)
  game.turnDeadlineAt = isoIn(TURN_MS, now)
}

function applyRemove(game: ThreeCardsGame, uid: string, cardId: string, now: number) {
  if (game.phase !== 'remove' || game.turnUid !== uid) {
    throw new Error('No es tu turno.')
  }
  const rivalUid = otherUid(game, uid)
  const hand = game.hands[rivalUid] ?? []
  const card = hand.find((item) => item.id === cardId && !item.removed)
  if (!card) {
    throw new Error('Esa carta ya no está en juego.')
  }
  card.removed = true
  game.lastRemoved = {
    cardId: card.id,
    rank: card.rank,
    fromUid: rivalUid,
    byUid: uid,
  }
  game.phase = 'reveal'
  game.revealUntil = isoIn(REVEAL_MS, now)
  game.turnDeadlineAt = null
}

function applyFinalPick(game: ThreeCardsGame, uid: string, cardId: string, now: number) {
  if (game.phase !== 'final_pick' || game.turnUid !== uid) {
    throw new Error('No es tu turno.')
  }
  if (game.finalCards.some((card) => card.takenBy === uid)) {
    throw new Error('Ya elegiste carta.')
  }
  const card = game.finalCards.find((item) => item.id === cardId)
  if (!card || card.takenBy) {
    throw new Error('Esa carta no está disponible.')
  }
  card.takenBy = uid

  const challengerCard = game.finalCards.find((item) => item.takenBy === game.challengerUid)
  const challengedCard = game.finalCards.find((item) => item.takenBy === game.challengedUid)
  if (challengerCard && challengedCard) {
    game.phase = 'showdown'
    game.showdown = {
      challengerRank: challengerCard.rank,
      challengedRank: challengedCard.rank,
    }
    game.showdownUntil = isoIn(SHOWDOWN_MS, now)
    game.turnUid = null
    game.turnDeadlineAt = null
    return
  }

  game.turnUid = otherUid(game, uid)
  game.turnDeadlineAt = isoIn(TURN_MS, now)
}

function autoRemove(game: ThreeCardsGame, now: number) {
  if (!game.turnUid) {
    return
  }
  const rivalUid = otherUid(game, game.turnUid)
  const options = remaining(game.hands[rivalUid] ?? [])
  const pick = options[Math.floor(Math.random() * options.length)]
  if (!pick) {
    return
  }
  applyRemove(game, game.turnUid, pick.id, now)
}

function autoFinalPick(game: ThreeCardsGame, now: number) {
  if (!game.turnUid) {
    return
  }
  const options = game.finalCards.filter((card) => !card.takenBy)
  const pick = options[Math.floor(Math.random() * options.length)]
  if (!pick) {
    return
  }
  applyFinalPick(game, game.turnUid, pick.id, now)
}

export function tickThreeCards(game: ThreeCardsGame, now = Date.now()): { game: ThreeCardsGame; changed: boolean } {
  const next = cloneGame(game)
  const before = JSON.stringify(next)

  for (let step = 0; step < 48; step += 1) {
    if (next.phase === 'reveal' && next.revealUntil && now >= Date.parse(next.revealUntil)) {
      afterReveal(next, Date.parse(next.revealUntil))
      continue
    }
    if (next.phase === 'showdown' && next.showdownUntil && now >= Date.parse(next.showdownUntil)) {
      resolveShowdown(next, Date.parse(next.showdownUntil))
      continue
    }
    if (next.phase === 'tie' && next.tieUntil && now >= Date.parse(next.tieUntil)) {
      startPickRound(next)
      continue
    }
    if (next.phase === 'remove' && next.turnDeadlineAt && now >= Date.parse(next.turnDeadlineAt)) {
      autoRemove(next, Date.parse(next.turnDeadlineAt))
      continue
    }
    if (next.phase === 'final_pick' && next.turnDeadlineAt && now >= Date.parse(next.turnDeadlineAt)) {
      autoFinalPick(next, Date.parse(next.turnDeadlineAt))
      continue
    }
    break
  }

  return { game: next, changed: JSON.stringify(next) !== before }
}

export function forfeitThreeCards(game: ThreeCardsGame, uid: string): ThreeCardsGame {
  const next = cloneGame(game)
  if (uid !== next.challengerUid && uid !== next.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (next.phase === 'done' && next.winnerUid) {
    return next
  }
  finishWith(next, otherUid(next, uid))
  return next
}

export function pickThreeCardsDeck(game: ThreeCardsGame, uid: string, deckId: string, now = Date.now()): ThreeCardsGame {
  const next = cloneGame(game)
  if (next.phase !== 'pick_deck') {
    throw new Error('Ahora no se elige mazo.')
  }
  if (uid !== next.challengerUid && uid !== next.challengedUid) {
    throw new Error('Este reto no es tuyo.')
  }
  if (next.picks[uid]) {
    throw new Error('Ya elegiste mazo.')
  }
  const deck = next.decks.find((item) => item.id === deckId)
  if (!deck || deck.takenBy) {
    throw new Error('Ese mazo no está disponible.')
  }
  deck.takenBy = uid
  next.picks[uid] = deckId

  if (next.picks[next.challengerUid] && next.picks[next.challengedUid]) {
    startRemoveRound(next, now)
  }
  return next
}

export function removeThreeCardsCard(game: ThreeCardsGame, uid: string, cardId: string, now = Date.now()): ThreeCardsGame {
  const next = cloneGame(game)
  applyRemove(next, uid, cardId, now)
  return next
}

export function pickThreeCardsFinalCard(game: ThreeCardsGame, uid: string, cardId: string, now = Date.now()): ThreeCardsGame {
  const next = cloneGame(game)
  applyFinalPick(next, uid, cardId, now)
  return next
}

export function sanitizeThreeCardsForUser(game: ThreeCardsGame, uid: string) {
  const rivalUid = otherUid(game, uid)
  const myHand = game.hands?.[uid] ?? []
  const rivalHand = game.hands?.[rivalUid] ?? []
  const finalCards = game.finalCards ?? []
  const bothFinalPicked = finalCards.filter((card) => card.takenBy).length >= 2
    || game.phase === 'showdown'
    || game.phase === 'done'

  let prompt = 'Elige un mazo.'
  if (game.phase === 'pick_deck' && game.picks[uid]) {
    prompt = 'Esperando a que el rival elija mazo.'
  } else if (game.phase === 'pick_deck' && game.tieCount > 0) {
    prompt = 'Empate. Elige otro mazo.'
  } else if (game.phase === 'remove' && game.turnUid === uid) {
    prompt = '¿Cuál quieres quitar?'
  } else if (game.phase === 'remove') {
    prompt = 'El rival está eligiendo qué carta quitarte.'
  } else if (game.phase === 'reveal') {
    prompt = 'Carta quitada.'
  } else if (game.phase === 'showdown') {
    prompt = 'Se revelan las cartas.'
  } else if (game.phase === 'tie') {
    prompt = 'Empate. Se eligen mazos de nuevo.'
  } else if (game.phase === 'final_pick' && game.turnUid === uid) {
    prompt = 'Elige una carta.'
  } else if (game.phase === 'final_pick') {
    prompt = 'El rival está eligiendo carta.'
  } else if (game.phase === 'done') {
    prompt = game.winnerUid === uid ? 'Has ganado.' : 'Has perdido.'
  }

  return {
    phase: game.phase,
    round: game.round,
    tieCount: game.tieCount,
    turnUid: game.turnUid,
    turnDeadlineAt: game.turnDeadlineAt,
    myDeckId: game.picks?.[uid] ?? null,
    rivalPicked: Boolean(game.picks?.[rivalUid]),
    decks: (game.decks ?? [])
      .filter((deck) => deck.takenBy == null)
      .map((deck) => ({ id: deck.id, takenBy: deck.takenBy })),
    myCards: myHand
      .filter((card) => !card.removed)
      .map((card) => ({ id: card.id, rank: card.rank, removed: false })),
    rivalCards: rivalHand
      .filter((card) => !card.removed)
      .map((card) => ({ id: card.id, rank: null, removed: false })),
    lastRemoved: game.lastRemoved,
    showdown: game.showdown
      ? {
        myRank: uid === game.challengerUid ? game.showdown.challengerRank : game.showdown.challengedRank,
        rivalRank: uid === game.challengerUid ? game.showdown.challengedRank : game.showdown.challengerRank,
      }
      : null,
    finalCards: finalCards.map((card) => ({
      id: card.id,
      rank: bothFinalPicked || card.takenBy === uid ? card.rank : null,
      takenBy: card.takenBy,
    })),
    prompt,
    iWon: game.phase === 'done' && game.winnerUid ? game.winnerUid === uid : null,
  }
}
