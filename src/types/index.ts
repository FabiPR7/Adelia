export type UserRole = 'admin' | 'company'

export interface DaySchedule {
  open: string
  close: string
  active: boolean
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
  mustChangePassword: boolean
  /** Firestore tiene mustChangePassword: false (ya cambió la suya). */
  mustChangePasswordCleared: boolean
  createdAt: Date
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
  description: string
  contactEmail: string
  logoUrl: string
  photos: string[]
  videos: string[]
  characteristics: string[]
  timeSlotMinutes: number
  schedule: CompanySchedule
  turns: import('./company').ServiceTurn[]
  floorPlan: import('./company').FloorPlan
  emailTemplates: import('./company').CompanyEmailTemplates
  createdAt: Date
}

export interface AdminCompany extends Company {
  loginName: string
  loginPassword: string
}

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed'

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
  phone: string
  website?: string
  password: string
}

export interface UpdateCompanyPayload {
  name?: string
  location?: string
  phone?: string
  website?: string
  password?: string
}

export type {
  CompanySettingsPayload,
  CompanyTab,
  ClientsSection,
  ReportsSection,
  SettingsSection,
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
  CompanyPromotion,
  PromotionInput,
} from './company'
export {
  SCHEDULE_DAY_KEYS,
  SCHEDULE_DAY_LABELS,
  SETTINGS_SECTIONS,
  CLIENTS_SECTIONS,
  REPORTS_SECTIONS,
  isReportsTab,
  DEFAULT_RECEIVED_EMAIL_TEMPLATE,
  DEFAULT_CONFIRMATION_EMAIL_TEMPLATE,
  defaultCompanyEmailTemplates,
  isClientsTab,
  isSettingsTab,
  FLOOR_PLAN_ELEMENT_LABELS,
  createFloorPlanElement,
  defaultFloorPlan,
  defaultTurns,
  getTableMapKey,
  syncFloorPlanWithTables,
  serializeFloorPlanForFirestore,
  PROMOTION_TYPE_LABELS,
  PROMOTION_TYPE_HINTS,
  defaultPromotionInput,
  validatePromotionInput,
} from './company'
