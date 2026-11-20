import { describe, expect, it } from 'vitest'
import { buildBookingRules, depositAmountCents, depositRuleFromCompany } from '../bookingRules.ts'

const local = { planId: 'premium', reservationMode: 'optional' }

describe('buildBookingRules', () => {
  it('con mesas y reserva opcional se puede reservar', () => {
    const rules = buildBookingRules(local, 3)
    expect(rules.canReserve).toBe(true)
    expect(rules.ctaLabel).toBe('Reservar mesa')
    expect(rules.note).toBe('Reserva opcional: también puedes venir sin mesa.')
    expect(rules.completePath).toBe('choose')
    expect(rules.walkInAllowed).toBe(true)
  })

  it('sin mesas no se puede reservar aunque lo admita', () => {
    const rules = buildBookingRules(local, 0)
    expect(rules.canReserve).toBe(false)
    expect(rules.ctaLabel).toBe('Sin reservas')
    expect(rules.note).toBe('Por ahora no acepta reservas por Adelia. Puedes ir sin reserva.')
  })

  it('solo con reserva', () => {
    const rules = buildBookingRules({ ...local, reservationMode: 'required' }, 2)
    expect(rules.reservationRequired).toBe(true)
    expect(rules.walkInAllowed).toBe(false)
    expect(rules.completePath).toBe('reserve')
    expect(rules.note).toBe('Este local trabaja solo con reserva.')
  })

  it('sin reservas', () => {
    const rules = buildBookingRules({ ...local, reservationMode: 'none' }, 5)
    expect(rules.canReserve).toBe(false)
    expect(rules.completePath).toBe('consume')
    expect(rules.note).toBe('No se aceptan reservas. Solo mesa libre.')
  })

  it('fianza: regla y si el local puede cobrarla', () => {
    const data = { ...local, depositMinPax: 2, depositPerGuestCents: 100, depositCancellationHours: 1 }
    expect(buildBookingRules(data, 1).deposit).toEqual({ fromPax: 2, perGuestCents: 100, cancellationHours: 1 })
    expect(buildBookingRules(data, 1).depositsReady).toBe(false)
    expect(buildBookingRules({ ...data, stripeAccountId: 'acct_1', stripeChargesEnabled: true }, 1).depositsReady).toBe(true)
    expect(buildBookingRules(data, 0).deposit).toBeNull()
  })
})

describe('depositRuleFromCompany', () => {
  it('apagada, sin datos o plan sin fianzas: no hay fianza', () => {
    const base = { ...local, depositMinPax: 2, depositPerGuestCents: 100 }
    expect(depositRuleFromCompany({ ...base, depositEnabled: false })).toBeNull()
    expect(depositRuleFromCompany({ ...base, depositPerGuestCents: 0 })).toBeNull()
    expect(depositRuleFromCompany({ ...base, planId: 'free' })).toBeNull()
  })

  it('importe según comensales', () => {
    const rule = depositRuleFromCompany({ ...local, depositMinPax: 4, depositPerGuestCents: 250 })
    expect(depositAmountCents(rule, 3)).toBe(0)
    expect(depositAmountCents(rule, 4)).toBe(1000)
    expect(depositAmountCents(null, 10)).toBe(0)
  })
})
