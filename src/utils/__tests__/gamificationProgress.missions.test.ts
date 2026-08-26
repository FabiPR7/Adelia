import { describe, expect, it } from 'vitest'
import { HISTORICAL_MISSIONS, WEEKLY_MISSIONS } from '../../data/gamificationMissions'
import { defaultGamificationState } from '../../types/gamification'
import type { Reservation } from '../../types'
import type { CustomerVerifiedConsumption } from '../../types/verifiedConsumption'
import {
  buildMissionProgressList,
  processGamificationRewards,
  rotateMonthlyMissions,
  rotateWeeklyMissions,
  syncGamificationPeriods,
  type GamificationContext,
} from '../gamificationProgress'

function reservation(overrides: Partial<Reservation>): Reservation {
  return {
    id: 'r1',
    companyId: 'resto-1',
    tableId: 't1',
    clientName: 'Ana',
    clientEmail: 'ana@test.com',
    clientPhone: '600000000',
    pax: 2,
    notes: '',
    startTime: new Date(),
    endTime: new Date(Date.now() + 90 * 60000),
    status: 'confirmed',
    cancelToken: 'x',
    createdAt: new Date(),
    ...overrides,
  }
}

function consumption(
  overrides: Partial<CustomerVerifiedConsumption> = {},
): CustomerVerifiedConsumption {
  const now = new Date().toISOString()
  return {
    id: 'c1',
    companyId: 'resto-1',
    companyName: 'Restaurante',
    companySlug: 'restaurante',
    photoUrl: '',
    verifiedAt: now,
    visitAt: now,
    totalCents: 3200,
    mode: 'products',
    source: 'walk_in',
    promotionId: 'promo-1',
    promotionTitle: 'Promo',
    minimumSpendCents: 2000,
    lineItems: [{ name: 'Tostada', quantity: 1, lineTotalCents: 3200 }],
    meetsMinimumSpend: true,
    ...overrides,
  }
}

function context(overrides: Partial<GamificationContext> = {}): GamificationContext {
  return {
    reservations: [],
    consumptions: [],
    favoriteSlugs: [],
    promotionCompanyIds: new Set(),
    restaurantZones: new Map(),
    restaurantCategories: new Map(),
    restaurantVenueTypes: new Map([['resto-1', ['bar']]]),
    restaurantReservationModes: new Map([['resto-1', 'optional']]),
    weeklyFeaturedCategory: 'Tapas',
    ...overrides,
  }
}

describe('customer weekly missions', () => {
  it('counts a confirmed reservation only for the booking mission', () => {
    const bookingMission = WEEKLY_MISSIONS.find(
      (mission) => mission.id === 'reserva_confirmada_semana',
    )
    const walkInMission = WEEKLY_MISSIONS.find(
      (mission) => mission.id === 'consumo_sin_reserva_semana',
    )
    expect(bookingMission).toBeTruthy()
    expect(walkInMission).toBeTruthy()

    const progress = buildMissionProgressList(
      [bookingMission!, walkInMission!],
      context({ reservations: [reservation({})] }),
      defaultGamificationState(),
      new Set(),
    )

    expect(progress[0]?.completed).toBe(true)
    expect(progress[1]?.completed).toBe(false)
  })

  it('does not complete weekly photo review from lifetime history after a week snapshot', () => {
    const photoMission = WEEKLY_MISSIONS.find((mission) => mission.id === 'critico_foto')
    expect(photoMission).toBeTruthy()

    const state = syncGamificationPeriods({
      ...defaultGamificationState(),
      reviewsWithPhotoCount: 4,
    })

    const [progress] = buildMissionProgressList(
      [photoMission!],
      context(),
      state,
      new Set(),
    )

    expect(progress.completed).toBe(false)
    expect(progress.current).toBe(0)
  })

  it('counts a verified walk-in only for the consumption mission', () => {
    const walkInMission = WEEKLY_MISSIONS.find((item) => item.id === 'consumo_sin_reserva_semana')
    const bookingMission = WEEKLY_MISSIONS.find((item) => item.id === 'reserva_confirmada_semana')
    expect(walkInMission).toBeTruthy()

    const progress = buildMissionProgressList(
      [walkInMission!, bookingMission!],
      context({ consumptions: [consumption()] }),
      defaultGamificationState(),
      new Set(),
    )

    expect(progress[0]?.completed).toBe(true)
    expect(progress[1]?.completed).toBe(false)
  })

  it('keeps min spend, products and bar as separate mechanics', () => {
    const spendMission = WEEKLY_MISSIONS.find((item) => item.id === 'gasto_minimo_semana')
    const productMission = WEEKLY_MISSIONS.find((item) => item.id === 'consumo_productos_semana')
    const barMission = WEEKLY_MISSIONS.find((item) => item.id === 'visita_bar_semana')
    const restaurantMission = WEEKLY_MISSIONS.find((item) => item.id === 'visita_restaurante_semana')

    const progress = buildMissionProgressList(
      [spendMission!, productMission!, barMission!, restaurantMission!],
      context({ consumptions: [consumption()] }),
      defaultGamificationState(),
      new Set(),
    )

    expect(progress.map((item) => `${item.mission.id}:${item.completed}`)).toEqual([
      'gasto_minimo_semana:true',
      'consumo_productos_semana:true',
      'visita_bar_semana:true',
      'visita_restaurante_semana:false',
    ])
  })

  it('shows only one visit challenge so one ticket cannot clear several weekly missions', () => {
    const missions = rotateWeeklyMissions(new Date('2026-08-25T12:00:00Z'), 6)
    const groups = missions.map((mission) => mission.rotationGroup)

    expect(missions).toHaveLength(6)
    expect(new Set(groups).size).toBe(groups.length)
    expect(groups.filter((group) => group === 'visit')).toHaveLength(1)
  })

  it('does not let one walk-in complete the 6 weekly missions on screen', () => {
    const missions = rotateWeeklyMissions(new Date('2026-08-25T12:00:00Z'), 6)
    const progress = buildMissionProgressList(
      missions,
      context({ consumptions: [consumption()] }),
      defaultGamificationState(),
      new Set(),
    )
    const completed = progress.filter((item) => item.completed)

    expect(completed.length).toBeLessThanOrEqual(1)
  })

  it('does not let one reservation complete five historical missions at once', () => {
    const progress = buildMissionProgressList(
      HISTORICAL_MISSIONS,
      context({
        reservations: [reservation({})],
        restaurantVenueTypes: new Map([['resto-1', ['restaurant']]]),
      }),
      defaultGamificationState(),
      new Set(),
    )
    const completed = progress.filter((item) => item.completed).map((item) => item.mission.id)

    expect(completed).toEqual(['debut_gastronomico'])
  })

  it('does not let one walk-in complete five historical missions at once', () => {
    const progress = buildMissionProgressList(
      HISTORICAL_MISSIONS,
      context({ consumptions: [consumption()] }),
      defaultGamificationState(),
      new Set(),
    )
    const completed = progress.filter((item) => item.completed).map((item) => item.mission.id)

    expect(completed).toEqual(['primer_consumo_libre'])
  })

  it('rotates monthly missions from distinct mechanic groups', () => {
    const missions = rotateMonthlyMissions(new Date('2026-08-01T12:00:00Z'), 5)
    const groups = missions.map((mission) => mission.rotationGroup)

    expect(missions).toHaveLength(5)
    expect(new Set(groups).size).toBe(groups.length)
  })

  it('does not duplicate reservation-backed consumptions and awards walk-in XP once', () => {
    const walkIn = consumption()
    const reservationConsumption = consumption({ id: 'c2', source: 'reservation' })
    const state = processGamificationRewards(
      defaultGamificationState(),
      [],
      [],
      [],
      [],
      [],
      [walkIn, reservationConsumption],
    )
    const repeated = processGamificationRewards(state, [], [], [], [], [], [walkIn])

    expect(state.xp).toBeGreaterThan(0)
    expect(state.awardedReservationXpIds).toContain('consumption:c1')
    expect(state.awardedReservationXpIds).not.toContain('consumption:c2')
    expect(repeated.xp).toBe(state.xp)
  })
})
