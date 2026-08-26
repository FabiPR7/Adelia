import { describe, expect, it } from 'vitest'
import { companyHealthScore, companyProfileHealth } from '../companyHealth'
import type { Company } from '../../types'

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    name: 'Pepe',
    slug: 'pepe',
    ownerUid: 'u1',
    phone: '600',
    website: '',
    location: 'Calle 1',
    municipality: 'Valencia',
    country: 'España',
    postalCode: '46001',
    latitude: null,
    longitude: null,
    description: 'Un local',
    contactEmail: '',
    logoUrl: 'https://example.com/logo.png',
    photos: ['https://example.com/1.jpg'],
    mainPhotoIndex: 0,
    videos: [],
    characteristics: [],
    venueTypes: [],
    amenities: [],
    priceRange: '',
    timeSlotMinutes: 120,
    reservationMode: 'optional',
    depositMinPax: null,
    depositPerGuestCents: null,
    depositEnabled: false,
    depositCancellationHours: null,
    schedule: {} as Company['schedule'],
    turns: [],
    floorPlan: {} as Company['floorPlan'],
    floorPlans: [],
    emailTemplates: {} as Company['emailTemplates'],
    qrBranding: {} as Company['qrBranding'],
    reviewCount: 2,
    reviewRatingSum: 8,
    reviewAdelinas: 4,
    stripeAccountId: 'acct',
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    stripeDetailsSubmitted: true,
    planId: 'basic',
    planBilling: 'monthly',
    planStartedAt: new Date(2026, 0, 10),
    planLastPaidAt: null,
    discoveryFeatured: false,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('companyHealth', () => {
  it('scores a complete local high', () => {
    const items = companyProfileHealth(company(), { menuBoards: 1 })
    expect(companyHealthScore(items)).toBe(100)
    expect(items.every((item) => item.ok)).toBe(true)
  })

  it('flags a Mesa without photos or carta', () => {
    const items = companyProfileHealth(company({
      photos: [],
      logoUrl: '',
      description: '',
      municipality: '',
      postalCode: '',
      stripeChargesEnabled: false,
      stripeDetailsSubmitted: false,
      reviewCount: 0,
    }), { menuBoards: 0 })
    expect(items.filter((item) => item.ok)).toHaveLength(0)
  })
})
