import { describe, expect, it } from 'vitest'
import { evaluateClientCancellation } from '../cancellation.ts'
import {
  buildReservationCancelledHtml,
  buildReservationCancelledSubject,
  buildReservationCancelledText,
  type ReservationCancelledEmailData,
} from '../../email/reservationCancelled.ts'

const now = new Date('2026-11-10T10:00:00Z')
const future = new Date('2026-11-10T20:30:00Z')

describe('who can cancel a reservation', () => {
  it('allows a pending reservation that has not started', () => {
    expect(evaluateClientCancellation({ status: 'completed', startTime: future }, now)).toEqual({ ok: true })
  })

  it('rejects an already cancelled reservation', () => {
    expect(evaluateClientCancellation({ status: 'cancelled', startTime: future }, now)).toMatchObject({ ok: false, reason: 'already_cancelled' })
  })

  it('rejects a reservation that was already attended: it would cost XP for a visit that happened', () => {
    expect(evaluateClientCancellation({ status: 'confirmed', startTime: future }, now)).toMatchObject({ ok: false, reason: 'attended' })
  })

  it('rejects a reservation whose time has passed', () => {
    expect(evaluateClientCancellation({ status: 'completed', startTime: new Date('2026-11-10T09:00:00Z') }, now)).toMatchObject({ ok: false, reason: 'past' })
  })

  it('understands Firestore timestamps', () => {
    const timestamp = { toDate: () => new Date('2026-11-09T10:00:00Z') }
    expect(evaluateClientCancellation({ status: 'completed', startTime: timestamp }, now)).toMatchObject({ ok: false, reason: 'past' })
  })
})

const data: ReservationCancelledEmailData = {
  to: 'ana@example.com',
  clientName: 'Ana',
  restaurantName: 'Casa <Luna>',
  restaurantSlug: 'casa-luna',
  restaurantPhone: '600123456',
  // 20:30 UTC = 21:30 en Madrid.
  date: new Date('2026-11-10T20:30:00Z'),
  pax: 4,
  cancelledBy: 'client',
  depositOutcome: null,
  depositAmountCents: null,
}

describe('cancellation email', () => {
  it('says the restaurant hour (Madrid), the party size and links to book again', () => {
    const html = buildReservationCancelledHtml(data)
    expect(html).toContain('21:30')
    expect(html).toContain('Comensales')
    expect(html).toContain('/reservar/casa-luna')
    expect(buildReservationCancelledSubject(data)).toContain('Reserva cancelada')
    expect(buildReservationCancelledText(data)).toContain('Hora: 21:30')
  })

  it('escapes the restaurant name', () => {
    expect(buildReservationCancelledHtml(data)).not.toContain('Casa <Luna>')
    expect(buildReservationCancelledHtml(data)).toContain('Casa &lt;Luna&gt;')
  })

  it('tells the client who cancelled', () => {
    expect(buildReservationCancelledText(data)).toContain('tal y como pediste')
    expect(buildReservationCancelledText({ ...data, cancelledBy: 'restaurant' })).toContain('ha tenido que cancelar tu reserva')
  })

  it('explains what happened with the deposit', () => {
    expect(buildReservationCancelledText({ ...data, depositOutcome: 'captured', depositAmountCents: 1200 })).toContain('se ha cobrado la fianza de 12,00 €')
    expect(buildReservationCancelledText({ ...data, depositOutcome: 'released', depositAmountCents: 1200 })).toContain('se ha liberado')
    expect(buildReservationCancelledText(data)).not.toContain('fianza')
  })
})
