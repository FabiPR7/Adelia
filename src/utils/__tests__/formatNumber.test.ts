import { describe, expect, it } from 'vitest'
import { formatNumber } from '../formatNumber'

describe('formatNumber', () => {
  it('pone punto de miles también con 4 cifras', () => {
    expect(formatNumber(2450)).toBe('2.450')
    expect(formatNumber(8171)).toBe('8.171')
    expect(formatNumber(-1320)).toBe('-1.320')
  })

  it('deja igual los pequeños y agrupa los grandes', () => {
    expect(formatNumber(860)).toBe('860')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1234567)).toBe('1.234.567')
  })

  it('mantiene los decimales con coma', () => {
    expect(formatNumber(2.5)).toBe('2,5')
    expect(formatNumber(1500.25)).toBe('1.500,25')
  })
})
