// Cada misión cuenta lo que dice su texto y respeta el objetivo de la base de datos.
import { describe, expect, it } from 'vitest'
import { HISTORICAL_MISSIONS, MONTHLY_MISSION_POOL, WEEKLY_MISSIONS } from '../missionsData.ts'
import { defaultGamificationState } from '../types.ts'
import type { Reservation, CustomerVerifiedConsumption } from '../engineSupport.ts'
import { buildMissionProgressList, type GamificationContext } from '../engine.ts'
import type { MissionDefinition } from '../types.ts'

// Algunas misiones solo existen en la base de datos: aquí se definen igual que allí.
const DB_ONLY: MissionDefinition[] = [
  { id: 'explorador_ciudad', name: 'Explora la ciudad', xp: 200, cadence: 'monthly', description: 'Visita 3 restaurantes distintos este mes', icon: '🗺️', target: 3 },
  { id: 'gourmet_reincidente', name: 'Gourmet reincidente', xp: 120, cadence: 'weekly', description: 'Completa 2 visitas esta semana', icon: '🍽️', target: 2 },
]
const ALL = [...WEEKLY_MISSIONS, ...MONTHLY_MISSION_POOL, ...HISTORICAL_MISSIONS, ...DB_ONLY]

function mission(id: string, target?: number): MissionDefinition {
  const found = ALL.find((item) => item.id === id)
  if (!found) throw new Error(`falta ${id}`)
  return target == null ? found : { ...found, target }
}

let seq = 0
function reservation(overrides: Partial<Reservation> = {}): Reservation {
  seq += 1
  const start = overrides.startTime ?? new Date()
  return {
    id: `r${seq}`,
    companyId: 'resto-1',
    tableId: 't1',
    clientName: 'Ana',
    clientEmail: 'ana@test.com',
    clientPhone: '600000000',
    pax: 2,
    notes: '',
    startTime: start,
    endTime: new Date(start.getTime() + 90 * 60000),
    status: 'confirmed',
    cancelToken: 'x',
    createdAt: new Date(start.getTime() - 60 * 60000),
    ...overrides,
  }
}

function walkIn(overrides: Partial<CustomerVerifiedConsumption> = {}): CustomerVerifiedConsumption {
  seq += 1
  const now = new Date().toISOString()
  return {
    id: `c${seq}`,
    companyId: 'resto-2',
    companyName: 'Bar',
    companySlug: 'bar',
    photoUrl: '',
    verifiedAt: now,
    visitAt: now,
    totalCents: 1500,
    mode: 'amount',
    source: 'walk_in',
    promotionId: null,
    promotionTitle: '',
    minimumSpendCents: 0,
    lineItems: [],
    meetsMinimumSpend: true,
    ...overrides,
  } as CustomerVerifiedConsumption
}

function ctx(overrides: Partial<GamificationContext> = {}): GamificationContext {
  return {
    reservations: [],
    consumptions: [],
    favoriteSlugs: [],
    promotionCompanyIds: new Set(),
    restaurantZones: new Map([['resto-1', 'Logroño'], ['resto-2', 'Logroño'], ['resto-3', 'Logroño']]),
    restaurantCategories: new Map(),
    restaurantVenueTypes: new Map([['resto-1', ['restaurant']], ['resto-2', ['bar']], ['resto-3', ['restaurant']]]),
    restaurantReservationModes: new Map([['resto-1', 'required'], ['resto-2', 'none'], ['resto-3', 'optional']]),
    weeklyFeaturedCategory: 'Tapas',
    ...overrides,
  }
}

function progressOf(definition: MissionDefinition, context: GamificationContext) {
  return buildMissionProgressList([definition], context, defaultGamificationState(), new Set())[0]
}

describe('reglas de las misiones', () => {
  it('una reserva pendiente o cancelada no cuenta como asistida', () => {
    const pending = progressOf(mission('reserva_confirmada_semana'), ctx({ reservations: [reservation({ status: 'pending' })] }))
    const cancelled = progressOf(mission('reserva_confirmada_semana'), ctx({ reservations: [reservation({ status: 'cancelled' })] }))
    const attended = progressOf(mission('reserva_confirmada_semana'), ctx({ reservations: [reservation()] }))
    expect(pending.completed).toBe(false)
    expect(cancelled.completed).toBe(false)
    expect(attended.completed).toBe(true)
  })

  it('el consumo sin reserva cuenta para su misión y no para la de reserva', () => {
    const context = ctx({ consumptions: [walkIn()] })
    expect(progressOf(mission('consumo_sin_reserva_semana'), context).completed).toBe(true)
    expect(progressOf(mission('reserva_confirmada_semana'), context).completed).toBe(false)
  })

  it('«solo con reserva» exige un local de reserva obligatoria', () => {
    expect(progressOf(mission('reserva_obligatoria_semana'), ctx({ reservations: [reservation({ companyId: 'resto-3' })] })).completed).toBe(false)
    expect(progressOf(mission('reserva_obligatoria_semana'), ctx({ reservations: [reservation({ companyId: 'resto-1' })] })).completed).toBe(true)
  })

  it('bar y restaurante distinguen el tipo de local', () => {
    const bar = ctx({ consumptions: [walkIn({ companyId: 'resto-2' })] })
    expect(progressOf(mission('visita_bar_semana'), bar).completed).toBe(true)
    expect(progressOf(mission('visita_restaurante_semana'), bar).completed).toBe(false)
  })

  it('«ticket de 30 €» exige 30 € o más', () => {
    expect(progressOf(mission('ticket_30_semana'), ctx({ consumptions: [walkIn({ totalCents: 2999 })] })).completed).toBe(false)
    expect(progressOf(mission('ticket_30_semana'), ctx({ consumptions: [walkIn({ totalCents: 3000 })] })).completed).toBe(true)
  })

  it('«mesa compartida» exige 3 o más personas', () => {
    const two = ctx({ reservations: [reservation({ pax: 2 }), reservation({ pax: 2 })] })
    const three = ctx({ reservations: [reservation({ pax: 3 }), reservation({ pax: 4 })] })
    expect(progressOf(mission('mesa_compartida_semana'), two).completed).toBe(false)
    expect(progressOf(mission('mesa_compartida_semana'), three).completed).toBe(true)
  })

  it('«Explora la ciudad» cuenta restaurantes distintos (aunque estén en la misma ciudad)', () => {
    const sameOne = ctx({ reservations: [reservation({ companyId: 'resto-1' }), reservation({ companyId: 'resto-1' }), reservation({ companyId: 'resto-1' })] })
    const three = ctx({ reservations: [reservation({ companyId: 'resto-1' }), reservation({ companyId: 'resto-3' })], consumptions: [walkIn({ companyId: 'resto-2' })] })
    expect(progressOf(mission('explorador_ciudad'), sameOne).completed).toBe(false)
    const result = progressOf(mission('explorador_ciudad'), three)
    expect(result.current).toBe(3)
    expect(result.completed).toBe(true)
  })

  it('respeta el objetivo que se ponga en el panel de administración', () => {
    const context = ctx({ reservations: [reservation(), reservation()] })
    expect(progressOf(mission('reservas_mes', 2), context).completed).toBe(true)
    expect(progressOf(mission('reservas_mes', 5), context).completed).toBe(false)
    expect(progressOf(mission('club_10_mesas', 2), context).completed).toBe(true)
  })

  it('las misiones de visitas cuentan reserva y consumo', () => {
    const context = ctx({ reservations: [reservation()], consumptions: [walkIn()] })
    const result = progressOf(mission('gourmet_reincidente'), context)
    expect(result.current).toBe(2)
    expect(result.completed).toBe(true)
  })

  it('el favorito y el gasto mínimo se reconocen', () => {
    expect(progressOf(mission('corazon_favorito'), ctx({ favoriteSlugs: ['carol'] })).completed).toBe(true)
    const minimum = ctx({ consumptions: [walkIn({ minimumSpendCents: 2000, meetsMinimumSpend: true })] })
    expect(progressOf(mission('gasto_minimo_semana'), minimum).completed).toBe(true)
  })
})
