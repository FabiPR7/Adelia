import type { User } from 'firebase/auth'
import gourmetPhoto from '../assets/promo-card-gourmet.webp'
import dessertPhoto from '../assets/promo-card-dessert.webp'
import diningPhoto from '../assets/promo-hero-dining.webp'
import profilePhoto from '../assets/landing-card-profile.webp'
import { defaultMenuTemplate } from './menuTemplates'
import { DEFAULT_MENU_CATEGORY_AVAILABILITY } from '../utils/menuCategoryAvailability'
import { defaultSchedule } from '../utils/helpers'
import { defaultCompanyQrBranding } from '../utils/qrBranding'
import { getWeekKey } from '../utils/gamificationProgress'
import { defaultGamificationState } from '../types/gamification'
import {
  defaultCompanyEmailTemplates,
  defaultTurns,
  type CompanyPromotion,
  type FloorPlan,
  type MenuBoard,
  type MenuNode,
  type PromotionPinSettings,
  type RestaurantTable,
} from '../types/company'
import type { AppUser, Company, CompanyClient, Reservation } from '../types'
import type { CompanyReview } from '../types/review'
import type { CompanyNotification } from '../types/companyNotifications'
import type { CompanyGamificationState, CompanyRankingEntry } from '../types/companyGamification'
import type { VerifiedConsumptionRecord } from '../types/verifiedConsumption'
import type { CompanyBillingStatus } from '../services/companyBilling'
import type { CompanyStripeStatus } from '../services/companyStripe'
import {
  getCompanyLevelForXp,
  getCompanyXpToNext,
} from './companyGamificationCatalog'

export const DEMO_COMPANY_ID = 'adelia-demo-company-panel'
export const DEMO_COMPANY_SLUG = 'la-terraza-de-chamberi'
export const COMPANY_DEMO_READ_ONLY_ERROR = 'Esta vista de ejemplo es de solo lectura.'

let demoSessionCount = 0

export function enterCompanyDemoSession() {
  demoSessionCount += 1
}

export function leaveCompanyDemoSession() {
  demoSessionCount = Math.max(0, demoSessionCount - 1)
}

export function isCompanyDemoSession() {
  return demoSessionCount > 0
}

export function isDemoCompanyId(id: string | null | undefined) {
  return id === DEMO_COMPANY_ID
}

export function rejectIfDemoCompanyWrite(companyId?: string | null): void {
  if (isDemoCompanyId(companyId) || isCompanyDemoSession()) {
    throw new Error(COMPANY_DEMO_READ_ONLY_ERROR)
  }
}

const FLOOR_TERRAZA = 'fp-terraza'
const FLOOR_SALON = 'fp-salon'
const FLOOR_BARRA = 'fp-barra'
const BOARD_CARTA = 'board-carta'
const BOARD_VINOS = 'board-vinos'
const PROMO_POSTRE = 'promo-postre'
const PROMO_MEDIODIA = 'promo-mediodia'
const PROMO_COPA = 'promo-copa'

const CLIENTS = [
  { name: 'Lucía Navarro', email: 'lucia.navarro@correo.demo', phone: '+34 612 000 111' },
  { name: 'Martín Soto', email: 'martin.soto@correo.demo', phone: '+34 622 000 222' },
  { name: 'Ana Belmonte', email: 'ana.belmonte@correo.demo', phone: '+34 633 000 333' },
  { name: 'Hugo Vidal', email: 'hugo.vidal@correo.demo', phone: '+34 644 000 444' },
  { name: 'Elena Ruiz', email: 'elena.ruiz@correo.demo', phone: '+34 655 000 555' },
  { name: 'Pablo Cano', email: 'pablo.cano@correo.demo', phone: '+34 666 000 666' },
  { name: 'Nuria Gil', email: 'nuria.gil@correo.demo', phone: '+34 677 000 777' },
  { name: 'Iván Romero', email: 'ivan.romero@correo.demo', phone: '+34 688 000 888' },
  { name: 'Clara Méndez', email: 'clara.mendez@correo.demo', phone: '+34 699 000 999' },
  { name: 'Diego Pardo', email: 'diego.pardo@correo.demo', phone: '+34 611 000 000' },
  { name: 'Sofía Herrera', email: 'sofia.herrera@correo.demo', phone: '+34 612 111 000' },
  { name: 'Andrés Molina', email: 'andres.molina@correo.demo', phone: '+34 613 222 000' },
] as const

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function atDay(dayOffset: number, hour: number, minute: number) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minute, 0, 0)
  return date
}

export function getDemoAuthUser(): User {
  return {
    uid: 'adelia-demo-owner',
    email: 'terraza@adelia.demo',
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
  } as unknown as User
}

export function getDemoProfile(): AppUser {
  return {
    email: 'terraza@adelia.demo',
    role: 'company',
    companyId: DEMO_COMPANY_ID,
    displayName: 'La Terraza de Chamberí',
    favoriteSlugs: [],
    gamification: defaultGamificationState(),
    mustChangePassword: false,
    mustChangePasswordCleared: true,
    createdAt: new Date('2024-03-12T10:00:00'),
    phone: '+34 910 001 122',
    phoneVerified: true,
    photoUrl: profilePhoto,
    homeCity: 'Madrid',
    homeMunicipality: 'Madrid',
    homeCountry: 'España',
    homePostalCode: '28010',
    homeLatitude: 40.4328,
    homeLongitude: -3.7011,
    foodPreferences: [],
    onboardingCompleted: true,
    authProvider: 'password',
    blocked: false,
  }
}

function demoFloorPlans(): FloorPlan[] {
  return [
    {
      id: FLOOR_TERRAZA,
      name: 'Terraza',
      enabled: true,
      backgroundColor: '#6b2424',
      backgroundImageUrl: '',
      floorStyle: 'wood',
      canvasWidth: 640,
      canvasHeight: 480,
      tablePositions: [
        { tableKey: 'tbl-t1', x: 22, y: 32, width: 14, height: 12, variant: 'round' },
        { tableKey: 'tbl-t3', x: 48, y: 28, width: 14, height: 12, variant: 'round' },
        { tableKey: 'tbl-t4', x: 74, y: 36, width: 16, height: 14 },
        { tableKey: 'tbl-t5', x: 36, y: 68, width: 14, height: 12, variant: 'round' },
      ],
      elements: [
        { id: 'el-t-wall', type: 'wall', x: 8, y: 10, width: 84, height: 6 },
        { id: 'el-t-window', type: 'window', x: 50, y: 10, width: 22, height: 6 },
      ],
    },
    {
      id: FLOOR_SALON,
      name: 'Salón',
      enabled: true,
      backgroundColor: '#6b2424',
      backgroundImageUrl: '',
      floorStyle: 'wine',
      canvasWidth: 640,
      canvasHeight: 480,
      tablePositions: [
        { tableKey: 'tbl-v2', x: 18, y: 24, width: 16, height: 14 },
        { tableKey: 'tbl-s2', x: 42, y: 28, width: 16, height: 14 },
        { tableKey: 'tbl-s4', x: 68, y: 30, width: 18, height: 16 },
        { tableKey: 'tbl-s7', x: 28, y: 58, width: 16, height: 14 },
        { tableKey: 'tbl-s9', x: 54, y: 62, width: 16, height: 14 },
        { tableKey: 'tbl-p1', x: 80, y: 70, width: 18, height: 16 },
      ],
      elements: [
        { id: 'el-s-wall', type: 'wall', x: 6, y: 8, width: 8, height: 70 },
        { id: 'el-s-door', type: 'door', x: 50, y: 90, width: 14, height: 8 },
      ],
    },
    {
      id: FLOOR_BARRA,
      name: 'Barra',
      enabled: true,
      backgroundColor: '#6b2424',
      backgroundImageUrl: '',
      floorStyle: 'slate',
      canvasWidth: 640,
      canvasHeight: 400,
      tablePositions: [{ tableKey: 'tbl-b1', x: 28, y: 55, width: 16, height: 12 }],
      elements: [{ id: 'el-b-bar', type: 'bar', x: 52, y: 38, width: 36, height: 14 }],
    },
  ]
}

export function getDemoTables(): RestaurantTable[] {
  return [
    { id: 'tbl-t1', companyId: DEMO_COMPANY_ID, name: 'Terraza 1', capacity: 2, sortOrder: 1, floorPlanId: FLOOR_TERRAZA },
    { id: 'tbl-t3', companyId: DEMO_COMPANY_ID, name: 'Terraza 3', capacity: 2, sortOrder: 2, floorPlanId: FLOOR_TERRAZA },
    { id: 'tbl-t4', companyId: DEMO_COMPANY_ID, name: 'Terraza 4', capacity: 4, sortOrder: 3, floorPlanId: FLOOR_TERRAZA },
    { id: 'tbl-t5', companyId: DEMO_COMPANY_ID, name: 'Terraza 5', capacity: 2, sortOrder: 4, floorPlanId: FLOOR_TERRAZA },
    { id: 'tbl-v2', companyId: DEMO_COMPANY_ID, name: 'Ventana 2', capacity: 4, sortOrder: 5, floorPlanId: FLOOR_SALON },
    { id: 'tbl-s2', companyId: DEMO_COMPANY_ID, name: 'Salón 2', capacity: 4, sortOrder: 6, floorPlanId: FLOOR_SALON },
    { id: 'tbl-s4', companyId: DEMO_COMPANY_ID, name: 'Salón 4', capacity: 6, sortOrder: 7, floorPlanId: FLOOR_SALON },
    { id: 'tbl-s7', companyId: DEMO_COMPANY_ID, name: 'Salón 7', capacity: 4, sortOrder: 8, floorPlanId: FLOOR_SALON },
    { id: 'tbl-s9', companyId: DEMO_COMPANY_ID, name: 'Salón 9', capacity: 4, sortOrder: 9, floorPlanId: FLOOR_SALON },
    { id: 'tbl-p1', companyId: DEMO_COMPANY_ID, name: 'Privado', capacity: 8, sortOrder: 10, floorPlanId: FLOOR_SALON },
    { id: 'tbl-b1', companyId: DEMO_COMPANY_ID, name: 'Barra 1', capacity: 2, sortOrder: 11, floorPlanId: FLOOR_BARRA },
  ]
}

export function getDemoCompany(): Company {
  const floorPlans = demoFloorPlans()
  const emails = defaultCompanyEmailTemplates()
  emails.received.introMessage =
    'Hola {nombre}, hemos recibido tu reserva en La Terraza de Chamberí. Te confirmamos en cuanto revisemos la mesa.'
  emails.confirmation.introMessage =
    'Hola {nombre}, tu mesa ya está confirmada. Te esperamos en Trafalgar 22.'

  const schedule = defaultSchedule()
  schedule.wednesday = {
    open: '13:00',
    close: '23:00',
    active: true,
    periods: [{ open: '13:00', close: '23:00' }],
  }

  return {
    id: DEMO_COMPANY_ID,
    name: 'La Terraza de Chamberí',
    slug: DEMO_COMPANY_SLUG,
    ownerUid: 'adelia-demo-owner',
    phone: '+34 910 001 122',
    website: 'https://www.laterrazadechamberi.demo',
    location: 'Calle de Trafalgar 22, Madrid',
    municipality: 'Madrid',
    country: 'España',
    postalCode: '28010',
    latitude: 40.4328,
    longitude: -3.7011,
    description:
      'Cocina de mercado y terraza al atardecer en Chamberí. Reservas desde el plano, carta digital y mesas para grupos.',
    contactEmail: 'terraza@adelia.demo',
    logoUrl: profilePhoto,
    photos: [profilePhoto, diningPhoto, gourmetPhoto, dessertPhoto],
    mainPhotoIndex: 0,
    videos: [],
    characteristics: ['Cocina mediterránea', 'Producto de mercado', 'Terraza'],
    venueTypes: ['restaurant', 'bistro'],
    amenities: [
      'terrace',
      'wifi',
      'card',
      'bizum',
      'kids_friendly',
      'group_tables',
      'private_rooms',
      'air_conditioning',
    ],
    priceRange: '2',
    timeSlotMinutes: 90,
    reservationMode: 'optional',
    depositMinPax: 6,
    depositPerGuestCents: 1500,
    depositEnabled: true,
    depositCancellationHours: 24,
    schedule,
    turns: defaultTurns(),
    floorPlan: floorPlans[0],
    floorPlans,
    emailTemplates: emails,
    qrBranding: defaultCompanyQrBranding(),
    reviewCount: 5,
    reviewRatingSum: 23,
    reviewAdelinas: 38,
    stripeAccountId: 'acct_demo_terraza',
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    stripeDetailsSubmitted: true,
    planId: 'premium',
    planBilling: 'monthly',
    planStartedAt: new Date('2026-03-01T10:00:00'),
    planLastPaidAt: new Date('2026-08-01T10:00:00'),
    pendingPlanId: null,
    pendingPlanAt: null,
    discoveryFeatured: true,
    deactivated: false,
    deactivatedAt: null,
    createdAt: new Date('2024-03-12T10:00:00'),
  }
}

let cachedReservations: Reservation[] | null = null

export function getDemoReservations(): Reservation[] {
  if (cachedReservations) {
    return cachedReservations
  }

  const tables = getDemoTables()
  const rows: Reservation[] = []
  let n = 0
  const lunchSlots = [
    [13, 15],
    [13, 45],
    [14, 30],
  ] as const
  const dinnerSlots = [
    [20, 30],
    [21, 0],
    [21, 30],
  ] as const

  for (let offset = -42; offset <= 8; offset += 1) {
    const slots = offset % 2 === 0 ? [...lunchSlots, dinnerSlots[0]] : [...dinnerSlots, lunchSlots[0]]
    const count = offset < 0 ? 3 : offset === 0 ? 4 : 2

    for (let i = 0; i < count; i += 1) {
      const slot = slots[i % slots.length]
      const client = CLIENTS[n % CLIENTS.length]
      const table = tables[n % tables.length]
      const startTime = atDay(offset, slot[0], slot[1])
      const endTime = new Date(startTime.getTime() + 90 * 60 * 1000)
      const cancelled = offset < 0 && n % 13 === 0
      const status: Reservation['status'] = offset < 0 ? (cancelled ? 'cancelled' : 'completed') : 'confirmed'
      const promo = n % 7 === 0 ? PROMO_POSTRE : n % 5 === 0 ? PROMO_MEDIODIA : n % 9 === 0 ? PROMO_COPA : null

      rows.push({
        id: `demo-r-${n}`,
        companyId: DEMO_COMPANY_ID,
        tableId: table.id,
        clientName: client.name,
        clientEmail: client.email,
        clientPhone: client.phone,
        pax: Math.min(table.capacity, 2 + (n % 4)),
        notes: n % 8 === 0 ? 'Aniversario' : n % 11 === 0 ? 'Alérgico a frutos secos' : '',
        startTime,
        endTime,
        status,
        cancelToken: `demo-cancel-${n}`,
        createdAt: new Date(startTime.getTime() - 36 * 60 * 60 * 1000),
        customerUid: `demo-customer-${n % CLIENTS.length}`,
        promotionId: promo,
        promotionVisitStatus: status === 'completed' ? 'eligible' : status === 'cancelled' ? 'not_eligible' : 'pending',
      })
      n += 1
    }
  }

  cachedReservations = rows
  return rows
}

export function filterDemoReservations(options?: {
  from?: Date
  to?: Date
  clientEmail?: string
}): Reservation[] {
  const email = options?.clientEmail?.trim().toLowerCase() ?? ''
  return getDemoReservations().filter((row) => {
    if (email && row.clientEmail.trim().toLowerCase() !== email) {
      return false
    }
    const time = row.startTime.getTime()
    if (options?.from && time < options.from.getTime()) {
      return false
    }
    if (options?.to && time >= options.to.getTime()) {
      return false
    }
    return true
  })
}

export function getDemoClients(): CompanyClient[] {
  const reservations = getDemoReservations()
  return CLIENTS.map((client) => {
    const visits = reservations.filter((row) => row.clientEmail === client.email)
    const dates = visits.map((row) => row.startTime).sort((a, b) => a.getTime() - b.getTime())
    const first = dates[0] ?? new Date()
    const last = dates[dates.length - 1] ?? first
    return {
      id: client.email,
      email: client.email,
      name: client.name,
      phone: client.phone,
      firstReservationDate: first,
      lastReservationDate: last,
      reservationCount: visits.length,
      createdAt: first,
      updatedAt: last,
    }
  }).sort((a, b) => b.lastReservationDate.getTime() - a.lastReservationDate.getTime())
}

function menuNode(
  id: string,
  boardId: string,
  nodeType: MenuNode['nodeType'],
  parentId: string | null,
  sortOrder: number,
  name: string,
  extras: Partial<MenuNode> = {},
): MenuNode {
  const now = new Date('2026-04-01T10:00:00')
  return {
    id,
    companyId: DEMO_COMPANY_ID,
    boardId,
    nodeType,
    parentId,
    sortOrder,
    name,
    description: extras.description ?? '',
    allergens: extras.allergens ?? [],
    priceCents: extras.priceCents ?? null,
    priceCurrency: extras.priceCurrency ?? 'EUR',
    photoUrl: extras.photoUrl ?? '',
    active: extras.active ?? true,
    availability: extras.availability ?? { ...DEFAULT_MENU_CATEGORY_AVAILABILITY },
    createdAt: now,
    updatedAt: now,
  }
}

export function getDemoMenuBoards(): MenuBoard[] {
  const now = new Date('2026-04-01T10:00:00')
  const cartaTemplate = { ...defaultMenuTemplate(), showPhotos: true, layout: 'list' as const }
  const wineTemplate = { ...defaultMenuTemplate(), templateId: 'classic-cream', showPhotos: false }

  return [
    {
      id: BOARD_CARTA,
      companyId: DEMO_COMPANY_ID,
      name: 'Carta de temporada',
      active: true,
      sortOrder: 0,
      template: cartaTemplate,
      pdfUrl: '',
      pdfFileName: '',
      pdfPages: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: BOARD_VINOS,
      companyId: DEMO_COMPANY_ID,
      name: 'Carta de vinos',
      active: true,
      sortOrder: 1,
      template: wineTemplate,
      pdfUrl: '',
      pdfFileName: '',
      pdfPages: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function getDemoMenuNodes(boardId?: string): MenuNode[] {
  const nodes: MenuNode[] = [
    menuNode('fam-ent', BOARD_CARTA, 'family', null, 0, 'Entrantes'),
    menuNode('prod-tartar', BOARD_CARTA, 'product', 'fam-ent', 0, 'Tartar de atún', {
      description: 'Atún rojo, aguacate y cítricos.',
      priceCents: 1850,
      photoUrl: gourmetPhoto,
      allergens: ['Pescado'],
    }),
    menuNode('prod-croquetas', BOARD_CARTA, 'product', 'fam-ent', 1, 'Croquetas de rabo', {
      description: 'Cremosas, ración de 6.',
      priceCents: 1200,
      photoUrl: diningPhoto,
      allergens: ['Gluten', 'Lactosa'],
    }),
    menuNode('fam-pri', BOARD_CARTA, 'family', null, 1, 'Principales'),
    menuNode('prod-lubina', BOARD_CARTA, 'product', 'fam-pri', 0, 'Lubina a la brasa', {
      description: 'Con verduras de temporada.',
      priceCents: 2400,
      photoUrl: gourmetPhoto,
      allergens: ['Pescado'],
    }),
    menuNode('prod-arroz', BOARD_CARTA, 'product', 'fam-pri', 1, 'Arroz de setas', {
      description: 'Boletus y parmesano.',
      priceCents: 1900,
      photoUrl: diningPhoto,
      allergens: ['Lactosa'],
    }),
    menuNode('fam-pos', BOARD_CARTA, 'family', null, 2, 'Postres'),
    menuNode('prod-tarta', BOARD_CARTA, 'product', 'fam-pos', 0, 'Tarta de queso', {
      description: 'Al horno, con arándanos.',
      priceCents: 850,
      photoUrl: dessertPhoto,
      allergens: ['Lactosa', 'Huevo'],
    }),
    menuNode('prod-sorbete', BOARD_CARTA, 'product', 'fam-pos', 1, 'Sorbete de limón', {
      priceCents: 600,
      photoUrl: dessertPhoto,
    }),
    menuNode('fam-tintos', BOARD_VINOS, 'family', null, 0, 'Tintos'),
    menuNode('prod-rioja', BOARD_VINOS, 'product', 'fam-tintos', 0, 'Rioja crianza', {
      description: 'Copa o botella.',
      priceCents: 420,
    }),
    menuNode('fam-blancos', BOARD_VINOS, 'family', null, 1, 'Blancos'),
    menuNode('prod-verdejo', BOARD_VINOS, 'product', 'fam-blancos', 0, 'Verdejo Rueda', {
      priceCents: 380,
    }),
  ]

  return boardId ? nodes.filter((node) => node.boardId === boardId) : nodes
}

export function getDemoPromotions(): CompanyPromotion[] {
  const now = new Date()
  return [
    {
      id: PROMO_POSTRE,
      companyId: DEMO_COMPANY_ID,
      type: 'reservation_ladder',
      title: 'Postre de la casa a las 3 reservas',
      description: 'Al acumular 3 reservas confirmadas, el postre es cortesía.',
      photoUrl: dessertPhoto,
      offer: {
        kind: 'free_item',
        bundleGet: null,
        bundlePay: null,
        discountPercent: null,
        fixedPriceCents: null,
        customLabel: 'Postre de la casa',
      },
      productRefs: [{ nodeId: 'prod-tarta', name: 'Tarta de queso', photoUrl: dessertPhoto }],
      active: true,
      requiresReservation: true,
      requiredReservations: 3,
      minimumSpendEnabled: false,
      minimumSpendCents: null,
      activeFromTime: '13:00',
      activeToTime: '23:30',
      maxRedemptions: 40,
      currentRedemptions: 18,
      arrivalWindowMinutes: null,
      createdAt: new Date(now.getTime() - 20 * 86400000),
      updatedAt: now,
    },
    {
      id: PROMO_MEDIODIA,
      companyId: DEMO_COMPANY_ID,
      type: 'time_limited',
      title: '−20 % de 13:00 a 16:00',
      description: 'Mediodía entre semana. 12 cupos diarios.',
      photoUrl: diningPhoto,
      offer: {
        kind: 'discount',
        bundleGet: null,
        bundlePay: null,
        discountPercent: 20,
        fixedPriceCents: null,
        customLabel: '',
      },
      productRefs: [],
      active: true,
      requiresReservation: true,
      requiredReservations: null,
      minimumSpendEnabled: true,
      minimumSpendCents: 2500,
      activeFromTime: '13:00',
      activeToTime: '16:00',
      maxRedemptions: 12,
      currentRedemptions: 7,
      arrivalWindowMinutes: null,
      createdAt: new Date(now.getTime() - 12 * 86400000),
      updatedAt: now,
    },
    {
      id: PROMO_COPA,
      companyId: DEMO_COMPANY_ID,
      type: 'attendance',
      title: 'Copa de bienvenida si llegas a tiempo',
      description: 'Presentarse en los 10 minutos de la reserva.',
      photoUrl: gourmetPhoto,
      offer: {
        kind: 'custom',
        bundleGet: null,
        bundlePay: null,
        discountPercent: null,
        fixedPriceCents: null,
        customLabel: 'Copa de bienvenida',
      },
      productRefs: [],
      active: true,
      requiresReservation: true,
      requiredReservations: null,
      minimumSpendEnabled: false,
      minimumSpendCents: null,
      activeFromTime: '20:00',
      activeToTime: '23:30',
      maxRedemptions: null,
      currentRedemptions: 31,
      arrivalWindowMinutes: 10,
      createdAt: new Date(now.getTime() - 8 * 86400000),
      updatedAt: now,
    },
  ]
}

export function getDemoReviews(): CompanyReview[] {
  return [
    {
      id: 'rev-1',
      companyId: DEMO_COMPANY_ID,
      reservationId: 'demo-r-2',
      customerUid: 'demo-customer-0',
      customerName: 'Lucía Navarro',
      rating: 5,
      comment: 'La terraza al atardecer y el tartar, impecables. Reservar mesa desde el plano es un acierto.',
      hasPhoto: true,
      mediaItems: [{ url: diningPhoto, type: 'image' }],
      taggedProducts: [{ nodeId: 'prod-tartar', boardId: BOARD_CARTA, name: 'Tartar de atún' }],
      taggedPromotions: [],
      adelinasEarned: 7,
      createdAt: atDay(-1, 15, 40),
      ownerReply: {
        text: 'Lucía, mil gracias. Reservamos terraza para vuestra próxima visita.',
        createdAt: atDay(-1, 16, 10),
      },
    },
    {
      id: 'rev-2',
      companyId: DEMO_COMPANY_ID,
      reservationId: 'demo-r-5',
      customerUid: 'demo-customer-1',
      customerName: 'Martín Soto',
      rating: 4,
      comment: 'Muy buena atención. El unique fue la croqueta de rabo. Volveremos el viernes.',
      hasPhoto: false,
      mediaItems: [],
      taggedProducts: [{ nodeId: 'prod-croquetas', boardId: BOARD_CARTA, name: 'Croquetas de rabo' }],
      taggedPromotions: [],
      adelinasEarned: 4,
      createdAt: atDay(-2, 22, 15),
    },
    {
      id: 'rev-3',
      companyId: DEMO_COMPANY_ID,
      reservationId: 'demo-r-8',
      customerUid: 'demo-customer-2',
      customerName: 'Ana Belmonte',
      rating: 5,
      comment: 'Vinimos con niños y nos pusieron una mesa amplia al momento. Carta clara, con fotos.',
      hasPhoto: true,
      mediaItems: [{ url: gourmetPhoto, type: 'image' }],
      taggedProducts: [],
      taggedPromotions: [{ promotionId: PROMO_COPA, name: 'Copa de bienvenida si llegas a tiempo' }],
      adelinasEarned: 7,
      createdAt: atDay(-4, 16, 5),
      ownerReply: {
        text: 'Ana, qué alegría. Las tronas y la mesa amplia están siempre listas.',
        createdAt: atDay(-4, 17, 0),
      },
    },
    {
      id: 'rev-4',
      companyId: DEMO_COMPANY_ID,
      reservationId: 'demo-r-11',
      customerUid: 'demo-customer-4',
      customerName: 'Elena Ruiz',
      rating: 5,
      comment: 'El arroz de setas y el sorbete, justos. Ambiente de barrio con servicio de verdad.',
      hasPhoto: false,
      mediaItems: [],
      taggedProducts: [{ nodeId: 'prod-arroz', boardId: BOARD_CARTA, name: 'Arroz de setas' }],
      taggedPromotions: [],
      adelinasEarned: 5,
      createdAt: atDay(-6, 23, 0),
    },
    {
      id: 'rev-5',
      companyId: DEMO_COMPANY_ID,
      reservationId: 'demo-r-14',
      customerUid: 'demo-customer-9',
      customerName: 'Diego Pardo',
      rating: 4,
      comment: 'Cumpleaños en el privado: todo salió redondo. Solo pediría más tiempo entre platos.',
      hasPhoto: true,
      mediaItems: [{ url: dessertPhoto, type: 'image' }],
      taggedProducts: [{ nodeId: 'prod-tarta', boardId: BOARD_CARTA, name: 'Tarta de queso' }],
      taggedPromotions: [],
      adelinasEarned: 6,
      createdAt: atDay(-8, 23, 40),
    },
  ]
}

export function getDemoVerifiedConsumptions(): VerifiedConsumptionRecord[] {
  return getDemoReservations()
    .filter((row) => row.status === 'completed')
    .slice(0, 36)
    .map((row, index) => {
      const tartarQty = 1 + (index % 2)
      const dessertQty = index % 3 === 0 ? 2 : 1
      const lineItems = [
        {
          nodeId: 'prod-tartar',
          name: 'Tartar de atún',
          quantity: tartarQty,
          unitPriceCents: 1850,
          lineTotalCents: 1850 * tartarQty,
        },
        {
          nodeId: 'prod-tarta',
          name: 'Tarta de queso',
          quantity: dessertQty,
          unitPriceCents: 850,
          lineTotalCents: 850 * dessertQty,
        },
      ]
      const totalCents = lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0)
      return {
        id: `cons-${row.id}`,
        companyId: DEMO_COMPANY_ID,
        reservationId: row.id,
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        pax: row.pax,
        reservationStartTime: row.startTime,
        promotionId: row.promotionId ?? null,
        minimumSpendCents: 2500,
        mode: 'products' as const,
        totalCents,
        lineItems,
        verifiedAt: new Date(row.endTime.getTime() + 20 * 60 * 1000),
        meetsMinimumSpend: totalCents >= 2500,
      }
    })
}

export function getDemoNotifications(): CompanyNotification[] {
  const now = new Date()
  return [
    {
      id: 'note-1',
      type: 'review_received',
      title: 'Nueva reseña 5★',
      body: 'Lucía Navarro ha valorado el tartar y la terraza.',
      icon: '⭐',
      read: false,
      readAt: null,
      createdAt: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
      actionTab: 'clients-reviews',
      actionLabel: 'Ver reseña',
      data: {},
      dedupeKey: 'note-1',
    },
    {
      id: 'note-2',
      type: 'mission_completed',
      title: 'Misión casi lista',
      body: 'Te faltan 3 reservas para completar el reto semanal.',
      icon: '🎯',
      read: false,
      readAt: null,
      createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      actionTab: 'compite-missions',
      actionLabel: 'Ver misiones',
      data: {},
      dedupeKey: 'note-2',
    },
    {
      id: 'note-3',
      type: 'level_up',
      title: 'Subes al #3 local',
      body: 'Has adelantado a Barra Norte en el ranking de Madrid.',
      icon: '🏆',
      read: true,
      readAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString(),
      actionTab: 'compite-ranking',
      actionLabel: 'Ver ranking',
      data: {},
      dedupeKey: 'note-3',
    },
  ]
}

export function getDemoGamificationState(): CompanyGamificationState {
  return {
    xp: 2195,
    weekKey: getWeekKey(),
    monthKey: monthKey(),
    weeklyCompleted: [],
    monthlyCompleted: [],
    completedMissions: [],
    awardedReservationXpIds: [],
    awardedReviewXpIds: [],
    awardedReplyXpIds: [],
    lastCelebratedLevel: 5,
  }
}

export function getDemoGamificationSync() {
  const state = getDemoGamificationState()
  const level = getCompanyLevelForXp(state.xp)
  return {
    state,
    level,
    xpToNext: getCompanyXpToNext(state.xp, level),
  }
}

function rankingEntry(
  rank: number,
  companyId: string,
  name: string,
  municipality: string,
  xp: number,
  you = false,
): CompanyRankingEntry {
  const level = getCompanyLevelForXp(xp)
  return {
    companyId,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    logoUrl: '',
    municipality,
    country: 'España',
    xp,
    level: level.level,
    levelTitle: level.title,
    reviewAdelinas: Math.round(xp / 80),
    reviewCount: 8 + rank,
    averageRating: 4.6 - rank * 0.05,
    isYou: you,
    rank,
  }
}

export function getDemoRanking() {
  const you = rankingEntry(3, DEMO_COMPANY_ID, 'La Terraza de Chamberí', 'Madrid', 2195, true)
  const local = [
    rankingEntry(1, 'rk-lumbre', 'Casa Lumbre', 'Madrid', 2480),
    rankingEntry(2, 'rk-olivo', 'El Olivo Sur', 'Madrid', 2310),
    you,
    rankingEntry(4, 'rk-barra', 'Barra Norte', 'Madrid', 1980),
    rankingEntry(5, 'rk-canalla', 'Canalla Mar', 'Madrid', 1874),
  ]
  const world = [
    rankingEntry(1, 'rk-lumbre', 'Casa Lumbre', 'Madrid', 2480),
    rankingEntry(2, 'rk-olivo', 'El Olivo Sur', 'Sevilla', 2310),
    rankingEntry(3, 'rk-mar', 'Canalla Mar', 'Valencia', 2240),
    you,
    rankingEntry(5, 'rk-barra', 'Barra Norte', 'Bilbao', 1980),
  ]
  return {
    local,
    world,
    localRank: 3,
    worldRank: 4,
    municipality: 'Madrid',
    country: 'España',
  }
}

export function getDemoBillingStatus(): CompanyBillingStatus {
  return {
    configured: true,
    planId: 'premium',
    pendingPlanId: null,
    pendingPlanAt: null,
    currentPeriodEnd: '2026-09-01T10:00:00.000Z',
    hasSubscription: true,
    planBilling: 'monthly',
  }
}

export function getDemoStripeStatus(): CompanyStripeStatus {
  return {
    configured: true,
    stripeAccountId: 'acct_demo_terraza',
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    stripeDetailsSubmitted: true,
    readyForDeposits: true,
  }
}

export function getDemoPinSettings(): PromotionPinSettings {
  const now = new Date()
  return {
    code: '4821',
    rotation: 'weekly',
    nextRotationAt: new Date(now.getTime() + 4 * 86400000),
    lastRotatedAt: now,
    updatedAt: now,
  }
}

export function getDemoEmailPreview(kind: 'received' | 'confirmation') {
  const subject =
    kind === 'received'
      ? 'Hemos recibido tu reserva en La Terraza de Chamberí'
      : 'Reserva confirmada · La Terraza de Chamberí'
  const html = `
    <div style="font-family:Georgia,serif;color:#4a2f20;padding:24px">
      <h1 style="margin:0 0 12px">La Terraza de Chamberí</h1>
      <p>Hola Lucía, ${kind === 'received' ? 'hemos recibido tu reserva' : 'tu mesa ya está confirmada'}.</p>
      <p><strong>Mesa Terraza 3</strong> · 2 personas · hoy 13:30</p>
      <p style="color:#8b7355">Vista de ejemplo · no se envía ningún correo.</p>
    </div>
  `
  return { html, subject }
}
