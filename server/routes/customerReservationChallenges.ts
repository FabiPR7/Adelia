import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import {
  acceptReservationChallenge,
  ackChallengeResult,
  createReservationChallenge,
  declineReservationChallenge,
  forfeitChallengeGame,
  listLiveChallengesForUser,
  pickChallengeDeck,
  pickChallengeFinalCard,
  pickChallengeOddsEvensNumber,
  pickChallengeOddsEvensSide,
  removeChallengeCard,
  startChallengeStopwatch,
  stopChallengeStopwatch,
  moveChallengeMaze,
  pickChallengeHotColdNumber,
} from '../reservations/challenges.ts'

const router = Router()

function statusForError(message: string): number {
  if (message.includes('cliente') || message.includes('autorizado')) return 401
  if (message.includes('no encontrada') || message.includes('no encontrado')) return 404
  if (message.includes('tuyo') || message.includes('Solo')) return 403
  if (
    message.includes('ya')
    || message.includes('curso')
    || message.includes('empezado')
    || message.includes('cancelad')
    || message.includes('invitación')
    || message.includes('propia')
    || message.includes('turno')
    || message.includes('mazo')
    || message.includes('carta')
    || message.includes('lista')
    || message.includes('3 cartas')
    || message.includes('pares')
    || message.includes('nones')
    || message.includes('número')
    || message.includes('elige')
    || message.includes('cronómetro')
    || message.includes('iniciar')
    || message.includes('laberinto')
    || message.includes('dirección')
    || message.includes('frío')
    || message.includes('caliente')
    || message.includes('burbujas')
  ) {
    return 409
  }
  return 400
}

router.get('/live', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenges = await listLiveChallengesForUser(user.uid)
    res.json({ challenges })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los retos.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const reservationId = String(req.body?.reservationId ?? '').trim()
    const challenge = await createReservationChallenge(user.uid, reservationId)
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el reto.'
    console.error('POST /reservation-challenges', message)
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/accept', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await acceptReservationChallenge(String(req.params.challengeId ?? ''), user.uid)
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo aceptar el reto.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/decline', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await declineReservationChallenge(String(req.params.challengeId ?? ''), user.uid)
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo rechazar el reto.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/ack-result', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await ackChallengeResult(String(req.params.challengeId ?? ''), user.uid)
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cerrar el resultado.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/pick-deck', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await pickChallengeDeck(
      String(req.params.challengeId ?? ''),
      user.uid,
      String(req.body?.deckId ?? ''),
    )
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo elegir el mazo.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/remove', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await removeChallengeCard(
      String(req.params.challengeId ?? ''),
      user.uid,
      String(req.body?.cardId ?? ''),
    )
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo quitar la carta.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/pick-card', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await pickChallengeFinalCard(
      String(req.params.challengeId ?? ''),
      user.uid,
      String(req.body?.cardId ?? ''),
    )
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo elegir la carta.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/pick-side', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await pickChallengeOddsEvensSide(
      String(req.params.challengeId ?? ''),
      user.uid,
      String(req.body?.side ?? ''),
    )
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo elegir pares o nones.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/pick-number', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const raw = req.body?.number ?? req.body?.value
    const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
    const challenge = await pickChallengeOddsEvensNumber(
      String(req.params.challengeId ?? ''),
      user.uid,
      value,
    )
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo elegir el número.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/stopwatch-start', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await startChallengeStopwatch(String(req.params.challengeId ?? ''), user.uid)
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo iniciar el cronómetro.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/stopwatch-stop', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const raw = req.body?.hundredths ?? req.body?.value
    const hundredths = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
    const challenge = await stopChallengeStopwatch(
      String(req.params.challengeId ?? ''),
      user.uid,
      hundredths,
    )
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo parar el cronómetro.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/maze-move', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const direction = String(req.body?.direction ?? req.body?.dir ?? '')
    const challenge = await moveChallengeMaze(String(req.params.challengeId ?? ''), user.uid, direction)
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo mover en el laberinto.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/hot-cold-pick', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const raw = req.body?.number ?? req.body?.value
    const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
    const challenge = await pickChallengeHotColdNumber(
      String(req.params.challengeId ?? ''),
      user.uid,
      value,
    )
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo elegir el número.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.post('/:challengeId/game/forfeit', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const challenge = await forfeitChallengeGame(String(req.params.challengeId ?? ''), user.uid)
    res.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo rendir.'
    res.status(statusForError(message)).json({ error: message })
  }
})

export default router
