import { describe, expect, it } from 'vitest'
import { formatDateSpanish, formatTimeSpanish } from '../format.ts'

// Una reserva a las 21:30 de Madrid (CET, UTC+1) es 20:30 UTC. El servidor corre
// en UTC, y el correo tiene que decir la hora del restaurante, no la del servidor.
describe('email date formatting uses the restaurant time zone', () => {
  it('shows Madrid time in winter (UTC+1)', () => {
    expect(formatTimeSpanish(new Date('2026-11-10T20:30:00Z'))).toBe('21:30')
  })

  it('shows Madrid time in summer (UTC+2)', () => {
    expect(formatTimeSpanish(new Date('2026-07-10T19:30:00Z'))).toBe('21:30')
  })

  it('rolls the date over when Madrid is already past midnight', () => {
    expect(formatDateSpanish(new Date('2026-11-10T23:30:00Z'))).toContain('11 de noviembre')
  })
})
