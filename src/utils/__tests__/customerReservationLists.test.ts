import { describe, expect, it } from 'vitest'
import type { Reservation } from '../../types'
import { splitCustomerReservations } from '../customerReservationLists'

const reservation = (id: string, day: number) => ({
  id,
  startTime: new Date(2026, 0, day),
}) as Reservation

describe('splitCustomerReservations', () => {
  it('shows email reservations but does not count them for missions when the account has its own', () => {
    const { all, forMissions } = splitCustomerReservations(
      [reservation('account', 2)],
      [reservation('email', 3)],
    )

    expect(all.map((row) => row.id)).toEqual(['email', 'account'])
    expect(forMissions.map((row) => row.id)).toEqual(['account'])
  })

  it('counts email reservations for missions when the account has none', () => {
    const { all, forMissions } = splitCustomerReservations([], [reservation('email', 3)])

    expect(all.map((row) => row.id)).toEqual(['email'])
    expect(forMissions.map((row) => row.id)).toEqual(['email'])
  })

  it('does not duplicate a reservation found both ways', () => {
    const { all } = splitCustomerReservations(
      [reservation('same', 2)],
      [reservation('same', 2), reservation('email', 1)],
    )

    expect(all.map((row) => row.id)).toEqual(['same', 'email'])
  })
})
