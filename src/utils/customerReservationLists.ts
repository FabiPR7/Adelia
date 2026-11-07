import type { Reservation } from '../types'

export interface CustomerReservationLists {
  /** Lo que ve el cliente en "Mis reservas": por cuenta y por correo. */
  all: Reservation[]
  /** Lo que cuenta para misiones y XP. */
  forMissions: Reservation[]
}

function newestFirst(rows: Reservation[]): Reservation[] {
  return [...rows].sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
}

/**
 * Las reservas hechas solo con el correo se muestran siempre, pero no cuentan
 * para misiones si la cuenta ya tiene reservas propias: sumarlas pagaría XP y
 * cartas por un historial antiguo (pasó en la prueba del 2026-11-06).
 */
export function splitCustomerReservations(
  byAccount: Reservation[],
  byEmail: Reservation[],
): CustomerReservationLists {
  const byId = new Map(byAccount.map((row) => [row.id, row]))
  for (const row of byEmail) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row)
    }
  }

  return {
    all: newestFirst([...byId.values()]),
    forMissions: newestFirst(byAccount.length > 0 ? byAccount : byEmail),
  }
}
