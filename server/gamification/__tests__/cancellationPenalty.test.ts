import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  reservation: {} as Record<string, unknown>,
  state: {} as Record<string, unknown>,
  written: null as Record<string, unknown> | null,
}))

vi.mock('../../firebase-admin.ts', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ id: 'doc' }) }),
    runTransaction: async (fn: (tx: unknown) => unknown) => fn({
      get: async () => ({ exists: true, data: () => store.reservation }),
      update: () => undefined,
    }),
  },
}))

vi.mock('../../data/userGamification.ts', () => ({
  userGamificationRef: () => ({ id: 'stats' }),
  readGamificationFromDocs: () => store.state,
  writeGamification: (_tx: unknown, _uid: string, state: Record<string, unknown>) => {
    store.written = state
  },
}))

vi.mock('../../notifications/service.ts', () => ({
  resolveCustomerUidForReservation: async () => 'cliente-1',
  findCustomerUidByEmail: async () => 'cliente-1',
}))

import { applyReservationCancellationPenalty } from '../cancellationPenalty.ts'

describe('penalización por cancelar', () => {
  beforeEach(() => {
    store.state = { xp: 1000, inventory: { cancel_shield: 1 }, cancellationStrikeCount: 0 }
    store.written = null
  })

  it('si cancela el restaurante, el cliente no pierde XP ni gasta su escudo', async () => {
    store.reservation = { status: 'cancelled', cancelledBy: 'restaurant', customerUid: 'cliente-1', cancelShieldRequested: true }

    expect(await applyReservationCancellationPenalty('r1', store.reservation)).toBeNull()
    expect(store.written).toBeNull()
  })

  it('una reserva de invitado con su correo no le penaliza (otro pudo usar su correo)', async () => {
    store.reservation = { status: 'cancelled', cancelledBy: 'client', clientEmail: 'cliente@correo.test' }

    expect(await applyReservationCancellationPenalty('r1', store.reservation)).toBeNull()
    expect(store.written).toBeNull()
  })

  it('una reserva que sigue en pie no penaliza', async () => {
    store.reservation = { status: 'completed', cancelledBy: 'client', customerUid: 'cliente-1' }

    expect(await applyReservationCancellationPenalty('r1', store.reservation)).toBeNull()
  })

  it('si el cliente cancela su reserva, sí cuenta', async () => {
    store.state = { xp: 1000, inventory: {}, cancellationStrikeCount: 0 }
    store.reservation = { status: 'cancelled', cancelledBy: 'client', customerUid: 'cliente-1' }

    const result = await applyReservationCancellationPenalty('r1', store.reservation)
    expect(result).not.toBeNull()
    expect(store.written?.cancellationStrikeCount).toBe(1)
  })

  it('si no se presentó, cuenta aunque lo marque el restaurante', async () => {
    store.state = { xp: 1000, inventory: {}, cancellationStrikeCount: 0 }
    store.reservation = { status: 'cancelled', cancelledBy: 'restaurant', noShow: true, customerUid: 'cliente-1' }

    expect(await applyReservationCancellationPenalty('r1', store.reservation)).not.toBeNull()
    expect(store.written?.cancellationStrikeCount).toBe(1)
  })
})

describe('cancelación gratis con 24 h o más', () => {
  const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000)

  beforeEach(() => {
    store.state = { xp: 1000, inventory: { escudo_mesa: 1 }, cancellationStrikeCount: 0 }
    store.written = null
  })

  it('con 48 h de antelación no quita XP, no suma aviso ni gasta el escudo', async () => {
    store.reservation = { status: 'cancelled', cancelledBy: 'client', customerUid: 'cliente-1', startTime: inHours(48), cancelShieldRequested: true }

    const result = await applyReservationCancellationPenalty('r1', store.reservation)
    expect(result?.free).toBe(true)
    expect(result?.xpLost).toBe(0)
    expect(store.written).toBeNull()
  })

  it('devuelve la Invitación extra si la usó', async () => {
    store.reservation = { status: 'cancelled', cancelledBy: 'client', customerUid: 'cliente-1', startTime: inHours(30), usedExtraPax: true }

    await applyReservationCancellationPenalty('r1', store.reservation)
    expect((store.written?.inventory as Record<string, number>).invitacion_extra).toBe(1)
  })

  it('con menos de 24 h sigue contando como falta', async () => {
    store.state = { xp: 1000, inventory: {}, cancellationStrikeCount: 0 }
    store.reservation = { status: 'cancelled', cancelledBy: 'client', customerUid: 'cliente-1', startTime: inHours(5), usedExtraPax: true }

    const result = await applyReservationCancellationPenalty('r1', store.reservation)
    expect(result?.free).toBeUndefined()
    expect(store.written?.cancellationStrikeCount).toBe(1)
    expect((store.written?.inventory as Record<string, number>).invitacion_extra).toBeUndefined()
  })
})
