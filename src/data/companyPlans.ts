export const COMPANY_PLANS_CONTACT_EMAIL = 'contacto@adeliareservas.com'

export type CompanyPlanId = 'free' | 'basic' | 'premium' | 'premium_plus'

export interface CompanyPlanSpec {
  label: string
  value: string
}

export interface CompanyPlan {
  id: CompanyPlanId
  name: string
  audience: string
  priceMonthly: number
  period: string
  /** Precio total del pago anual (con el descuento ya aplicado). */
  priceAnnual?: number
  /** Descuento del pago anual frente a 12 meses, p. ej. 20. */
  annualDiscountPercent?: number
  vatNote: string
  badge?: string
  /** Periodo de prueba, p. ej. "3 meses de prueba". Se muestra bajo el precio. */
  trialLabel?: string
  highlighted?: boolean
  comingSoon?: boolean
  includesPrevious?: string
  chips: string[]
  specs: CompanyPlanSpec[]
  features: string[]
  ctaLabel: string
}

export const COMPANY_PLANS: CompanyPlan[] = [
  {
    id: 'free',
    name: 'Mesa',
    audience: 'Para aparecer en Adelia y gestionar las reservas del día.',
    priceMonthly: 0,
    period: '',
    vatNote: 'Sin tarjeta · sin comisión por reserva',
    chips: ['1 carta', '8 mesas', 'Sin plano activo'],
    specs: [
      { label: 'Cartas', value: '1' },
      { label: 'Mesas', value: '8' },
      { label: 'Mapas', value: '—' },
      { label: 'Promos', value: '—' },
    ],
    features: [
      'Apareces en la web de Adelia: búsqueda y ficha pública del local',
      'Perfil: logo, hasta 5 fotos, descripción, características y mapa',
      'Reservas: calendario, altas manuales, estados y control de asistencia',
      'Correos automáticos de solicitud y de confirmación (plantilla Adelia)',
      'Enlace público de reservas y código QR para la puerta',
      'Consulta y respuesta de reseñas de tus clientes',
      '1 carta digital en lista, sin fotografías de platos ni PDF',
      'Hasta 8 mesas en listado: puedes dibujar un mapa, pero no activarlo',
    ],
    ctaLabel: 'Empezar con Mesa',
  },
  {
    id: 'basic',
    name: 'Sala',
    audience: 'Para digitalizar una sala pequeña y entender el negocio.',
    priceMonthly: 39.99,
    period: '/mes',
    priceAnnual: 375,
    vatNote: '+ IVA · sin comisión por reserva',
    includesPrevious: 'Incluye todo Mesa',
    chips: ['3 cartas', '15 mesas', '1 mapa', 'Excel', 'Fianzas'],
    specs: [
      { label: 'Cartas', value: '3' },
      { label: 'Mesas', value: '15' },
      { label: 'Mapas', value: '1' },
      { label: 'Promos', value: '3 Oferta' },
    ],
    features: [
      'Hasta 15 mesas y 1 mapa activo: el cliente elige mesa al reservar',
      '3 cartas con fotografías y disposición en lista o cuadrícula',
      'Importación Excel de productos de la carta',
      'QR de carta y de reservas con la imagen de tu local',
      'Hasta 3 promociones Oferta (premio por número de reservas)',
      'Ficha e historial de los clientes que te reservan',
      'Informes de reservas y de clientes',
      'Fianzas de reserva para asegurar tu mesa',
      'Correos de confirmación con tu marca y un bloque de promoción',
    ],
    ctaLabel: 'Contratar Sala',
  },
  {
    id: 'premium',
    name: 'Local',
    audience: 'El plan completo para un restaurante en funcionamiento.',
    priceMonthly: 59.99,
    period: '/mes',
    priceAnnual: 565,
    vatNote: '+ IVA · sin comisión por reserva',
    badge: 'Recomendado',
    trialLabel: '3 meses de prueba',
    highlighted: true,
    includesPrevious: 'Incluye todo Sala',
    chips: ['5 cartas', '50 mesas', '5 mapas', 'PDF y Excel', 'Compite'],
    specs: [
      { label: 'Cartas', value: '5' },
      { label: 'Mesas', value: '50' },
      { label: 'Mapas', value: '5' },
      { label: 'Promos', value: '5 de cada tipo' },
    ],
    features: [
      'Hasta 50 mesas y 5 mapas activos: el cliente elige mesa al reservar',
      'Hasta 5 cartas, digitales o en PDF, con fotos y todas las plantillas',
      'Importación Excel de productos y carta en PDF',
      'Hasta 5 promociones de cada tipo: Oferta, tiempo limitado y asistencia',
      'Todos los informes: reservas, clientes, productos y reseñas',
      'Compite: visibilidad, descuentos de la app y premios para el restaurante',
      'Mayor visibilidad en el descubrimiento de Adelia',
      'Vídeos en el perfil público',
    ],
    ctaLabel: 'Contratar Local',
  },
]

/** Plan retirado: se mantiene por si algún local lo tuviera asignado. */
const LEGACY_CASA_PLAN: CompanyPlan = {
  id: 'premium_plus',
  name: 'Casa',
  audience: 'Plan retirado.',
  priceMonthly: 79,
  period: '/mes',
  vatNote: '+ IVA',
  includesPrevious: 'Incluye todo Local',
  chips: ['Varios locales'],
  specs: [],
  features: [],
  ctaLabel: 'No disponible',
}

export function companyPlanMailto(plan: CompanyPlan): string {
  const subject = plan.comingSoon
    ? `Lista de espera · Adelia ${plan.name}`
    : `Alta empresa Adelia · plan ${plan.name}`
  const body = plan.comingSoon
    ? `Hola,\n\nQuiero apuntarme a la lista de espera del plan ${plan.name}.\n\nNombre del grupo:\nNúmero de locales:\nCiudad:\nTeléfono:\n\nGracias.`
    : `Hola,\n\nQuiero el plan ${plan.name} para mi restaurante.\n\nNombre del local:\nCiudad:\nTeléfono:\nNúmero aproximado de mesas:\n\nGracias.`

  return `mailto:${COMPANY_PLANS_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export const COMPANY_PLAN_IDS: CompanyPlanId[] = ['free', 'basic', 'premium', 'premium_plus']

export type CompanyPlanCapValue = boolean | number | 'unlimited' | 'list'

export interface CompanyPlanCapability {
  id: string
  label: string
  values: Record<CompanyPlanId, CompanyPlanCapValue>
}

export const COMPANY_PLAN_CAPABILITIES: CompanyPlanCapability[] = [
  {
    id: 'discovery',
    label: 'Aparecer en Adelia (búsqueda y ficha pública)',
    values: { free: true, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'profile',
    label: 'Perfil público con logo, fotos, descripción y mapa',
    values: { free: true, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'reservations',
    label: 'Reservas, calendario y altas manuales',
    values: { free: true, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'emails',
    label: 'Correos automáticos de solicitud y confirmación',
    values: { free: true, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'qr',
    label: 'Enlace público y QR de reservas',
    values: { free: true, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'reviews',
    label: 'Consulta y respuesta de reseñas',
    values: { free: true, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'menus',
    label: 'Cartas digitales',
    values: { free: 1, basic: 3, premium: 5, premium_plus: 5 },
  },
  {
    id: 'menu_photos',
    label: 'Fotos, plantillas y diseño en la carta',
    values: { free: false, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'excel',
    label: 'Importación Excel de la carta',
    values: { free: false, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'menu_pdf',
    label: 'Carta en PDF',
    values: { free: false, basic: false, premium: true, premium_plus: true },
  },
  {
    id: 'tables',
    label: 'Mesas',
    values: { free: 8, basic: 15, premium: 50, premium_plus: 50 },
  },
  {
    id: 'floor_plan',
    label: 'Planos de sala: el cliente elige mesa',
    values: { free: false, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'active_maps',
    label: 'Mapas activos al reservar',
    values: { free: false, basic: 1, premium: 5, premium_plus: 5 },
  },
  {
    id: 'qr_branded',
    label: 'QR con la imagen de tu local',
    values: { free: false, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'promos_offer',
    label: 'Promos Oferta (premio por número de reservas)',
    values: { free: false, basic: 3, premium: 5, premium_plus: 5 },
  },
  {
    id: 'promos_limited',
    label: 'Promos de tiempo limitado',
    values: { free: false, basic: false, premium: 5, premium_plus: 5 },
  },
  {
    id: 'clients',
    label: 'Ficha e historial de clientes',
    values: { free: false, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'reports',
    label: 'Informes y estadísticas',
    values: { free: false, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'branded_email',
    label: 'Correos de confirmación con tu marca',
    values: { free: false, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'promos_attendance',
    label: 'Promos de asistencia puntual',
    values: { free: false, basic: false, premium: 5, premium_plus: 5 },
  },
  {
    id: 'reports_advanced',
    label: 'Informes avanzados',
    values: { free: false, basic: false, premium: true, premium_plus: true },
  },
  {
    id: 'compite',
    label: 'Compite: visibilidad, descuentos y premios',
    values: { free: false, basic: false, premium: true, premium_plus: true },
  },
  {
    id: 'deposits',
    label: 'Fianzas de reserva',
    values: { free: false, basic: true, premium: true, premium_plus: true },
  },
  {
    id: 'videos',
    label: 'Vídeos en el perfil público',
    values: { free: false, basic: false, premium: true, premium_plus: true },
  },
  {
    id: 'multi_venue',
    label: 'Varios restaurantes bajo el mismo grupo',
    values: { free: false, basic: false, premium: false, premium_plus: true },
  },
  {
    id: 'team',
    label: 'Varios accesos para el equipo',
    values: { free: false, basic: false, premium: false, premium_plus: true },
  },
  {
    id: 'featured',
    label: 'Mayor visibilidad en el descubrimiento de Adelia',
    values: { free: false, basic: false, premium: true, premium_plus: true },
  },
  {
    id: 'priority',
    label: 'Atención prioritaria en alta y soporte',
    values: { free: false, basic: false, premium: false, premium_plus: true },
  },
]

export interface PlanCapabilityChange {
  id: string
  label: string
  fromLabel: string
  toLabel: string
}

export interface CompanyPlanComparison {
  direction: 'upgrade' | 'downgrade' | 'same'
  gained: PlanCapabilityChange[]
  lost: PlanCapabilityChange[]
}

export function parseCompanyPlanId(value: unknown): CompanyPlanId {
  return COMPANY_PLAN_IDS.includes(value as CompanyPlanId) ? (value as CompanyPlanId) : 'free'
}

export function isPaidCompanyPlan(plan: Pick<CompanyPlan, 'id' | 'priceMonthly'>): boolean {
  return plan.priceMonthly > 0 && (plan.id === 'basic' || plan.id === 'premium')
}

export const COMPANY_PLAN_BILLING_IDS = ['monthly', 'annual', 'perpetual'] as const
export type CompanyPlanBilling = (typeof COMPANY_PLAN_BILLING_IDS)[number]
export type CompanyPlanStartedAtWrite = 'now' | 'keep' | 'clear' | Date
export type MonthlyChargeState = 'future' | 'due' | 'overdue' | 'upcoming' | 'paid'

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseCompanyPlanBilling(
  value: unknown,
  planId: CompanyPlanId = parseCompanyPlanId(undefined),
): CompanyPlanBilling | null {
  if (planId === 'free') {
    return null
  }

  if (value === 'perpetual') return 'perpetual'
  if (value === 'annual') return 'annual'
  return 'monthly'
}

export function parseDateInput(value: string): Date | null {
  const match = DATE_ONLY.exec(value.trim())
  if (!match) {
    return null
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

export function dateToInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isAllowedMonthlyBillingDate(
  next: Date,
  current: Date | null = null,
  from = new Date(),
): boolean {
  const nextDay = startOfLocalDay(next).getTime()
  const today = startOfLocalDay(from).getTime()
  if (nextDay >= today) {
    return true
  }

  return current != null && startOfLocalDay(current).getTime() === nextDay
}

function addCalendarMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0, 0)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(date.getDate(), lastDay))
  return next
}

export function parseCompanyPlanStartedAt(value: unknown): Date | null {
  if (!value) {
    return null
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') {
      const date = toDate.call(value)
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
    }
  }

  if (typeof value === 'string') {
    const fromInput = parseDateInput(value)
    if (fromInput) {
      return fromInput
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

/** Último aniversario mensual en o antes de `from`. Si la fecha es futura, esa misma. */
export function currentMonthlyCycleDate(startedAt: Date, from = new Date()): Date {
  const start = startOfLocalDay(startedAt)
  const today = startOfLocalDay(from)
  if (start.getTime() > today.getTime()) {
    return start
  }

  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0)
  let next = addCalendarMonths(cursor, 1)
  while (startOfLocalDay(next).getTime() <= today.getTime()) {
    cursor = next
    next = addCalendarMonths(cursor, 1)
  }

  return startOfLocalDay(cursor)
}

export function nextMonthlyChargeDate(startedAt: Date, from = new Date()): Date {
  const today = startOfLocalDay(from)
  const cycle = currentMonthlyCycleDate(startedAt, from)
  if (cycle.getTime() >= today.getTime()) {
    return cycle
  }

  return startOfLocalDay(addCalendarMonths(cycle, 1))
}

export function monthlyChargeState(input: {
  startedAt: Date
  lastPaidAt: Date | null
  from?: Date
}): MonthlyChargeState {
  const from = input.from ?? new Date()
  const start = startOfLocalDay(input.startedAt)
  const today = startOfLocalDay(from)

  if (start.getTime() > today.getTime()) {
    return 'future'
  }

  const cycle = currentMonthlyCycleDate(input.startedAt, from)
  const paid = input.lastPaidAt ? startOfLocalDay(input.lastPaidAt) : null
  const paidThisCycle = paid != null && paid.getTime() >= cycle.getTime()

  if (paidThisCycle) {
    return 'paid'
  }

  if (cycle.getTime() === today.getTime()) {
    return 'due'
  }

  if (cycle.getTime() < today.getTime()) {
    return 'overdue'
  }

  return 'upcoming'
}

export function monthlyChargeLabel(state: MonthlyChargeState): string {
  if (state === 'future') {
    return 'Empieza más adelante'
  }
  if (state === 'due') {
    return 'Hoy toca cobrar'
  }
  if (state === 'overdue') {
    return 'Pendiente de cobro'
  }
  if (state === 'paid') {
    return 'Cobrado este ciclo'
  }
  return 'Próximo cobro'
}

export function formatCompanyPlanBilling(billing: CompanyPlanBilling | null): string {
  if (billing === 'perpetual') {
    return 'Perpetua'
  }

  if (billing === 'annual') {
    return 'Anual'
  }

  if (billing === 'monthly') {
    return 'Mensual'
  }

  return ''
}

/** Importe en euros con formato español ("39,99", "0", "385,99"). */
export function formatPlanAmount(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Precio mensual "equivalente" del pago anual (para el "≈ X €/mes"). */
export function annualMonthlyEquivalent(plan: CompanyPlan): number | null {
  return plan.priceAnnual ? plan.priceAnnual / 12 : null
}

/**
 * Descuento del pago anual frente a 12 mensualidades, en % redondeado.
 * Usa `annualDiscountPercent` si está fijado; si no, lo calcula del precio.
 */
export function annualDiscountPercent(plan: CompanyPlan): number {
  if (typeof plan.annualDiscountPercent === 'number') {
    return plan.annualDiscountPercent
  }
  if (!plan.priceAnnual || plan.priceMonthly <= 0) {
    return 0
  }
  return Math.round((1 - plan.priceAnnual / (plan.priceMonthly * 12)) * 100)
}

export function formatCompanyPlanStartedAt(date: Date | null): string {
  if (!date) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function nextCompanySubscription(input: {
  currentPlanId: CompanyPlanId
  currentBilling?: CompanyPlanBilling | null
  currentStartedAt: Date | null
  nextPlanId: unknown
  nextBilling: unknown
  nextStartedAt?: unknown
}): {
  planId: CompanyPlanId
  planBilling: CompanyPlanBilling | null
  planStartedAt: CompanyPlanStartedAtWrite
} {
  const planId = parseCompanyPlanId(input.nextPlanId)

  if (planId === 'free') {
    return { planId: 'free', planBilling: null, planStartedAt: 'clear' }
  }

  const planChanged = planId !== input.currentPlanId
  const explicitBilling =
    input.nextBilling === 'perpetual' || input.nextBilling === 'monthly'
      ? input.nextBilling
      : null
  const planBilling =
    explicitBilling
    ?? parseCompanyPlanBilling(input.currentBilling, planId)
  const explicitDate = parseCompanyPlanStartedAt(input.nextStartedAt)

  if (explicitDate) {
    return { planId, planBilling, planStartedAt: explicitDate }
  }

  return {
    planId,
    planBilling,
    planStartedAt: planChanged ? 'now' : 'keep',
  }
}

export function getCompanyPlan(id: CompanyPlanId): CompanyPlan {
  return COMPANY_PLANS.find((plan) => plan.id === id)
    ?? (id === 'premium_plus' ? LEGACY_CASA_PLAN : COMPANY_PLANS[0])
}

export function companyPlanIndex(id: CompanyPlanId): number {
  const index = COMPANY_PLANS.findIndex((plan) => plan.id === id)
  if (index >= 0) {
    return index
  }

  if (id === 'premium_plus') {
    return Math.max(0, COMPANY_PLANS.length - 1)
  }

  return 0
}

export function formatCompanyPlanPrice(
  plan: CompanyPlan,
  billing?: CompanyPlanBilling | null,
): string {
  if (plan.priceMonthly === 0) {
    return 'Gratis'
  }

  if (billing === 'annual' && plan.priceAnnual) {
    return `${formatPlanAmount(plan.priceAnnual)} €/año`
  }

  return `${formatPlanAmount(plan.priceMonthly)} €${plan.period}`
}

export function formatCompanyPlanChoiceLabel(plan: Pick<CompanyPlan, 'name' | 'priceMonthly'>): string {
  if (plan.priceMonthly === 0) {
    return `${plan.name} · Gratis`
  }

  return `${plan.name} · ${formatPlanAmount(plan.priceMonthly)} €/mes`
}

function capRank(value: CompanyPlanCapValue): number {
  if (value === false) {
    return 0
  }

  if (value === 'list') {
    return 1
  }

  if (value === true) {
    return 2
  }

  if (typeof value === 'number') {
    return 10 + value
  }

  return 1000
}

export function formatPlanCapValue(capability: CompanyPlanCapability, planId: CompanyPlanId): string {
  const value = capability.values[planId]

  if (value === false) {
    return 'No incluido'
  }

  if (value === true) {
    return 'Incluido'
  }

  if (value === 'unlimited') {
    return 'Sin límite'
  }

  if (value === 'list') {
    return 'Solo listado, sin plano'
  }

  if (capability.id === 'menus') {
    return value === 1 ? '1 carta' : `${value} cartas`
  }

  if (capability.id === 'tables') {
    return `Hasta ${value} mesas`
  }

  if (
    capability.id === 'promos_offer'
    || capability.id === 'promos_limited'
    || capability.id === 'promos_attendance'
  ) {
    return value === 1 ? '1 de este tipo' : `Hasta ${value} de este tipo`
  }

  if (capability.id === 'active_maps') {
    return value === 1 ? '1 mapa activo' : `Hasta ${value} mapas activos`
  }

  return String(value)
}

export function includedPlanCapabilities(planId: CompanyPlanId) {
  return COMPANY_PLAN_CAPABILITIES.filter((capability) => capRank(capability.values[planId]) > 0).map(
    (capability) => ({
      id: capability.id,
      label: capability.label,
      valueLabel: formatPlanCapValue(capability, planId),
      showValue: capability.values[planId] !== true,
    }),
  )
}

export function compareCompanyPlans(fromId: CompanyPlanId, toId: CompanyPlanId): CompanyPlanComparison {
  const fromIndex = companyPlanIndex(fromId)
  const toIndex = companyPlanIndex(toId)
  const gained: PlanCapabilityChange[] = []
  const lost: PlanCapabilityChange[] = []

  for (const capability of COMPANY_PLAN_CAPABILITIES) {
    const fromRank = capRank(capability.values[fromId])
    const toRank = capRank(capability.values[toId])

    if (toRank === fromRank) {
      continue
    }

    const change = {
      id: capability.id,
      label: capability.label,
      fromLabel: formatPlanCapValue(capability, fromId),
      toLabel: formatPlanCapValue(capability, toId),
    }

    if (toRank > fromRank) {
      gained.push(change)
    } else {
      lost.push(change)
    }
  }

  return {
    direction: toIndex > fromIndex ? 'upgrade' : toIndex < fromIndex ? 'downgrade' : 'same',
    gained,
    lost,
  }
}

export type CompanyPlanChangeKind =
  | 'none'
  | 'start_paid'
  | 'upgrade_now'
  | 'downgrade_later'
  | 'cancel_later'

export interface CompanyPlanChangePreview {
  kind: CompanyPlanChangeKind
  fromId: CompanyPlanId
  toId: CompanyPlanId
  fromPlan: CompanyPlan
  toPlan: CompanyPlan
  comparison: CompanyPlanComparison
  /** Diferencia de tarifa mensual en euros (Sala→Local = 20). */
  monthlyDelta: number
  chargeNowMonthly: number
}

export function previewCompanyPlanChange(
  fromId: CompanyPlanId,
  toId: CompanyPlanId,
): CompanyPlanChangePreview {
  const fromPlan = getCompanyPlan(fromId)
  const toPlan = getCompanyPlan(toId)
  const comparison = compareCompanyPlans(fromId, toId)
  const monthlyDelta = Math.abs(toPlan.priceMonthly - fromPlan.priceMonthly)

  if (comparison.direction === 'same') {
    return {
      kind: 'none',
      fromId,
      toId,
      fromPlan,
      toPlan,
      comparison,
      monthlyDelta: 0,
      chargeNowMonthly: 0,
    }
  }

  if (fromPlan.priceMonthly === 0 && toPlan.priceMonthly > 0) {
    return {
      kind: 'start_paid',
      fromId,
      toId,
      fromPlan,
      toPlan,
      comparison,
      monthlyDelta,
      chargeNowMonthly: toPlan.priceMonthly,
    }
  }

  if (toPlan.priceMonthly === 0) {
    return {
      kind: 'cancel_later',
      fromId,
      toId,
      fromPlan,
      toPlan,
      comparison,
      monthlyDelta,
      chargeNowMonthly: 0,
    }
  }

  if (toPlan.priceMonthly > fromPlan.priceMonthly) {
    return {
      kind: 'upgrade_now',
      fromId,
      toId,
      fromPlan,
      toPlan,
      comparison,
      monthlyDelta,
      chargeNowMonthly: monthlyDelta,
    }
  }

  return {
    kind: 'downgrade_later',
    fromId,
    toId,
    fromPlan,
    toPlan,
    comparison,
    monthlyDelta,
    chargeNowMonthly: 0,
  }
}

export function formatPlanChangePeriodEnd(date: Date | null): string {
  if (!date) {
    return 'el final del periodo pagado'
  }

  return formatCompanyPlanStartedAt(date)
}

export function companyPlanChangeBillingCopy(
  preview: CompanyPlanChangePreview,
  periodEnd: Date | null,
): { title: string; charge: string; next: string } {
  const until = formatPlanChangePeriodEnd(periodEnd)

  if (preview.kind === 'start_paid') {
    return {
      title: `Activar ${preview.toPlan.name}`,
      charge: `Empiezas a pagar ${formatCompanyPlanPrice(preview.toPlan)} ahora. Las ventajas de ${preview.toPlan.name} se encienden al confirmar el pago.`,
      next: `A partir de hoy, cada mes se cobra ${preview.toPlan.priceMonthly} €.`,
    }
  }

  if (preview.kind === 'upgrade_now') {
    return {
      title: `Pasar a ${preview.toPlan.name}`,
      charge: `Hoy Stripe cobra la diferencia (${preview.monthlyDelta} €), ajustada a los días que quedan de este mes. Las ventajas de ${preview.toPlan.name} se activan al instante.`,
      next: `En la siguiente renovación pasarás a pagar ${preview.toPlan.priceMonthly} €/mes.`,
    }
  }

  if (preview.kind === 'downgrade_later') {
    return {
      title: `Bajar a ${preview.toPlan.name}`,
      charge: `Hoy no se cobra nada. Sigues con ${preview.fromPlan.name} y todas sus ventajas hasta ${until}.`,
      next: `Ese día pasas a ${preview.toPlan.name} y el siguiente cobro será ${preview.toPlan.priceMonthly} €.`,
    }
  }

  if (preview.kind === 'cancel_later') {
    return {
      title: 'Pasar a Mesa',
      charge: `Dejamos de cobrarte. Sigues con ${preview.fromPlan.name} hasta ${until}.`,
      next: `Ese día pasas a Mesa (gratis) y no hay más cargos.`,
    }
  }

  return {
    title: `Sigues en ${preview.fromPlan.name}`,
    charge: 'No hay ningún cambio de plan.',
    next: '',
  }
}

export function companyPlanChangeMailto(
  companyName: string,
  fromPlan: CompanyPlan,
  toPlan: CompanyPlan,
): string {
  const subject = toPlan.comingSoon
    ? `Lista de espera · Adelia ${toPlan.name} · ${companyName}`
    : `Cambio de plan · ${fromPlan.name} a ${toPlan.name} · ${companyName}`
  const body = toPlan.comingSoon
    ? `Hola,\n\nSoy ${companyName} (plan actual: ${fromPlan.name}) y quiero apuntarme a la lista de espera de ${toPlan.name}.\n\nTeléfono:\n\nGracias.`
    : `Hola,\n\nSoy ${companyName}. Quiero cambiar de plan ${fromPlan.name} a ${toPlan.name}.\n\nTeléfono:\n\nGracias.`

  return `mailto:${COMPANY_PLANS_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
