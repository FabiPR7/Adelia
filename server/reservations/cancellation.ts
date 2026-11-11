export type CancellationVerdict =
  | { ok: true }
  | { ok: false; status: 409; reason: 'already_cancelled' | 'attended' | 'past'; error: string }

function startDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const toDate = (value as { toDate?: () => Date } | null | undefined)?.toDate
  if (typeof toDate === 'function') {
    const date = toDate.call(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

/**
 * Una reserva solo se puede cancelar mientras está pendiente y no ha empezado.
 * Si ya se atendió (`confirmed`) o ya pasó la hora, cancelarla no tiene sentido y
 * además restaría XP al comensal por una visita que sí hizo.
 */
export function evaluateClientCancellation(
  reservation: { status?: unknown; startTime?: unknown },
  now = new Date(),
): CancellationVerdict {
  if (reservation.status === 'cancelled') {
    return { ok: false, status: 409, reason: 'already_cancelled', error: 'Esta reserva ya estaba cancelada.' }
  }
  if (reservation.status === 'confirmed') {
    return {
      ok: false,
      status: 409,
      reason: 'attended',
      error: 'Esta reserva ya se ha atendido y no se puede cancelar.',
    }
  }
  const start = startDate(reservation.startTime)
  if (start && start.getTime() <= now.getTime()) {
    return {
      ok: false,
      status: 409,
      reason: 'past',
      error: 'La hora de esta reserva ya ha pasado, así que no se puede cancelar. Si no vas a ir, avisa al restaurante.',
    }
  }
  return { ok: true }
}
