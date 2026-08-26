import { describe, expect, it } from 'vitest'
import {
  consumptionAmountLabel,
  consumptionSourceLabel,
  filterConsumptionsForCustomer,
  sortConsumptionsByDateDesc,
} from '../customerConsumption'

describe('customer consumption labels', () => {
  it('shows verified consumption without a figure when skipped or zero', () => {
    expect(consumptionAmountLabel(0, 'total')).toBe('Consumo verificado')
    expect(consumptionAmountLabel(1200, 'skip')).toBe('Consumo verificado')
    expect(consumptionAmountLabel(2550, 'total')).toBe('25,50 €')
  })

  it('labels reservation vs walk-in origin', () => {
    expect(consumptionSourceLabel('reservation')).toBe('Con reserva')
    expect(consumptionSourceLabel('walk_in')).toBe('Sin reserva')
  })

  it('keeps only the customer rows ordered by date', () => {
    const rows = [
      { customerUid: 'me', verifiedAt: '2026-01-02T00:00:00.000Z' },
      { customerUid: 'other', verifiedAt: '2026-08-01T00:00:00.000Z' },
      { customerUid: 'me', verifiedAt: '2026-08-22T00:00:00.000Z' },
    ]

    expect(
      sortConsumptionsByDateDesc(filterConsumptionsForCustomer(rows, 'me')).map((row) => row.verifiedAt),
    ).toEqual(['2026-08-22T00:00:00.000Z', '2026-01-02T00:00:00.000Z'])
  })
})
