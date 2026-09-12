import type { CustomerGamificationState } from './gamification'

export type UserRole = 'admin' | 'company' | 'customer'

export interface SchedulePeriod {
  open: string
  close: string
}

export interface DaySchedule {
  open: string
  close: string
  active: boolean
  periods: SchedulePeriod[]
}

export interface CompanySchedule {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}

export interface AppUser {
  email: string
  role: UserRole
  companyId: string | null
  displayName: string
  favoriteSlugs: string[]
  gamification: CustomerGamificationState
  mustChangePassword: boolean
  /** Firestore tiene mustChangePassword: false (ya cambió la suya). */
  mustChangePasswordCleared: boolean
  createdAt: Date
  phone: string
  phoneVerified: boolean
  photoUrl: string
  homeCity: string
  homeMunicipality: string
  homeCountry: string
  homePostalCode: string
  homeLatitude: number | null
  homeLongitude: number | null
  foodPreferences: string[]
  onboardingCompleted: boolean
  authProvider: 'password' | 'google.com'
  blocked: boolean
}

export interface Company {
  id: string
  name: string
  slug: string
  ownerUid: string
  phone: string
  website: string
  location: string
  municipality: string
  country: string
  postalCode: string
  latitude: number | null
  longitude: number | null
  description: string
  contactEmail: string
  logoUrl: string
  photos: string[]
  mainPhotoIndex: number
  videos: string[]
  characteristics: string[]
  venueTypes: string[]
  amenities: string[]
  priceRange: import('../data/companyProfileFacilities').CompanyPriceRange
  timeSlotMinutes: number
  /** Cómo acepta reservas el local: obligatorio, opcional o sin reservas. */
  reservationMode: import('../data/companyReservationMode').CompanyReservationMode
  depositMinPax: number | null
  depositPerGuestCents: number | null
  depositEnabled: boolean
  depositCancellationHours: number | null
  schedule: CompanySchedule
  turns: import('./company').ServiceTurn[]
  floorPlan: import('./company').FloorPlan
  floorPlans: import('./company').FloorPlan[]
  emailTemplates: import('./company').CompanyEmailTemplates
  qrBranding: import('./company').CompanyQrBranding
  reviewCount: number
  reviewRatingSum: number
  reviewAdelinas: number
  stripeAccountId: string | null
  stripeChargesEnabled: boolean
  stripePayoutsEnabled: boolean
  stripeDetailsSubmitted: boolean
  planId: import('../data/companyPlans').CompanyPlanId
  planBilling: import('../data/companyPlans').CompanyPlanBilling | null
  planStartedAt: Date | null
  planLastPaidAt: Date | null
  pendingPlanId: import('../data/companyPlans').CompanyPlanId | null
  pendingPlanAt: Date | null
  discoveryFeatured: boolean
  /** El dueño ha ocultado el restaurante: no aparece en descubrir ni acepta reservas. */
  deactivated: boolean
  deactivatedAt: Date | null
  createdAt: Date
}

export interface AdminCompany extends Company {
  loginName: string
}

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed'

export type ReservationDepositStatus = 'authorized' | 'captured' | 'released' | 'failed'

/** Si la visita cuenta hacia promos con gasto mínimo (lo valida el restaurante al confirmar). */
export type PromotionVisitStatus = 'pending' | 'eligible' | 'not_eligible' | 'n/a'

export interface ReservationMinSpendLineItem {
  nodeId: string
  name: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

export interface ReservationMinSpendVerification {
  mode: 'total' | 'products'
  totalCents: number
  lineItems: ReservationMinSpendLineItem[]
  verifiedAt: Date
  meetsMinimumSpend: boolean
}

export interface CompanyClient {
  id: string
  email: string
  name: string
  phone: string
  firstReservationDate: Date
  lastReservationDate: Date
  reservationCount: number
  createdAt: Date
  updatedAt: Date
}

export interface Reservation {
  id: string
  companyId: string
  tableId: string
  clientName: string
  clientEmail: string
  clientPhone: string
  pax: number
  notes: string
  startTime: Date
  endTime: Date
  status: ReservationStatus
  cancelToken: string
  createdAt: Date
  customerUid?: string | null
  promotionId?: string | null
  minimumSpendCents?: number | null
  promotionVisitStatus?: PromotionVisitStatus
  minSpendVerification?: ReservationMinSpendVerification
  depositAmountCents?: number | null
  depositPaymentIntentId?: string | null
  depositStatus?: ReservationDepositStatus | null
}

export interface ReservationFormData {
  clientName: string
  clientEmail: string
  clientPhone: string
  pax: number
  tableId: string
  time: string
  status: ReservationStatus
}

export interface CreateCompanyPayload {
  name: string
  location: string
  municipality?: string
  postalCode?: string
  country?: string
  phone: string
  contactEmail?: string
  website?: string
  password: string
  planId?: import('../data/companyPlans').CompanyPlanId
  planBilling?: import('../data/companyPlans').CompanyPlanBilling | null
  planStartedAt?: Date | null
  discoveryFeatured?: boolean
}

export interface UpdateCompanyPayload {
  name?: string
  location?: string
  municipality?: string
  postalCode?: string
  country?: string
  phone?: string
  contactEmail?: string
  website?: string
  password?: string
  planId?: import('../data/companyPlans').CompanyPlanId
  planBilling?: import('../data/companyPlans').CompanyPlanBilling | null
  planStartedAt?: Date | null
  planLastPaidAt?: Date | 'now' | 'clear'
  discoveryFeatured?: boolean
}

export type {
  CustomerGamificationState,
  GamificationLevel,
  MissionDefinition,
  MissionProgress,
} from './gamification'
export { defaultGamificationState } from './gamification'
export type {
  CompanyTab,
  ClientsSection,
  CompiteSection,
  ReportsSection,
  SettingsSection,
  CompanySettingsSection,
  CompanySettingsPayload,
  EmailTemplateKind,
  ReservationEmailTemplate,
  CompanyEmailTemplates,
  EmailHeaderStyle,
  EmailLayoutStyle,
  FloorPlan,
  FloorPlanElement,
  FloorPlanElementType,
  RestaurantTable,
  ServiceTurn,
  TableInput,
  PromotionType,
  PromotionPinRotation,
  PromotionPinSettings,
  PromotionOfferKind,
  PromotionOfferConfig,
  PromotionProductRef,
  CompanyPromotion,
  PromotionInput,
  MenuLayout,
  MenuNodeType,
  MenuCategoryAvailability,
  MenuTemplateConfig,
  MenuBoard,
  MenuBoardInput,
  MenuNode,
  MenuNodeInput,
} from './company'
export {
  hasMenuPdf,
  SCHEDULE_DAY_KEYS,
  SCHEDULE_DAY_LABELS,
  SETTINGS_SECTIONS,
  CLIENTS_SECTIONS,
  COMPITE_SECTIONS,
  REPORTS_SECTIONS,
  isReportsTab,
  isCompiteTab,
  DEFAULT_RECEIVED_EMAIL_TEMPLATE,
  DEFAULT_CONFIRMATION_EMAIL_TEMPLATE,
  defaultCompanyEmailTemplates,
  isClientsTab,
  isSettingsTab,
  isSettingsEditorTab,
  FLOOR_PLAN_ELEMENT_LABELS,
  createFloorPlanElement,
  defaultFloorPlan,
  createNamedFloorPlan,
  parseFloorPlans,
  primaryFloorPlan,
  areFloorPlansEnabled,
  enabledFloorPlans,
  tablesForFloorPlan,
  tableBelongsToFloorPlan,
  syncAllFloorPlans,
  withFloorPlans,
  serializeFloorPlansForFirestore,
  MAX_FLOOR_PLANS,
  MAX_FLOOR_PLAN_NAME_LENGTH,
  sanitizeFloorPlanName,
  defaultTurns,
  getTableMapKey,
  syncFloorPlanWithTables,
  serializeFloorPlanForFirestore,
  PROMOTION_TYPE_LABELS,
  PROMOTION_TYPE_HINTS,
  PROMOTION_OFFER_KIND_LABELS,
  PROMOTION_OFFER_KIND_HINTS,
  defaultPromotionInput,
  defaultPromotionOffer,
  validatePromotionInput,
  validatePromotionOfferConfig,
  defaultMenuNodeInput,
} from './company'
