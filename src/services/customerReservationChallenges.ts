import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'
import { getIdToken } from './auth'
import type { ReservationChallenge } from '../types/reservationChallenges'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function authHeaders(): Promise<HeadersInit> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión.')
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

function parseErrorPayload(text: string, status: number, fallback: string): string {
  try {
    const payload = JSON.parse(text) as { error?: unknown }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error
    }
  } catch {
    // HTML u otra respuesta que no es JSON
  }

  if (status === 404 || text.trim().startsWith('<')) {
    return 'El servidor local no tiene la ruta del reto. Para npm run dev y vuélvelo a arrancar.'
  }
  if (status >= 500) {
    return `${fallback} (${status})`
  }
  return fallback
}

async function readError(response: Response, fallback: string): Promise<string> {
  return parseErrorPayload(await response.text(), response.status, fallback)
}

async function readChallenge(response: Response, fallback: string): Promise<ReservationChallenge> {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(parseErrorPayload(text, response.status, fallback))
  }
  if (text.trim().startsWith('<')) {
    throw new Error('El servidor local no tiene la ruta del reto. Para npm run dev y vuélvelo a arrancar.')
  }
  try {
    const data = JSON.parse(text) as { challenge?: ReservationChallenge }
    if (!data.challenge) {
      throw new Error(fallback)
    }
    return data.challenge
  } catch (error) {
    if (error instanceof Error && error.message === fallback) {
      throw error
    }
    throw new Error(fallback)
  }
}

function timestampToIso(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      const converted = (value as { toDate: () => Date }).toDate()
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted.toISOString()
      }
    } catch {
      return new Date().toISOString()
    }
  }
  return new Date().toISOString()
}

function mapChallenge(id: string, data: Record<string, unknown>): ReservationChallenge {
  const status = data.status
  return {
    id,
    reservationId: String(data.reservationId ?? ''),
    companyId: String(data.companyId ?? ''),
    companyName: String(data.companyName ?? 'Restaurante'),
    companySlug: String(data.companySlug ?? ''),
    companyPhotoUrl: String(data.companyPhotoUrl ?? ''),
    startTime: timestampToIso(data.startTime),
    pax: typeof data.pax === 'number' ? data.pax : 1,
    challengerUid: String(data.challengerUid ?? ''),
    challengerDisplayName: String(data.challengerDisplayName ?? 'Usuario'),
    challengerPhotoUrl: String(data.challengerPhotoUrl ?? ''),
    challengedUid: String(data.challengedUid ?? ''),
    challengedDisplayName: String(data.challengedDisplayName ?? 'Usuario'),
    challengedPhotoUrl: String(data.challengedPhotoUrl ?? ''),
    minigameId: data.minigameId === 'odds_evens'
      || data.minigameId === 'stopwatch'
      || data.minigameId === 'maze'
      || data.minigameId === 'hot_cold'
      ? data.minigameId
      : 'three_cards',
    status: status === 'active' || status === 'resolved' || status === 'declined' || status === 'cancelled'
      ? status
      : 'ringing',
    winnerUid: typeof data.winnerUid === 'string' && data.winnerUid ? data.winnerUid : null,
    resultAckedUids: Array.isArray(data.resultAckedUids)
      ? data.resultAckedUids.filter((item): item is string => typeof item === 'string')
      : [],
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    threeCards: null,
    oddsEvens: null,
    stopwatch: null,
    maze: null,
    hotCold: null,
  }
}

export function subscribeReservationChallenges(
  userId: string,
  onChange: (challenges: ReservationChallenge[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const challengedQuery = query(
    collection(db, 'reservationChallenges'),
    where('challengedUid', '==', userId),
  )
  const challengerQuery = query(
    collection(db, 'reservationChallenges'),
    where('challengerUid', '==', userId),
  )

  let challenged: ReservationChallenge[] = []
  let challenger: ReservationChallenge[] = []

  const emit = () => {
    const byId = new Map<string, ReservationChallenge>()
    for (const item of [...challenged, ...challenger]) {
      byId.set(item.id, item)
    }
    onChange([...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  }

  const unsubA = onSnapshot(
    challengedQuery,
    (snapshot) => {
      challenged = snapshot.docs.map((docSnap) => mapChallenge(docSnap.id, docSnap.data() as Record<string, unknown>))
      emit()
    },
    (error) => onError?.(error),
  )

  const unsubB = onSnapshot(
    challengerQuery,
    (snapshot) => {
      challenger = snapshot.docs.map((docSnap) => mapChallenge(docSnap.id, docSnap.data() as Record<string, unknown>))
      emit()
    },
    (error) => onError?.(error),
  )

  return () => {
    unsubA()
    unsubB()
  }
}

export async function fetchLiveReservationChallenges(): Promise<ReservationChallenge[]> {
  const response = await fetch(`${API_BASE}/api/customer/reservation-challenges/live`, {
    headers: await authHeaders(),
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudieron cargar los retos.'))
  }
  const data = (await response.json()) as { challenges?: ReservationChallenge[] }
  return data.challenges ?? []
}

export async function createReservationChallenge(reservationId: string): Promise<ReservationChallenge> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/customer/reservation-challenges`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ reservationId }),
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está en marcha npm run dev?')
  }
  return readChallenge(response, 'No se pudo enviar el reto.')
}

export async function acceptReservationChallenge(challengeId: string): Promise<ReservationChallenge> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-challenges/${encodeURIComponent(challengeId)}/accept`,
    { method: 'POST', headers: await authHeaders() },
  )
  return readChallenge(response, 'No se pudo aceptar el reto.')
}

export async function declineReservationChallenge(challengeId: string): Promise<ReservationChallenge> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-challenges/${encodeURIComponent(challengeId)}/decline`,
    { method: 'POST', headers: await authHeaders() },
  )
  return readChallenge(response, 'No se pudo cancelar el reto.')
}

export async function ackReservationChallengeResult(challengeId: string): Promise<ReservationChallenge> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-challenges/${encodeURIComponent(challengeId)}/ack-result`,
    { method: 'POST', headers: await authHeaders() },
  )
  return readChallenge(response, 'No se pudo cerrar el resultado.')
}

async function postGameAction(
  challengeId: string,
  path: string,
  body: Record<string, string>,
  fallback: string,
): Promise<ReservationChallenge> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-challenges/${encodeURIComponent(challengeId)}/${path}`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    },
  )
  return readChallenge(response, fallback)
}

export async function pickThreeCardsDeck(challengeId: string, deckId: string): Promise<ReservationChallenge> {
  return postGameAction(challengeId, 'game/pick-deck', { deckId }, 'No se pudo elegir el mazo.')
}

export async function removeThreeCardsCard(challengeId: string, cardId: string): Promise<ReservationChallenge> {
  return postGameAction(challengeId, 'game/remove', { cardId }, 'No se pudo quitar la carta.')
}

export async function pickThreeCardsFinalCard(challengeId: string, cardId: string): Promise<ReservationChallenge> {
  return postGameAction(challengeId, 'game/pick-card', { cardId }, 'No se pudo elegir la carta.')
}

export async function forfeitThreeCardsGame(challengeId: string): Promise<ReservationChallenge> {
  return postGameAction(challengeId, 'game/forfeit', {}, 'No se pudo rendir.')
}

export async function pickOddsEvensSide(challengeId: string, side: 'even' | 'odd'): Promise<ReservationChallenge> {
  return postGameAction(challengeId, 'game/pick-side', { side }, 'No se pudo elegir pares o nones.')
}

export async function pickOddsEvensNumber(challengeId: string, value: number): Promise<ReservationChallenge> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-challenges/${encodeURIComponent(challengeId)}/game/pick-number`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ number: value, value }),
    },
  )
  return readChallenge(response, 'No se pudo elegir el número.')
}

export async function startStopwatchGame(challengeId: string): Promise<ReservationChallenge> {
  return postGameAction(challengeId, 'game/stopwatch-start', {}, 'No se pudo iniciar el cronómetro.')
}

export async function stopStopwatchGame(challengeId: string, hundredths: number): Promise<ReservationChallenge> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-challenges/${encodeURIComponent(challengeId)}/game/stopwatch-stop`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ hundredths, value: hundredths }),
    },
  )
  return readChallenge(response, 'No se pudo parar el cronómetro.')
}

export async function moveMazeGame(challengeId: string, direction: string): Promise<ReservationChallenge> {
  return postGameAction(
    challengeId,
    'game/maze-move',
    { direction },
    'No se pudo mover en el laberinto.',
  )
}

export async function pickHotColdNumber(challengeId: string, value: number): Promise<ReservationChallenge> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-challenges/${encodeURIComponent(challengeId)}/game/hot-cold-pick`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ number: value, value }),
    },
  )
  return readChallenge(response, 'No se pudo elegir el número.')
}
