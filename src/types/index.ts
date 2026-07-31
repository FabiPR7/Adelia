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
  timeSlotMinutes: number
  schedule: CompanySchedule
  createdAt: Date
}

export interface AdminCompany extends Company {
  loginName: string
  loginPassword: string
}

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed'

export interface Reservation {
  id: string
  companyId: string
  tableId: string
  clientName: string
  clientEmail: string
  clientPhone: string
  pax: number
  startTime: Date
  endTime: Date
  status: ReservationStatus
  cancelToken: string
  createdAt: Date
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
