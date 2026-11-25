import { Suspense, lazy, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import ImageUploader from '../../components/ImageUploader'
import CharacteristicPicker from '../../components/CharacteristicPicker'
import CityAutocomplete from '../../components/CityAutocomplete'
import LocationMapPicker from '../../components/LocationMapPicker'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import MediaGalleryUploader from '../../components/MediaGalleryUploader'
import ProfileToggleGrid from '../../components/ProfileToggleGrid'
import { useAuth } from '../../context/AuthContext'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import { parseCompanyPlanId, getCompanyPlan } from '../../data/companyPlans'
import {
  clampFloorPlansEnabled,
  planAllowsDeposits,
  planAllowsFloorPlan,
  planAllowsMoreThan,
  planMaxCount,
  planMaxFloorPlans,
  planRequiredForCount,
  requiredPlanName,
} from '../../data/companyPlanLimits'
import { LockedControl, PlanLockHint } from '../../components/PlanLockHint'
import {
  COMPANY_CHARACTERISTIC_OPTIONS,
  MAX_COMPANY_CHARACTERISTICS,
  MAX_COMPANY_PHOTOS,
  MAX_COMPANY_VIDEOS,
} from '../../data/companyCharacteristics'
import { companyVideoUploadHint } from '../../constants/fileUpload'
import {
  COMPANY_AMENITIES,
  COMPANY_PRICE_RANGES,
  COMPANY_VENUE_TYPES,
  MAX_COMPANY_VENUE_TYPES,
} from '../../data/companyProfileFacilities'
import {
  ensureCompanyLoginIndex,
  getFirestoreErrorMessage,
  getTablesByCompany,
  replaceCompanyTables,
  setCompanyPublicVisibility,
  updateCompanyFloorPlans,
  updateCompanySettings,
} from '../../services/firestore'
import type { Company, CompanySchedule, CompanySettingsPayload, DaySchedule, SchedulePeriod, SettingsSection, TableInput } from '../../types'
import {
  createNamedFloorPlan,
  defaultFloorPlan,
  MAX_FLOOR_PLANS,
  SCHEDULE_DAY_KEYS,
  SCHEDULE_DAY_LABELS,
  SETTINGS_SECTIONS,
  syncAllFloorPlans,
  tablesForFloorPlan,
  withFloorPlans,
} from '../../types/company'
import { copyTextToClipboard, defaultSchedule, getPublicBookingUrl, selectInputText, slugify, withQrMark } from '../../utils/helpers'
import {
  getDaySchedulePeriods,
  MAX_SCHEDULE_PERIODS,
  normalizeCompanySchedule,
  resizeDaySchedulePeriods,
  syncDayScheduleFields,
  updateDaySchedulePeriod,
} from '../../utils/schedule'
import { toGeoCoordinates } from '../../utils/mapCoordinates'
import {
  isConfirmedCitySelection,
  municipalityToCitySuggestion,
} from '../../utils/citySelection'
import type { CitySuggestion } from '../../services/citySearch'
import {
  normalizeCompanySettingsPayload,
  validateCompanyContact,
  validateCompanyProfile,
  validateCompanySchedule,
  validateReservationDepositSettings,
} from '../../utils/companyValidation'
import { buildBrandedQrDataUrl, downloadBookingQrCode } from '../../utils/bookingQr'
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Armchair,
  Globe,
  LayoutGrid,
  Map as MapIcon,
  Search,
  Users,
  Image as ImageIcon,
  Link2,
  Mail,
  MapPin,
  Palette,
  Phone,
  QrCode,
  Store,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CopyCheck,
  DoorOpen,
  Plus,
  ShieldCheck,
  Timer,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  DEFAULT_DEPOSIT_CANCELLATION_HOURS,
  formatDepositCancellationPolicy,
} from '../../utils/reservationDeposit'
import { resolveBrandedQrOptions } from '../../utils/qrBranding'
import QrCustomizerModal from '../../components/QrCustomizerModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import CompanyStripeConnectPanel from './CompanyStripeConnectPanel'
import type { CompanyStripeStatus } from '../../services/companyStripe'
import { normalizeMainPhotoIndex } from '../../utils/companyPhotos'
import {
  COMPANY_RESERVATION_MODE_OPTIONS,
  parseCompanyReservationMode,
  reservationModeHint,
  type CompanyReservationMode,
} from '../../data/companyReservationMode'
import {
  applySectionSnapshot,
  createAllSectionSnapshots,
  createSectionSnapshot,
  isSectionDirty as isSettingsSectionDirty,
  type SettingsEditorState,
} from '../../utils/settingsSnapshots'
import styles from './CompanySettings.module.css'
import { qrScanLabel, useQrScanCounts } from '../../hooks/useQrScanCounts'

const FloorPlanEditor = lazy(() => import('../../components/FloorPlanEditor'))

const SETTINGS_SECTION_IDS = SETTINGS_SECTIONS
  .map((section) => section.id)
  .filter((id): id is Exclude<SettingsSection, 'menu' | 'plan'> => id !== 'menu' && id !== 'plan')

interface CompanySettingsProps {
  activeSection: SettingsSection
}

export interface CompanySettingsHandle {
  isSectionDirty: (section: SettingsSection) => boolean
  discardSection: (section: SettingsSection) => void
  saveSection: (section: SettingsSection) => Promise<boolean>
}

const SCHEDULE_DAY_SHORT: Record<(typeof SCHEDULE_DAY_KEYS)[number], string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
}

function sectionCardClass(section: SettingsSection, activeSection: SettingsSection) {
  return `${styles.sectionCard} ${
    activeSection === section ? styles.sectionCardActive : ''
  }`
}

/** Cabecera de cada parte de «Mi restaurante»: título grande y subtítulo gris. */
function SectionHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <header className={styles.sectionHeader}>
      <div className={styles.sectionHeaderText}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <p className={styles.sectionSubtitle}>{subtitle}</p>
      </div>
      {children ? <div className={styles.sectionHeaderAside}>{children}</div> : null}
    </header>
  )
}

/** Tarjeta blanca con un bloque del formulario (título, explicación y campos). */
function FormCard({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`${styles.formCard} ${className ?? ''}`}>
      <div className={styles.formCardHeader}>
        <div className={styles.formCardHeaderText}>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className={styles.formCardActions}>{actions}</div> : null}
      </div>
      <div className={styles.formCardBody}>{children}</div>
    </div>
  )
}

const MIN_TIME_SLOT_MINUTES = 15
const MAX_TIME_SLOT_MINUTES = 240

function sanitizeTimeSlotMinutesInput(raw: string): string {
  return raw.replace(/\D/g, '')
}

function parseTimeSlotMinutesForSave(input: string): number | null {
  const digits = sanitizeTimeSlotMinutesInput(input)

  if (!digits) {
    return null
  }

  const value = Number(digits)

  if (!Number.isFinite(value) || value < MIN_TIME_SLOT_MINUTES || value > MAX_TIME_SLOT_MINUTES) {
    return null
  }

  return value
}

function companyToForm(company: Company): CompanySettingsPayload {
  return {
    name: company.name,
    contactEmail: company.contactEmail,
    phone: company.phone,
    website: company.website,
    location: company.location,
    municipality: company.municipality,
    country: company.country || 'España',
    postalCode: company.postalCode,
    latitude: company.latitude,
    longitude: company.longitude,
    description: company.description,
    logoUrl: company.logoUrl,
    photos: company.photos ?? [],
    mainPhotoIndex: company.mainPhotoIndex ?? 0,
    videos: company.videos ?? [],
    characteristics: company.characteristics ?? [],
    venueTypes: company.venueTypes ?? [],
    amenities: company.amenities ?? [],
    priceRange: company.priceRange ?? '',
    timeSlotMinutes: company.timeSlotMinutes,
    reservationMode: parseCompanyReservationMode(company.reservationMode),
    depositMinPax: company.depositMinPax ?? null,
    depositPerGuestCents: company.depositPerGuestCents ?? null,
    depositEnabled: company.depositEnabled ?? Boolean(company.depositMinPax && company.depositMinPax > 0),
    depositCancellationHours: company.depositCancellationHours ?? null,
    schedule: normalizeCompanySchedule(company.schedule ?? defaultSchedule()),
    turns: company.turns ?? [],
    ...withFloorPlans(
      company.floorPlans?.length
        ? company.floorPlans
        : [company.floorPlan ?? defaultFloorPlan()],
    ),
  }
}

function emptyTable(index: number, floorPlanId = ''): TableInput {
  return {
    name: `Mesa ${index + 1}`,
    capacity: 4,
    floorPlanId,
  }
}

const RESERVATION_MODE_META: Record<
  CompanyReservationMode,
  { title: string; short: string; icon: LucideIcon }
> = {
  required: { title: 'Solo con reserva', short: 'Obligatorias', icon: CalendarCheck },
  optional: { title: 'Con o sin reserva', short: 'Opcionales', icon: CalendarClock },
  none: { title: 'Sin reservas', short: 'Desactivadas', icon: DoorOpen },
}

const DURATION_PRESETS = [60, 90, 120, 150, 180]

function formatMinutesShort(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) {
    return `${rest} min`
  }
  return rest ? `${hours} h ${rest}` : `${hours} h`
}

function formatMinutesLong(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) {
    return `${rest} min`
  }
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

function formatEuroCents(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

function timeToDayMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) {
    return null
  }
  return Number(match[1]) * 60 + Number(match[2])
}

/** Posición de un tramo en la barra de 24 h (en %), o null si está incompleto. */
function periodRange(period: SchedulePeriod): { left: number; width: number } | null {
  const open = timeToDayMinutes(period.open)
  const close = timeToDayMinutes(period.close)
  if (open === null || close === null || close <= open) {
    return null
  }
  return { left: (open / 1440) * 100, width: ((close - open) / 1440) * 100 }
}

/** Añade un tramo. Si el día va de mediodía a noche, lo parte en comidas y cenas. */
function addSchedulePeriod(day: DaySchedule): DaySchedule {
  const periods = getDaySchedulePeriods(day)
  if (periods.length === 1) {
    const [only] = periods
    if (only.open && only.close && only.open < '16:00' && only.close > '20:00') {
      return syncDayScheduleFields({
        active: day.active,
        periods: [
          { open: only.open, close: '16:00' },
          { open: '20:00', close: only.close },
        ],
      })
    }
  }
  return resizeDaySchedulePeriods(day, periods.length + 1)
}

function computeScheduleSummary(schedule: CompanySchedule) {
  let openDays = 0
  let weeklyMinutes = 0
  for (const key of SCHEDULE_DAY_KEYS) {
    const day = schedule[key]
    if (!day?.active) {
      continue
    }
    openDays += 1
    for (const period of getDaySchedulePeriods(day)) {
      const open = timeToDayMinutes(period.open)
      const close = timeToDayMinutes(period.close)
      if (open !== null && close !== null && close > open) {
        weeklyMinutes += close - open
      }
    }
  }
  return { openDays, weeklyMinutes }
}

const CompanySettings = forwardRef(function CompanySettings(
  { activeSection }: CompanySettingsProps,
  ref: Ref<CompanySettingsHandle>,
) {
  const { company, refreshCompany } = useAuth()
  const demo = useCompanyDemo()
  const [copiedDay, setCopiedDay] = useState<string | null>(null)

  useEffect(() => {
    if (!copiedDay) {
      return undefined
    }
    const timer = window.setTimeout(() => setCopiedDay(null), 1800)
    return () => window.clearTimeout(timer)
  }, [copiedDay])
  const planId = parseCompanyPlanId(company?.planId)
  const allowsDeposits = planAllowsDeposits(planId)
  const allowsFloorPlan = planAllowsFloorPlan(planId)
  const maxTables = planMaxCount(planId, 'tables')
  const maxActiveMaps = planMaxCount(planId, 'active_maps')
  const maxFloorPlans = planMaxFloorPlans(planId) ?? MAX_FLOOR_PLANS
  const [form, setForm] = useState<CompanySettingsPayload | null>(null)
  const [tables, setTables] = useState<TableInput[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingSection, setSavingSection] = useState<SettingsSection | null>(null)
  const [isSavingMap, setIsSavingMap] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tableSearchQuery, setTableSearchQuery] = useState('')
  const [tableCapacityFilter, setTableCapacityFilter] = useState('')
  const [tableMapFilter, setTableMapFilter] = useState('')
  const [selectedMapId, setSelectedMapId] = useState('')
  // Confirmación propia para quitar un mapa (window.confirm lo bloquean muchos navegadores).
  const [removeMapConfirm, setRemoveMapConfirm] = useState<{ removedName: string; fallbackName: string } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const clientLinkInputRef = useRef<HTMLInputElement>(null)
  const [isDownloadingQr, setIsDownloadingQr] = useState(false)
  const [qrCustomizerOpen, setQrCustomizerOpen] = useState(false)
  const [timeSlotMinutesInput, setTimeSlotMinutesInput] = useState('')
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [stripeStatus, setStripeStatus] = useState<CompanyStripeStatus | null>(null)
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true)
  const [selectedMunicipality, setSelectedMunicipality] = useState<CitySuggestion | null>(null)
  const [savedSnapshots, setSavedSnapshots] = useState<Record<SettingsSection, string> | null>(
    null,
  )
  const saveHandlersRef = useRef<Partial<Record<SettingsSection, () => Promise<boolean>>>>({})

  const editorState = useMemo<SettingsEditorState | null>(() => {
    if (!form) {
      return null
    }

    return { form, tables, timeSlotMinutesInput }
  }, [form, tables, timeSlotMinutesInput])

  const stripeReadyForDeposits = stripeStatus?.readyForDeposits === true
  const canEnableDeposits = allowsDeposits && stripeReadyForDeposits && !stripeStatusLoading
  const canAddTable = planAllowsMoreThan(planId, 'tables', tables.length)

  const markSectionSaved = (section: SettingsSection, state: SettingsEditorState) => {
    setSavedSnapshots((current) => ({
      ...(current ?? ({} as Record<SettingsSection, string>)),
      [section]: createSectionSnapshot(section, state),
    }))
  }

  useImperativeHandle(
    ref,
    () => ({
      isSectionDirty(section) {
        if (!editorState || !savedSnapshots) {
          return false
        }

        return isSettingsSectionDirty(section, editorState, savedSnapshots[section])
      },
      discardSection(section) {
        if (!editorState || !savedSnapshots?.[section]) {
          return
        }

        const restored = applySectionSnapshot(section, savedSnapshots[section], editorState)
        setForm(restored.form)
        setTables(restored.tables)
        setTimeSlotMinutesInput(restored.timeSlotMinutesInput)
        if (section === 'profile') {
          setSelectedMunicipality(
            municipalityToCitySuggestion(restored.form.municipality, restored.form.country),
          )
        }
        setError(null)
        setSuccess(null)
      },
      saveSection(section) {
        return saveHandlersRef.current[section]?.() ?? Promise.resolve(false)
      },
    }),
    [editorState, savedSnapshots],
  )

  const tableCapacityOptions = useMemo(
    () =>
      [...new Set(tables.map((table) => table.capacity))].sort((a, b) => a - b),
    [tables],
  )

  const filteredTableEntries = useMemo(() => {
    const query = tableSearchQuery.trim().toLowerCase()

    return tables
      .map((table, index) => ({ table, index }))
      .filter(({ table }) => {
        const matchesName = !query || table.name.toLowerCase().includes(query)
        const matchesCapacity =
          !tableCapacityFilter || table.capacity === Number(tableCapacityFilter)
        const tableMap = table.floorPlanId || form?.floorPlans[0]?.id || ''
        const matchesMap = !tableMapFilter || tableMap === tableMapFilter

        return matchesName && matchesCapacity && matchesMap
      })
  }, [tables, tableSearchQuery, tableCapacityFilter, tableMapFilter, form?.floorPlans])

  const hasTableFilters = Boolean(tableSearchQuery.trim() || tableCapacityFilter || tableMapFilter)

  useEffect(() => {
    if (!company) {
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        void ensureCompanyLoginIndex(company.id).catch(() => {
          // El acceso se resuelve también por nombre público de la empresa.
        })

        const tableRows = await getTablesByCompany(company.id)

        if (cancelled) {
          return
        }

        const initialForm = companyToForm(company)
        const initialTables =
          tableRows.length > 0
            ? tableRows.map((table) => ({
                id: table.id,
                name: table.name,
                capacity: table.capacity,
                floorPlanId: table.floorPlanId || initialForm.floorPlans[0]?.id || '',
              }))
            : [emptyTable(0, initialForm.floorPlans[0]?.id)]
        const initialTimeSlot = String(company.timeSlotMinutes)

        setForm(initialForm)
        setSelectedMapId(initialForm.floorPlans[0]?.id ?? '')
        setSelectedMunicipality(
          municipalityToCitySuggestion(initialForm.municipality, initialForm.country),
        )
        setTimeSlotMinutesInput(initialTimeSlot)
        setTables(initialTables)
        setSavedSnapshots(
          createAllSectionSnapshots(
            {
              form: initialForm,
              tables: initialTables,
              timeSlotMinutesInput: initialTimeSlot,
            },
            SETTINGS_SECTION_IDS,
          ),
        )
      } catch (err) {
        if (!cancelled) {
          setError(getFirestoreErrorMessage(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [company])

  const qrBrandingContext = useMemo(
    () => ({
      companyName: form?.name.trim() || company?.name || '',
      companyLogoUrl: form?.logoUrl.trim() || company?.logoUrl || '',
    }),
    [form?.name, form?.logoUrl, company?.name, company?.logoUrl],
  )

  // Vista previa del QR de reservas (el mismo que se descarga).
  const [bookingQrPreviewUrl, setBookingQrPreviewUrl] = useState<string | null>(null)
  const qrScanCounts = useQrScanCounts(company?.id)
  const bookingUrlForQr = company ? withQrMark(getPublicBookingUrl(company.slug), 'reservas') : ''
  const bookingQrConfig = company?.qrBranding.booking

  useEffect(() => {
    if (!bookingUrlForQr || !bookingQrConfig || activeSection !== 'contact') {
      return
    }

    let cancelled = false
    const renderOptions = resolveBrandedQrOptions(bookingQrConfig, 'booking', qrBrandingContext)

    void buildBrandedQrDataUrl(bookingUrlForQr, renderOptions)
      .then((dataUrl) => {
        if (!cancelled) {
          setBookingQrPreviewUrl(dataUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookingQrPreviewUrl(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [bookingUrlForQr, bookingQrConfig, qrBrandingContext, activeSection])

  if (!company || !form) {
    return <p className={styles.loading}>Cargando configuración…</p>
  }

  if (isLoading) {
    return <p className={styles.loading}>Cargando configuración…</p>
  }

  const handleSaveContact = async (): Promise<boolean> => {
    setError(null)
    setSuccess(null)

    const contactError = validateCompanyContact(form)

    if (contactError) {
      setError(contactError)
      return false
    }

    const normalizedForm = normalizeCompanySettingsPayload(form)

    setSavingSection('contact')

    try {
      await updateCompanySettings(company.id, normalizedForm)
      await refreshCompany()
      setForm(normalizedForm)
      markSectionSaved('contact', {
        form: normalizedForm,
        tables,
        timeSlotMinutesInput,
      })
      setSuccess('Contacto guardado correctamente.')
      return true
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
      return false
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveProfile = async (): Promise<boolean> => {
    setError(null)
    setSuccess(null)

    if (!form) {
      return false
    }

    if (!isConfirmedCitySelection(selectedMunicipality, form.municipality)) {
      setError('Selecciona tu ciudad de la lista de sugerencias.')
      return false
    }

    const profileError = validateCompanyProfile(form)

    if (profileError) {
      setError(profileError)
      return false
    }

    const normalizedForm = normalizeCompanySettingsPayload(form)

    setSavingSection('profile')

    try {
      await updateCompanySettings(company.id, normalizedForm)
      await refreshCompany()
      setForm(normalizedForm)
      setSelectedMunicipality(
        municipalityToCitySuggestion(normalizedForm.municipality, normalizedForm.country),
      )
      markSectionSaved('profile', {
        form: normalizedForm,
        tables,
        timeSlotMinutesInput,
      })
      setSuccess('Perfil guardado correctamente.')
      return true
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
      return false
    } finally {
      setSavingSection(null)
    }
  }

  const applyVisibility = async (deactivated: boolean) => {
    if (!company) {
      return
    }

    setVisibilitySaving(true)
    setError(null)
    setSuccess(null)

    try {
      await setCompanyPublicVisibility(company.id, deactivated)
      await refreshCompany()
      setSuccess(
        deactivated
          ? 'Restaurante desactivado. Los clientes ya no pueden verlo ni reservar.'
          : 'Restaurante reactivado. Ya vuelve a estar visible para los clientes.',
      )
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setVisibilitySaving(false)
      setDeactivateDialogOpen(false)
    }
  }

  const handleSaveReservations = async (): Promise<boolean> => {
    setError(null)
    setSuccess(null)

    if (!form) {
      return false
    }

    const timeSlotMinutes = form.reservationMode === 'none'
      ? (parseTimeSlotMinutesForSave(timeSlotMinutesInput) ?? form.timeSlotMinutes ?? 120)
      : parseTimeSlotMinutesForSave(timeSlotMinutesInput)

    if (timeSlotMinutes === null) {
      setError(`La duración debe ser un número entre ${MIN_TIME_SLOT_MINUTES} y ${MAX_TIME_SLOT_MINUTES} minutos.`)
      return false
    }

    const scheduleError = validateCompanySchedule(form.schedule)

    if (scheduleError) {
      setError(scheduleError)
      return false
    }

    const depositError = form.reservationMode === 'none'
      ? null
      : validateReservationDepositSettings(
        form.depositEnabled,
        form.depositMinPax,
        form.depositPerGuestCents,
        form.depositCancellationHours,
      )

    if (depositError) {
      setError(depositError)
      return false
    }

    if (form.reservationMode !== 'none' && form.depositEnabled && !canEnableDeposits) {
      setError(
        !allowsDeposits
          ? `Las fianzas están en el plan ${requiredPlanName('deposits')}.`
          : 'Completa la conexión con Stripe antes de activar las fianzas.',
      )
      return false
    }

    const reservationSettings = normalizeCompanySettingsPayload({
      ...form,
      timeSlotMinutes,
      depositEnabled: form.depositEnabled && canEnableDeposits,
    })
    const savedTimeSlotInput = String(timeSlotMinutes)

    setSavingSection('reservation-settings')

    try {
      await updateCompanySettings(company.id, reservationSettings)
      await refreshCompany()
      setForm(reservationSettings)
      setTimeSlotMinutesInput(savedTimeSlotInput)
      markSectionSaved('reservation-settings', {
        form: reservationSettings,
        tables,
        timeSlotMinutesInput: savedTimeSlotInput,
      })
      setSuccess('Reservas y horario guardados correctamente.')
      return true
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
      return false
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveTables = async (): Promise<boolean> => {
    if (!form || !company) {
      return false
    }

    setError(null)
    setSuccess(null)

    const unnamedTables = tables.filter((table) => !table.name.trim())
    if (unnamedTables.length > 0) {
      setError('Pon un nombre a todas las mesas antes de guardar.')
      return false
    }

    const validTables = tables.filter((table) => table.name.trim())

    if (validTables.length === 0) {
      setError('Añade al menos una mesa con nombre.')
      return false
    }

    setSavingSection('tables')

    try {
      await replaceCompanyTables(company.id, validTables)

      const tableRows = await getTablesByCompany(company.id)
      const savedTables = tableRows.map((table) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        floorPlanId: table.floorPlanId || form.floorPlans[0]?.id || '',
      }))

      const floorPlans = clampFloorPlansEnabled(
        syncAllFloorPlans(form.floorPlans, savedTables),
        planId,
      )

      await updateCompanyFloorPlans(company.id, floorPlans)
      setTables(savedTables)
      const nextForm = { ...form, ...withFloorPlans(floorPlans) }
      setForm(nextForm)
      await refreshCompany()
      markSectionSaved('tables', {
        form: nextForm,
        tables: savedTables,
        timeSlotMinutesInput,
      })
      setSuccess('Mesas guardadas correctamente.')
      return true
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
      return false
    } finally {
      setSavingSection(null)
    }
  }

  const updateTable = (index: number, patch: Partial<TableInput>) => {
    setTables((current) =>
      current.map((table, tableIndex) =>
        tableIndex === index ? { ...table, ...patch } : table,
      ),
    )
  }

  const syncMapsWithTables = (nextTables: TableInput[]) => {
    setForm((current) =>
      current
        ? {
            ...current,
            ...withFloorPlans(syncAllFloorPlans(current.floorPlans, nextTables)),
          }
        : current,
    )
  }

  const addTable = () => {
    if (!canAddTable) {
      setError(
        maxTables === 1
          ? `En tu plan solo puedes tener 1 mesa. Pasa a ${requiredPlanName('tables', planRequiredForCount('tables', tables.length + 1))} para añadir más.`
          : `En tu plan puedes tener hasta ${maxTables} mesas. Pasa a ${requiredPlanName('tables', planRequiredForCount('tables', tables.length + 1))} para añadir más.`,
      )
      return
    }

    setError(null)
    setTables((current) => {
      const next = [...current, emptyTable(current.length, selectedMapId || form?.floorPlans[0]?.id)]
      syncMapsWithTables(next)
      return next
    })
  }

  const removeTable = (index: number) => {
    setTables((current) => {
      const next = current.filter((_, tableIndex) => tableIndex !== index)
      syncMapsWithTables(next)
      return next
    })
  }

  const setMapEnabled = (mapId: string, enabled: boolean) => {
    if (enabled) {
      if (!allowsFloorPlan || maxActiveMaps === 0) {
        setError('No puedes activar el mapa siendo de este plan. Pasa a Sala para que los clientes elijan mesa.')
        return
      }

      const otherEnabled = (form?.floorPlans ?? []).filter((plan) => plan.enabled && plan.id !== mapId).length
      if (maxActiveMaps != null && otherEnabled >= maxActiveMaps) {
        setError(
          `En ${getCompanyPlan(planId).name} solo puedes tener ${maxActiveMaps === 1 ? '1 mapa activo' : `${maxActiveMaps} mapas activos`}. Pasa a ${requiredPlanName('active_maps', planRequiredForCount('active_maps', otherEnabled + 1))} para activar más.`,
        )
        return
      }
    }

    setError(null)
    setForm((current) => {
      if (!current) {
        return current
      }

      const nextPlans = current.floorPlans.map((plan) =>
        plan.id === mapId ? { ...plan, enabled } : plan,
      )

      return {
        ...current,
        ...withFloorPlans(enabled ? syncAllFloorPlans(nextPlans, tables) : nextPlans),
      }
    })
  }

  const renameSelectedMap = (planId: string, name: string) => {
    setForm((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        ...withFloorPlans(
          current.floorPlans.map((plan) =>
            plan.id === planId
              ? { ...plan, name: name.slice(0, 40) }
              : plan,
          ),
        ),
      }
    })
  }

  const addFloorPlan = () => {
    setForm((current) => {
      if (!current || current.floorPlans.length >= maxFloorPlans) {
        return current
      }

      const nextPlan = createNamedFloorPlan(`Mapa ${current.floorPlans.length + 1}`, false)
      const nextPlans = [...current.floorPlans, nextPlan]
      setSelectedMapId(nextPlan.id)
      return {
        ...current,
        ...withFloorPlans(nextPlans),
      }
    })
  }

  const removeSelectedMap = (confirmed = false) => {
    if (!form || form.floorPlans.length <= 1) {
      return
    }

    const planId = selectedMapId || form.floorPlans[0]?.id
    if (!planId) {
      return
    }

    const remaining = form.floorPlans.filter((plan) => plan.id !== planId)
    const fallbackId = remaining[0]?.id ?? ''
    const removedName = form.floorPlans.find((plan) => plan.id === planId)?.name || 'este mapa'
    const fallbackName = remaining[0]?.name || 'el otro mapa'

    if (!confirmed) {
      setRemoveMapConfirm({ removedName, fallbackName })
      return
    }
    setRemoveMapConfirm(null)

    const nextTables = tables.map((table) =>
      table.floorPlanId === planId ? { ...table, floorPlanId: fallbackId } : table,
    )

    setTables(nextTables)
    setSelectedMapId(fallbackId)
    setForm({
      ...form,
      ...withFloorPlans(syncAllFloorPlans(remaining, nextTables)),
    })
  }

  const isAnySaving = savingSection !== null || isSavingMap

  const isDirty = (section: SettingsSection) =>
    Boolean(
      editorState
        && savedSnapshots
        && isSettingsSectionDirty(section, editorState, savedSnapshots[section]),
    )

  /** Barra fija al pie de cada parte: estado de los cambios y botón Guardar. */
  const renderSectionSave = (
    section: SettingsSection,
    label: string,
    onSave: () => Promise<boolean> | boolean,
    extraActions?: ReactNode,
  ) => {
    if (demo) {
      return null
    }

    const dirty = isDirty(section)

    return (
      <div className={`${styles.saveBar} ${dirty ? styles.saveBarDirty : ''}`}>
        <span className={styles.saveStatus} role="status">
          <span className={styles.saveStatusDot} aria-hidden="true" />
          {savingSection === section
            ? 'Guardando cambios…'
            : dirty
              ? 'Tienes cambios sin guardar'
              : 'Todo guardado'}
        </span>
        <div className={styles.saveBarActions}>
          {extraActions}
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void Promise.resolve(onSave())}
            disabled={isAnySaving}
          >
            {savingSection === section ? 'Guardando…' : label}
          </button>
        </div>
      </div>
    )
  }

  const handleSaveMapOnly = async () => {
    if (!form) {
      setError('No hay mapas para guardar.')
      return
    }

    setIsSavingMap(true)
    setError(null)
    setSuccess(null)

    try {
      const floorPlans = clampFloorPlansEnabled(syncAllFloorPlans(form.floorPlans, tables), planId)
      await updateCompanyFloorPlans(company.id, floorPlans)
      const nextForm = { ...form, ...withFloorPlans(floorPlans) }
      setForm(nextForm)
      await refreshCompany()
      markSectionSaved('tables', {
        form: nextForm,
        tables,
        timeSlotMinutesInput,
      })
      setSuccess('Mapa guardado correctamente.')
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setIsSavingMap(false)
    }
  }

  saveHandlersRef.current = {
    contact: handleSaveContact,
    profile: handleSaveProfile,
    'reservation-settings': handleSaveReservations,
    tables: handleSaveTables,
  }

  const clientBookingUrl = company ? getPublicBookingUrl(company.slug) : ''

  const handleCopyClientLink = async () => {
    setError(null)
    selectInputText(clientLinkInputRef.current)

    const copied = await copyTextToClipboard(clientBookingUrl)

    if (copied) {
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
      return
    }

    selectInputText(clientLinkInputRef.current)
    setError('No se pudo copiar automáticamente. Mantén pulsado el enlace y elige «Copiar».')
  }

  const selectedPlan =
    form.floorPlans.find((plan) => plan.id === (selectedMapId || form.floorPlans[0]?.id))
    ?? form.floorPlans[0]

  const totalSeats = tables.reduce((sum, table) => sum + (Number(table.capacity) || 0), 0)
  const activeMapCount = form.floorPlans.filter((plan) => plan.enabled).length

  // Qué le falta al perfil para estar completo (solo orienta; no bloquea nada).
  const profileChecks = [
    { label: 'Logo', done: Boolean(form.logoUrl.trim()) },
    { label: 'Punto en el mapa', done: form.latitude != null && form.longitude != null },
    { label: 'Tipo de local', done: form.venueTypes.length > 0 },
    { label: 'Precio medio', done: Boolean(form.priceRange) },
    { label: '3 servicios o más', done: form.amenities.length >= 3 },
    { label: '3 características o más', done: form.characteristics.length >= 3 },
    { label: 'Descripción de 80 letras o más', done: form.description.trim().length >= 80 },
    { label: '3 fotos o más', done: form.photos.length >= 3 },
  ]
  const profileCompleteness = {
    items: profileChecks,
    percent: Math.round((profileChecks.filter((item) => item.done).length / profileChecks.length) * 100),
  }

  // Mesas: por tamaño y por mapa, para los filtros rápidos.
  const capacityGroups = [...tables.reduce((map, table) => {
    map.set(table.capacity, (map.get(table.capacity) ?? 0) + 1)
    return map
  }, new Map<number, number>())].sort((a, b) => a[0] - b[0])
  const tablesPerMap = form.floorPlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    enabled: plan.enabled,
    count: tables.filter((table) => (table.floorPlanId || form.floorPlans[0]?.id) === plan.id).length,
  }))
  const averageSeats = tables.length ? totalSeats / tables.length : 0

  const handleDownloadClientQr = async () => {
    if (!company) {
      return
    }

    setIsDownloadingQr(true)
    setError(null)

    try {
      const filename = `qr-reservas-${slugify(company.slug || company.name)}.png`
      const renderOptions = resolveBrandedQrOptions(company.qrBranding.booking, 'booking', qrBrandingContext)
      await downloadBookingQrCode(withQrMark(clientBookingUrl, 'reservas'), filename, renderOptions)
    } catch {
      setError('No se pudo generar el código QR.')
    } finally {
      setIsDownloadingQr(false)
    }
  }

  return (
    <div className={styles.form}>
      {(error || success) && (
        <div className={styles.formFeedback}>
          {error && (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => setError(null)}
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </div>
          )}
          {success && (
            <div className={styles.success} role="status">
              <span>{success}</span>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => setSuccess(null)}
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      <section className={sectionCardClass('contact', activeSection)}>
        <SectionHeader
          title="Contacto"
          subtitle="Los datos con los que te encuentran y te escriben tus clientes."
        />

        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHead}>
            <h3>Datos del restaurante</h3>
            <p>Aparecen en tu ficha de Adelia y en los correos de reserva.</p>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <label htmlFor="contact-name">Nombre del restaurante</label>
              <span>Tal y como quieres que lo vean.</span>
            </div>
            <div className={styles.settingsRowField}>
              <span className={styles.iconInput}>
                <Store size={16} aria-hidden="true" />
                <input
                  id="contact-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Restaurante Carol"
                  autoComplete="organization"
                />
              </span>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <label htmlFor="contact-email">Correo de contacto</label>
              <span>Los clientes podrán escribirte aquí.</span>
            </div>
            <div className={styles.settingsRowField}>
              <span className={styles.iconInput}>
                <Mail size={16} aria-hidden="true" />
                <input
                  id="contact-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="reservas@restaurante.com"
                  autoComplete="email"
                />
              </span>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <label htmlFor="contact-phone">Teléfono</label>
              <span>Para llamadas y dudas de última hora.</span>
            </div>
            <div className={styles.settingsRowField}>
              <span className={styles.iconInput}>
                <Phone size={16} aria-hidden="true" />
                <input
                  id="contact-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  type="tel"
                  inputMode="tel"
                  placeholder="612 345 678"
                  maxLength={20}
                  autoComplete="tel"
                />
              </span>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <label htmlFor="contact-address">Dirección</label>
              <span>Escribe la calle y elígela de la lista: el municipio, el código postal y el mapa se rellenan solos.</span>
            </div>
            <div className={styles.settingsRowField}>
              <span className={styles.iconInput}>
                <MapPin size={16} aria-hidden="true" />
                <AddressAutocomplete
                  id="contact-address"
                  value={form.location}
                  onChange={(location) => setForm({ ...form, location })}
                  onPick={(address) => {
                    setForm({
                      ...form,
                      location: address.line,
                      municipality: address.city || form.municipality,
                      postalCode: address.postalCode || form.postalCode,
                      country: address.country || form.country,
                      latitude: address.lat,
                      longitude: address.lng,
                    })
                    if (address.city) {
                      setSelectedMunicipality(municipalityToCitySuggestion(address.city, address.country || form.country))
                    }
                  }}
                  near={toGeoCoordinates(form.latitude, form.longitude)}
                />
              </span>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <label htmlFor="contact-web">
                Página web <span className={styles.optional}>· opcional</span>
              </label>
              <span>Si tienes web propia, la enlazamos desde tu ficha.</span>
            </div>
            <div className={styles.settingsRowField}>
              <span className={styles.iconInput}>
                <Globe size={16} aria-hidden="true" />
                <input
                  id="contact-web"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://turestaurante.com"
                  maxLength={200}
                  autoComplete="url"
                />
              </span>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Logo</span>
              <span>Cuadrado, PNG o JPG. Sale en tu ficha, en los correos y en el QR.</span>
            </div>
            <div className={styles.settingsRowField}>
              <div className={styles.logoField}>
                <ImageUploader
                  label="Logo del restaurante"
                  cropAspect={1}
                  hint="Se sube al elegir el archivo."
                  currentImageUrl={form.logoUrl}
                  onImageUploaded={(url) => setForm({ ...form, logoUrl: url })}
                  onImageRemoved={() => setForm({ ...form, logoUrl: '' })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHead}>
            <h3>Enlace de reservas</h3>
            <p>Compártelo en redes o imprime el QR para que tus clientes reserven mesa online.</p>
          </div>
          <div className={styles.shareLayout}>
            <div className={styles.shareMain}>
              <span className={styles.fieldTitle}>Tu enlace</span>
              <div className={styles.copyField}>
                <Link2 size={16} aria-hidden="true" />
                <input
                  ref={clientLinkInputRef}
                  type="text"
                  readOnly
                  value={clientBookingUrl}
                  aria-label="Enlace para clientes"
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.currentTarget.select()}
                />
                <button
                  type="button"
                  className={`${styles.copyFieldButton} ${linkCopied ? styles.copyFieldButtonDone : ''}`}
                  onClick={() => void handleCopyClientLink()}
                >
                  {linkCopied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  {linkCopied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className={styles.shareActions}>
                <a
                  className={styles.shareAction}
                  href={clientBookingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  Ver como cliente
                </a>
                <button
                  type="button"
                  className={styles.shareAction}
                  onClick={() => setQrCustomizerOpen(true)}
                >
                  <Palette size={15} aria-hidden="true" />
                  Personalizar QR
                </button>
                <button
                  type="button"
                  className={styles.shareAction}
                  onClick={() => void handleDownloadClientQr()}
                  disabled={isDownloadingQr}
                >
                  <Download size={15} aria-hidden="true" />
                  {isDownloadingQr ? 'Generando…' : 'Descargar QR'}
                </button>
              </div>
            </div>
            <div className={styles.qrPreview}>
              {bookingQrPreviewUrl ? (
                <img src={bookingQrPreviewUrl} alt="QR de reservas" />
              ) : (
                <span className={styles.qrPlaceholder} aria-hidden="true">
                  <QrCode size={28} />
                </span>
              )}
              <span>QR de reservas</span>
              {qrScanCounts ? <small className={styles.qrScanCount}>{qrScanLabel(qrScanCounts.reservas)}</small> : null}
            </div>
          </div>
        </div>

        {renderSectionSave('contact', 'Guardar contacto', handleSaveContact)}
      </section>

      <section className={sectionCardClass('profile', activeSection)}>
        <SectionHeader
          title="Perfil del local"
          subtitle="Cómo te encuentran y cómo te ven los clientes en Adelia."
        />

        <div className={styles.completeness}>
          <div className={styles.completenessHead}>
            <span className={styles.completenessRing} style={{ ['--pct' as string]: `${profileCompleteness.percent}` }}>
              <strong>{profileCompleteness.percent}%</strong>
            </span>
            <div>
              <h3>
                {profileCompleteness.percent === 100 ? '¡Perfil completo!' : `Perfil completo al ${profileCompleteness.percent} %`}
              </h3>
              <p>
                {profileCompleteness.percent === 100
                  ? 'Tienes todo lo que los clientes miran antes de reservar.'
                  : 'Los locales con el perfil completo aparecen mejor en las búsquedas y reciben más reservas.'}
              </p>
            </div>
          </div>
          <ul className={styles.completenessList}>
            {profileCompleteness.items.map((item) => (
              <li key={item.label} className={item.done ? styles.checkDone : styles.checkTodo}>
                <span aria-hidden="true">{item.done ? <Check size={13} strokeWidth={3} /> : null}</span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHead}>
            <h3>Ubicación</h3>
            <p>Obligatoria para aparecer en Adelia y en el mapa de la app.</p>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <label htmlFor="location-address" className={styles.settingsRowTitle}>Dirección</label>
              <span>Escribe la calle y elígela: el municipio, el código postal, el país y el mapa se rellenan solos.</span>
            </div>
            <div className={styles.settingsRowField}>
              <span className={styles.iconInput}>
                <MapPin size={16} aria-hidden="true" />
                <AddressAutocomplete
                  id="location-address"
                  value={form.location}
                  onChange={(location) => setForm({ ...form, location })}
                  onPick={(address) => {
                    setForm({
                      ...form,
                      location: address.line,
                      municipality: address.city || form.municipality,
                      postalCode: address.postalCode || form.postalCode,
                      country: address.country || form.country,
                      latitude: address.lat,
                      longitude: address.lng,
                    })
                    if (address.city) {
                      setSelectedMunicipality(municipalityToCitySuggestion(address.city, address.country || form.country))
                    }
                  }}
                  near={toGeoCoordinates(form.latitude, form.longitude)}
                  placeholder="Calle Mayor, 12"
                />
              </span>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Municipio</span>
              <span>Elígelo de la lista para que te encuentren al buscar por ciudad.</span>
            </div>
            <div className={styles.settingsRowField}>
              <div className={styles.cityField}>
                <CityAutocomplete
                  value={selectedMunicipality}
                  onChange={(city) => {
                    setSelectedMunicipality(city)
                    setForm({
                      ...form,
                      municipality: city?.name ?? '',
                      country: city?.country || form.country,
                    })
                  }}
                  label="Municipio"
                  placeholder="Ej. Madrid"
                  variant="form"
                  compact
                />
              </div>
              <div className={styles.locationFieldsRow}>
                <label>
                  Código postal
                  <input
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="28001"
                    inputMode="numeric"
                    maxLength={10}
                  />
                </label>
                <label>
                  País
                  <input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="España"
                    maxLength={60}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Punto en el mapa</span>
              <span>Arrastra el marcador hasta la puerta del local. Así llegan sin perderse.</span>
              {form.latitude != null && form.longitude != null ? (
                <span className={styles.rowStatusOk}>
                  <MapPin size={13} aria-hidden="true" /> Ubicación marcada
                </span>
              ) : (
                <span className={styles.rowStatusTodo}>
                  <MapPin size={13} aria-hidden="true" /> Sin marcar
                </span>
              )}
            </div>
            <div className={styles.settingsRowField}>
              <div className={styles.mapWide}>
                <LocationMapPicker
                  compact
                  value={toGeoCoordinates(form.latitude, form.longitude)}
                  geocodeQuery={[form.location, form.municipality, form.country].filter(Boolean).join(', ')}
                  onChange={(coords) => {
                    setForm({
                      ...form,
                      latitude: coords.lat,
                      longitude: coords.lng,
                    })
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHead}>
            <h3>Cómo es tu local</h3>
            <p>Lo usan los filtros de la app: cuanto más completo, más te encuentran.</p>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Tipo de local</span>
              <span>Hasta {MAX_COMPANY_VENUE_TYPES}. Puedes ser restaurante y bar a la vez.</span>
            </div>
            <div className={`${styles.settingsRowField} ${styles.settingsRowFieldWide}`}>
              <div className={styles.embeddedPicker}>
                <ProfileToggleGrid
                  label="Tipo de local"
                  hideLabel
                  options={COMPANY_VENUE_TYPES}
                  selected={form.venueTypes}
                  maxSelected={MAX_COMPANY_VENUE_TYPES}
                  onChange={(venueTypes) => setForm({ ...form, venueTypes })}
                />
              </div>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Precio medio</span>
              <span>Opcional. Lo que suele gastar una persona.</span>
            </div>
            <div className={styles.settingsRowField}>
              <div className={styles.priceRow} role="group" aria-label="Rango de precio">
                {COMPANY_PRICE_RANGES.map((option) => {
                  const isOn = form.priceRange === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.priceChip} ${isOn ? styles.priceChipOn : ''}`}
                      aria-pressed={isOn}
                      onClick={() =>
                        setForm({
                          ...form,
                          priceRange: isOn ? '' : option.id,
                        })
                      }
                    >
                      <strong>{option.label}</strong>
                      <span>{option.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Servicios</span>
              <span>Activa solo lo que tiene tu local: terraza, wifi, pagos, accesibilidad…</span>
            </div>
            <div className={`${styles.settingsRowField} ${styles.settingsRowFieldWide}`}>
              <div className={styles.embeddedPicker}>
                <ProfileToggleGrid
                  label="Servicios"
                  hideLabel
                  options={COMPANY_AMENITIES}
                  selected={form.amenities}
                  onChange={(amenities) => setForm({ ...form, amenities })}
                />
              </div>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Características</span>
              <span>Hasta {MAX_COMPANY_CHARACTERISTICS} palabras que te definan: romántico, para grupos, vistas…</span>
            </div>
            <div className={`${styles.settingsRowField} ${styles.settingsRowFieldWide}`}>
              <div className={styles.embeddedPicker}>
                <CharacteristicPicker
                  options={COMPANY_CHARACTERISTIC_OPTIONS}
                  hideLabel
                  selected={form.characteristics}
                  maxSelected={MAX_COMPANY_CHARACTERISTICS}
                  onChange={(characteristics) => setForm({ ...form, characteristics })}
                />
              </div>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <label htmlFor="profile-description">Descripción</label>
              <span>Cuéntalo como se lo contarías a un cliente: cocina, ambiente, qué os hace especiales.</span>
            </div>
            <div className={styles.settingsRowField}>
              <textarea
                id="profile-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={5}
                maxLength={2000}
                placeholder="Qué hace especial a tu restaurante…"
              />
              <span className={styles.fieldCounterRow}>
                {form.description.trim().length < 80 ? (
                  <span className={styles.fieldHintWarn}>Recomendado: al menos 80 caracteres</span>
                ) : <span />}
                <span className={styles.fieldCounter}>{form.description.length} / 2000</span>
              </span>
            </div>
          </div>
        </div>

        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHead}>
            <h3>Fotos y vídeos</h3>
            <p>La foto principal es la que sale en las búsquedas y arriba en tu ficha.</p>
          </div>
          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Fotos</span>
              <span>Hasta {MAX_COMPANY_PHOTOS}. Pon primero la mejor: sala, platos estrella, terraza.</span>
              <span className={form.photos.length >= 3 ? styles.rowStatusOk : styles.rowStatusTodo}>
                <ImageIcon size={13} aria-hidden="true" /> {form.photos.length} de {MAX_COMPANY_PHOTOS}
              </span>
            </div>
            <div className={`${styles.settingsRowField} ${styles.settingsRowFieldWide}`}>
              <div className={styles.embeddedPicker}>
                <MediaGalleryUploader
                  label="Fotos del local"
                  hideLabel
                  hint="Marca una como principal."
                  urls={form.photos}
                  maxItems={MAX_COMPANY_PHOTOS}
                  mediaType="image"
                  mainPhotoIndex={form.mainPhotoIndex}
                  onMainPhotoIndexChange={(mainPhotoIndex) => setForm({ ...form, mainPhotoIndex })}
                  onChange={(photos) => setForm({
                    ...form,
                    photos,
                    mainPhotoIndex: normalizeMainPhotoIndex(form.mainPhotoIndex, photos.length),
                  })}
                />
              </div>
            </div>
          </div>
          <div className={styles.settingsRow}>
            <div className={styles.settingsRowLabel}>
              <span className={styles.settingsRowTitle}>Vídeos</span>
              <span>Opcional. Un clip corto del ambiente engancha mucho.</span>
            </div>
            <div className={`${styles.settingsRowField} ${styles.settingsRowFieldWide}`}>
              <div className={styles.embeddedPicker}>
                <MediaGalleryUploader
                  label="Vídeos del local"
                  hideLabel
                  hint={companyVideoUploadHint(MAX_COMPANY_VIDEOS)}
                  urls={form.videos}
                  maxItems={MAX_COMPANY_VIDEOS}
                  mediaType="video"
                  onChange={(videos) => setForm({ ...form, videos })}
                />
              </div>
            </div>
          </div>
        </div>

        {demo ? null : (
          <FormCard
            title={
              <>
                Visibilidad del restaurante
                <span
                  className={`${styles.statusChip} ${
                    company.deactivated ? styles.statusChipOff : styles.statusChipOn
                  }`}
                >
                  {company.deactivated ? 'Desactivado' : 'Activo'}
                </span>
              </>
            }
            className={company.deactivated ? styles.visibilityCardOff : undefined}
          >
            <div className={styles.visibilityBlock}>
              <p className={styles.visibilityText}>
                {company.deactivatedByAdmin
                  ? 'Adelia ha desactivado tu restaurante. Escríbenos a soporte para volver a activarlo.'
                  : company.deactivated
                  ? 'Los clientes no pueden encontrarte, ver tu carta ni reservar. Tú conservas el acceso al panel.'
                  : 'Los clientes pueden encontrarte, ver tu carta y reservar. Si lo desactivas, desapareces de «Descubrir» y se paran las reservas y las promociones.'}
              </p>
              <label
                className={`${styles.visibilitySwitchInline} ${
                  visibilitySaving ? styles.visibilitySwitchInlineDisabled : ''
                }`}
              >
                <span className={styles.visibilitySwitchText}>
                  {company.deactivated ? 'Activar' : 'Visible'}
                </span>
                <span className={styles.visibilitySwitch}>
                  <input
                    type="checkbox"
                    className={styles.visibilitySwitchInput}
                    checked={!company.deactivated}
                    disabled={visibilitySaving || company.deactivatedByAdmin === true}
                    onChange={(event) => {
                      if (event.target.checked) {
                        void applyVisibility(false)
                      } else {
                        setDeactivateDialogOpen(true)
                      }
                    }}
                  />
                  <span className={styles.visibilitySwitchSlider} aria-hidden="true" />
                </span>
              </label>
            </div>
          </FormCard>
        )}

        {renderSectionSave('profile', 'Guardar perfil', handleSaveProfile)}
      </section>

      <section className={sectionCardClass('reservation-settings', activeSection)}>
        <SectionHeader
          title="Reservas y horario"
          subtitle="Cómo aceptas reservas, cuánto dura cada una, la fianza y los días que abres."
        />

        <div className={styles.tableKpis}>
          <div className={styles.tableKpi}>
            <span className={styles.tableKpiTop}>
              Reservas
              <span className={styles.tableKpiIcon} aria-hidden="true"><CalendarCheck size={15} /></span>
            </span>
            <strong>{RESERVATION_MODE_META[form.reservationMode].short}</strong>
            <span className={styles.tableKpiHint}>{reservationModeHint(form.reservationMode)}</span>
          </div>
          <div className={styles.tableKpi}>
            <span className={styles.tableKpiTop}>
              Duración
              <span className={styles.tableKpiIcon} aria-hidden="true"><Timer size={15} /></span>
            </span>
            <strong>{form.reservationMode === 'none' ? '—' : formatMinutesShort(form.timeSlotMinutes ?? 0)}</strong>
            <span className={styles.tableKpiHint}>
              {form.reservationMode === 'none' ? 'No aceptas reservas' : 'La mesa queda ocupada ese tiempo'}
            </span>
          </div>
          <div className={styles.tableKpi}>
            <span className={styles.tableKpiTop}>
              Abres
              <span className={styles.tableKpiIcon} aria-hidden="true"><CalendarDays size={15} /></span>
            </span>
            <strong>
              {computeScheduleSummary(form.schedule).openDays}
              <small>de 7 días</small>
            </strong>
            <span className={styles.tableKpiHint}>
              {computeScheduleSummary(form.schedule).weeklyMinutes > 0
                ? `${formatMinutesLong(computeScheduleSummary(form.schedule).weeklyMinutes)} a la semana`
                : 'Sin horario todavía'}
            </span>
          </div>
          <div className={styles.tableKpi}>
            <span className={styles.tableKpiTop}>
              Fianza
              <span className={styles.tableKpiIcon} aria-hidden="true"><ShieldCheck size={15} /></span>
            </span>
            <strong>{(form.depositEnabled && canEnableDeposits) ? 'Activa' : 'No'}</strong>
            <span className={styles.tableKpiHint}>
              {(form.depositEnabled && canEnableDeposits) && form.depositPerGuestCents
                ? `${formatEuroCents(form.depositPerGuestCents)} por persona${form.depositMinPax ? ` desde ${form.depositMinPax}` : ''}`
                : 'No se pide fianza'}
            </span>
          </div>
        </div>

        <div className={styles.settingsCard}>
          <div className={styles.settingsCardHead}>
            <h3>Cómo se reserva</h3>
            <p>Elige si tus clientes tienen que reservar, si pueden hacerlo o si no aceptas reservas.</p>
          </div>

          <div className={styles.modeCards} role="radiogroup" aria-label="Modo de reserva">
            {COMPANY_RESERVATION_MODE_OPTIONS.map((option) => {
              const selected = form.reservationMode === option.id
              const meta = RESERVATION_MODE_META[option.id]
              const Icon = meta.icon
              return (
                <label
                  key={option.id}
                  className={`${styles.modeCard} ${selected ? styles.modeCardOn : ''}`}
                >
                  <input
                    type="radio"
                    name="reservation-mode"
                    value={option.id}
                    checked={selected}
                    onChange={() => setForm({ ...form, reservationMode: option.id })}
                  />
                  <span className={styles.modeCardIcon} aria-hidden="true"><Icon size={18} /></span>
                  <span className={styles.modeCardText}>
                    <strong>{meta.title}</strong>
                    <span>{option.hint}</span>
                  </span>
                  <span className={styles.modeCardRadio} aria-hidden="true" />
                </label>
              )
            })}
          </div>

          {form.reservationMode !== 'none' ? (
            <div className={styles.settingsRow}>
              <div className={styles.settingsRowLabel}>
                <label htmlFor="reservation-duration">Duración de cada reserva</label>
                <span>
                  Entre {MIN_TIME_SLOT_MINUTES} y {MAX_TIME_SLOT_MINUTES} minutos. La mesa queda ocupada ese
                  tiempo.
                </span>
              </div>
              <div className={`${styles.settingsRowField} ${styles.durationField}`}>
                <div className={styles.durationPresets} role="group" aria-label="Duraciones habituales">
                  {DURATION_PRESETS.map((minutes) => {
                    const on = form.timeSlotMinutes === minutes && timeSlotMinutesInput === String(minutes)
                    return (
                      <button
                        key={minutes}
                        type="button"
                        className={`${styles.filterChip} ${on ? styles.filterChipOn : ''}`}
                        aria-pressed={on}
                        onClick={() => {
                          setTimeSlotMinutesInput(String(minutes))
                          setForm({ ...form, timeSlotMinutes: minutes })
                        }}
                      >
                        {formatMinutesShort(minutes)}
                      </button>
                    )
                  })}
                </div>
                <span className={styles.inputWithUnit}>
                  <input
                    id="reservation-duration"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={timeSlotMinutesInput}
                    onChange={(e) => {
                      const digits = sanitizeTimeSlotMinutesInput(e.target.value)

                      if (!digits) {
                        setTimeSlotMinutesInput('')
                        return
                      }

                      const parsed = Math.min(MAX_TIME_SLOT_MINUTES, Number(digits))
                      setTimeSlotMinutesInput(String(parsed))
                      setForm({ ...form, timeSlotMinutes: parsed })
                    }}
                    placeholder="120"
                  />
                  <span aria-hidden="true">min</span>
                </span>
              </div>
            </div>
          ) : (
            <p className={styles.modeNote}>
              Tu ficha seguirá visible, pero el botón será «Ver restaurante» en lugar de «Reservar».
            </p>
          )}
        </div>

        {form.reservationMode !== 'none' ? (
          <div className={styles.settingsCard}>
            <div className={`${styles.settingsCardHead} ${styles.settingsCardHeadRow}`}>
              <div>
                <h3>Fianza por reserva</h3>
                <p>
                  Para grupos grandes. Solo se cobra si el cliente cancela tarde o no viene. Se gestiona con
                  Stripe.
                </p>
              </div>
              <div className={styles.lockedField}>
                <label
                  className={`${styles.depositSwitchInline} ${
                    !canEnableDeposits ? styles.depositSwitchInlineDisabled : ''
                  }`}
                  title={
                    canEnableDeposits
                      ? undefined
                      : !allowsDeposits
                        ? `Las fianzas están en el plan ${requiredPlanName('deposits')}`
                        : 'Completa la conexión con Stripe para activar fianzas'
                  }
                >
                  <span className={styles.depositSwitchText}>{(form.depositEnabled && canEnableDeposits) ? 'Activada' : 'Activar'}</span>
                  <span className={styles.depositSwitch}>
                    <input
                      type="checkbox"
                      className={styles.depositSwitchInput}
                      checked={(form.depositEnabled && canEnableDeposits)}
                      disabled={!canEnableDeposits}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          depositEnabled: event.target.checked,
                          depositCancellationHours: event.target.checked
                            ? (form.depositCancellationHours ?? DEFAULT_DEPOSIT_CANCELLATION_HOURS)
                            : form.depositCancellationHours,
                        })
                      }
                    />
                    <span className={styles.depositSwitchSlider} aria-hidden="true" />
                  </span>
                </label>
                {!allowsDeposits ? (
                  <PlanLockHint feature="activar las fianzas" capabilityId="deposits" />
                ) : null}
              </div>
            </div>

            <div className={styles.stripeBlock}>
              {company ? (
                <CompanyStripeConnectPanel
                  companyId={company.id}
                  autoRefresh={activeSection === 'reservation-settings'}
                  onStatusChange={(status, loading) => {
                    setStripeStatus(status)
                    setStripeStatusLoading(loading)
                  }}
                />
              ) : null}
              {!allowsDeposits ? (
                <p className={styles.depositLockedHint}>
                  Las fianzas están en el plan {requiredPlanName('deposits')}.
                </p>
              ) : !canEnableDeposits ? (
                <p className={styles.depositLockedHint}>
                  {stripeStatusLoading
                    ? 'Comprobando estado de Stripe…'
                    : 'Completa la conexión con Stripe para poder activar las fianzas.'}
                </p>
              ) : null}
            </div>

            {(form.depositEnabled && canEnableDeposits) ? (
              <>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowLabel}>
                    <label htmlFor="deposit-min-pax">A partir de cuántas personas</label>
                    <span>Las reservas más pequeñas no pagan fianza.</span>
                  </div>
                  <div className={styles.settingsRowField}>
                    <span className={`${styles.inputWithUnit} ${styles.inputWithUnitWide}`}>
                      <input
                        id="deposit-min-pax"
                        type="number"
                        min={0}
                        max={500}
                        value={form.depositMinPax ?? ''}
                        onChange={(event) => {
                          const raw = event.target.value.trim()

                          if (!raw) {
                            setForm({ ...form, depositMinPax: null })
                            return
                          }

                          const parsed = Math.min(500, Math.max(0, Number(raw)))

                          setForm({
                            ...form,
                            depositMinPax: parsed > 0 ? Math.trunc(parsed) : null,
                          })
                        }}
                        placeholder="15"
                      />
                      <span aria-hidden="true">personas</span>
                    </span>
                  </div>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowLabel}>
                    <label htmlFor="deposit-per-guest">Fianza por persona</label>
                    <span>Se multiplica por el número de comensales.</span>
                  </div>
                  <div className={styles.settingsRowField}>
                    <span className={`${styles.inputWithUnit} ${styles.inputWithUnitWide}`}>
                      <input
                        id="deposit-per-guest"
                        type="text"
                        inputMode="decimal"
                        value={
                          form.depositPerGuestCents != null
                            ? (form.depositPerGuestCents / 100).toFixed(2).replace('.', ',')
                            : ''
                        }
                        onChange={(event) => {
                          const normalized = event.target.value.trim().replace(',', '.')

                          if (!normalized) {
                            setForm({ ...form, depositPerGuestCents: null })
                            return
                          }

                          const euros = Number(normalized)

                          if (!Number.isFinite(euros) || euros < 0) {
                            return
                          }

                          setForm({
                            ...form,
                            depositPerGuestCents: Math.min(500_00, Math.round(euros * 100)),
                          })
                        }}
                        placeholder="10,00"
                      />
                      <span aria-hidden="true">€</span>
                    </span>
                  </div>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowLabel}>
                    <label htmlFor="deposit-hours">Cancelación sin cargo</label>
                    <span>Hasta cuántas horas antes puede cancelar sin perder la fianza.</span>
                  </div>
                  <div className={styles.settingsRowField}>
                    <span className={`${styles.inputWithUnit} ${styles.inputWithUnitWide}`}>
                      <input
                        id="deposit-hours"
                        type="number"
                        min={1}
                        max={720}
                        value={form.depositCancellationHours ?? ''}
                        onChange={(event) => {
                          const raw = event.target.value.trim()

                          if (!raw) {
                            setForm({ ...form, depositCancellationHours: null })
                            return
                          }

                          const parsed = Math.min(720, Math.max(1, Number(raw)))

                          setForm({
                            ...form,
                            depositCancellationHours: Number.isFinite(parsed)
                              ? Math.trunc(parsed)
                              : null,
                          })
                        }}
                        placeholder="24"
                      />
                      <span aria-hidden="true">horas antes</span>
                    </span>
                  </div>
                </div>

                {form.depositMinPax && form.depositPerGuestCents ? (
                  <div className={styles.depositExample}>
                    <span className={styles.depositExampleIcon} aria-hidden="true"><Wallet size={16} /></span>
                    <p>
                      <strong>Ejemplo:</strong> una reserva de {form.depositMinPax + 5} personas paga{' '}
                      <strong>{formatEuroCents(form.depositPerGuestCents * (form.depositMinPax + 5))}</strong>{' '}
                      de fianza ({formatEuroCents(form.depositPerGuestCents)} × {form.depositMinPax + 5}).
                      {form.depositCancellationHours ? (
                        <> {formatDepositCancellationPolicy(form.depositCancellationHours)}</>
                      ) : null}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div className={styles.settingsCard}>
          <div className={`${styles.settingsCardHead} ${styles.settingsCardHeadRow}`}>
            <div>
              <h3>Horario semanal</h3>
              <p>
                Hasta {MAX_SCHEDULE_PERIODS} tramos por día (por ejemplo, comidas y cenas). Los tramos no pueden
                cruzarse.
              </p>
            </div>
            <div className={styles.scheduleLegend} aria-hidden="true">
              <span><i className={styles.scheduleLegendOpen} /> Abierto</span>
              <span><i className={styles.scheduleLegendClosed} /> Cerrado</span>
            </div>
          </div>

          <div className={styles.weekList}>
            <div className={styles.weekRuler} aria-hidden="true">
              <span />
              <span />
              <span className={styles.weekRulerTicks}>
                {['0h', '6h', '12h', '18h', '24h'].map((tick) => (
                  <i key={tick}>{tick}</i>
                ))}
              </span>
              <span />
            </div>
            {SCHEDULE_DAY_KEYS.map((dayKey) => {
              const day = form.schedule[dayKey]
              const periods = getDaySchedulePeriods(day)
              const periodCount = periods.length
              const dayLabel = SCHEDULE_DAY_LABELS[dayKey]
              const setDay = (next: DaySchedule) =>
                setForm({ ...form, schedule: { ...form.schedule, [dayKey]: next } })

              return (
                <div
                  key={dayKey}
                  className={`${styles.weekRow} ${!day.active ? styles.weekRowClosed : ''}`}
                >
                  <label className={styles.weekDay}>
                    <span className={styles.daySwitch}>
                      <input
                        type="checkbox"
                        checked={day.active}
                        aria-label={`Abrir el ${dayLabel.toLowerCase()}`}
                        onChange={(e) => setDay({ ...day, active: e.target.checked })}
                      />
                      <span aria-hidden="true" />
                    </span>
                    <span className={styles.dayNameFull}>{dayLabel}</span>
                    <span className={styles.dayNameShort}>{SCHEDULE_DAY_SHORT[dayKey]}</span>
                  </label>

                  <div className={styles.weekPeriods}>
                    {!day.active ? (
                      <span className={styles.weekClosedPill}>Cerrado</span>
                    ) : (
                      <>
                        {periods.map((period, periodIndex) => (
                          <div key={periodIndex} className={styles.periodPill}>
                            <input
                              type="time"
                              value={period.open}
                              aria-label={`Apertura tramo ${periodIndex + 1}, ${dayLabel}`}
                              onChange={(e) =>
                                setDay(updateDaySchedulePeriod(day, periodIndex, 'open', e.target.value))
                              }
                            />
                            <span aria-hidden="true">–</span>
                            <input
                              type="time"
                              value={period.close}
                              aria-label={`Cierre tramo ${periodIndex + 1}, ${dayLabel}`}
                              onChange={(e) =>
                                setDay(updateDaySchedulePeriod(day, periodIndex, 'close', e.target.value))
                              }
                            />
                            {periodCount > 1 ? (
                              <button
                                type="button"
                                className={styles.periodRemove}
                                aria-label={`Quitar tramo ${periodIndex + 1} del ${dayLabel.toLowerCase()}`}
                                title="Quitar tramo"
                                onClick={() =>
                                  setDay(
                                    syncDayScheduleFields({
                                      active: day.active,
                                      periods: periods.filter((_, index) => index !== periodIndex),
                                    }),
                                  )
                                }
                              >
                                <X size={13} aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        ))}
                        {periodCount < MAX_SCHEDULE_PERIODS ? (
                          <button
                            type="button"
                            className={styles.periodAdd}
                            onClick={() => setDay(addSchedulePeriod(day))}
                          >
                            <Plus size={13} aria-hidden /> Tramo
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div
                    className={styles.weekBar}
                    role="img"
                    aria-label={
                      day.active
                        ? `${dayLabel}: ${periods.map((p) => `${p.open || '?'}–${p.close || '?'}`).join(', ')}`
                        : `${dayLabel}: cerrado`
                    }
                  >
                    {day.active
                      ? periods.map((period, periodIndex) => {
                          const range = periodRange(period)
                          return range ? (
                            <span
                              key={periodIndex}
                              style={{ left: `${range.left}%`, width: `${range.width}%` }}
                            />
                          ) : null
                        })
                      : null}
                  </div>

                  <button
                    type="button"
                    className={styles.weekCopy}
                    title={`Copiar el horario del ${dayLabel.toLowerCase()} a todos los días`}
                    aria-label={`Copiar el horario del ${dayLabel.toLowerCase()} a todos los días`}
                    onClick={() => {
                      const nextSchedule = { ...form.schedule }
                      for (const key of SCHEDULE_DAY_KEYS) {
                        nextSchedule[key] = syncDayScheduleFields({
                          active: day.active,
                          periods: periods.map((p) => ({ ...p })),
                        })
                      }
                      setForm({ ...form, schedule: nextSchedule })
                      setCopiedDay(dayKey)
                    }}
                  >
                    {copiedDay === dayKey ? <CopyCheck size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                    <span>{copiedDay === dayKey ? 'Copiado' : 'A todos'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {renderSectionSave('reservation-settings', 'Guardar reservas y horario', handleSaveReservations)}
      </section>

      <section className={`${sectionCardClass('tables', activeSection)} ${styles.tablesSection}`}>
        <SectionHeader
          title="Mesas y mapas"
          subtitle="Nombre, plazas y mapa de cada mesa. Activa solo los mapas que quieras enseñar al reservar."
        />

        <div className={styles.tableKpis}>
          <div className={styles.tableKpi}>
            <span className={styles.tableKpiTop}>
              Mesas
              <span className={styles.tableKpiIcon} aria-hidden="true"><Armchair size={15} /></span>
            </span>
            <strong>
              {tables.length}
              {typeof maxTables === 'number' && maxTables > 0 ? <small>de {maxTables} del plan</small> : null}
            </strong>
            {typeof maxTables === 'number' && maxTables > 0 ? (
              <span className={styles.tableKpiBar} aria-hidden="true">
                <span
                  className={tables.length > maxTables ? styles.tableKpiBarOver : undefined}
                  style={{ width: `${Math.min(100, (tables.length / maxTables) * 100)}%` }}
                />
              </span>
            ) : (
              <span className={styles.tableKpiHint}>Sin límite en tu plan</span>
            )}
          </div>
          <div className={styles.tableKpi}>
            <span className={styles.tableKpiTop}>
              Plazas
              <span className={styles.tableKpiIcon} aria-hidden="true"><Users size={15} /></span>
            </span>
            <strong>{totalSeats}</strong>
            <span className={styles.tableKpiHint}>
              {averageSeats ? `${averageSeats.toLocaleString('es-ES', { maximumFractionDigits: 1 })} de media por mesa` : '—'}
            </span>
          </div>
          <div className={styles.tableKpi}>
            <span className={styles.tableKpiTop}>
              Mapas activos
              <span className={styles.tableKpiIcon} aria-hidden="true"><MapIcon size={15} /></span>
            </span>
            <strong>
              {activeMapCount}
              <small>de {form.floorPlans.length}</small>
            </strong>
            <span className={styles.tableKpiHint}>Los que ven los clientes al reservar</span>
          </div>
          <div className={styles.tableKpi}>
            <span className={styles.tableKpiTop}>
              Por tamaño
              <span className={styles.tableKpiIcon} aria-hidden="true"><LayoutGrid size={15} /></span>
            </span>
            <span className={styles.sizeBreakdown}>
              {capacityGroups.length === 0 ? '—' : capacityGroups.map(([capacity, count]) => (
                <span key={capacity} title={`${count} ${count === 1 ? 'mesa' : 'mesas'} de ${capacity}`}>
                  <strong>{count}</strong>×{capacity}
                </span>
              ))}
            </span>
            <span className={styles.tableKpiHint}>mesas × personas</span>
          </div>
        </div>

        <div className={styles.tablesLayout}>
          <FormCard
            title="Listado de mesas"
            className={styles.tablesListPanel}
            actions={
              demo ? null : (
                <LockedControl
                  locked={!canAddTable}
                  feature="añadir más mesas"
                  capabilityId="tables"
                  requiredPlanId={planRequiredForCount('tables', tables.length + 1)}
                >
                  <button type="button" className={styles.addButton} onClick={addTable}>
                    + Añadir mesa
                  </button>
                </LockedControl>
              )
            }
          >
            <div className={styles.tablesFilters}>
              <label className={`${styles.tablesFilterField} ${styles.tablesSearch}`}>
                <span className={styles.srOnly}>Buscar mesa</span>
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="Buscar mesa…"
                  aria-label="Buscar mesa por nombre"
                />
              </label>
              {hasTableFilters && (
                <button
                  type="button"
                  className={styles.tablesFilterClear}
                  onClick={() => {
                    setTableSearchQuery('')
                    setTableCapacityFilter('')
                    setTableMapFilter('')
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>
            {form.floorPlans.length > 1 ? (
              <div className={styles.filterChips} role="group" aria-label="Filtrar por mapa">
                <button
                  type="button"
                  className={`${styles.filterChip} ${!tableMapFilter ? styles.filterChipOn : ''}`}
                  aria-pressed={!tableMapFilter}
                  onClick={() => setTableMapFilter('')}
                >
                  Todos los mapas <span>{tables.length}</span>
                </button>
                {tablesPerMap.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`${styles.filterChip} ${tableMapFilter === plan.id ? styles.filterChipOn : ''}`}
                    aria-pressed={tableMapFilter === plan.id}
                    onClick={() => {
                      setTableMapFilter(plan.id)
                      setSelectedMapId(plan.id)
                    }}
                  >
                    <span className={`${styles.mapTabDot} ${plan.enabled ? styles.mapTabDotOn : ''}`} aria-hidden="true" />
                    {plan.name} <span>{plan.count}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {tableCapacityOptions.length > 1 ? (
              <div className={styles.filterChips} role="group" aria-label="Filtrar por plazas">
                <span className={styles.filterChipsLabel}>Plazas</span>
                {tableCapacityOptions.map((capacity) => {
                  const on = tableCapacityFilter === String(capacity)
                  return (
                    <button
                      key={capacity}
                      type="button"
                      className={`${styles.filterChip} ${styles.filterChipSmall} ${on ? styles.filterChipOn : ''}`}
                      aria-pressed={on}
                      onClick={() => setTableCapacityFilter(on ? '' : String(capacity))}
                    >
                      {capacity}
                    </button>
                  )
                })}
              </div>
            ) : null}
            <div className={styles.tablesGrid} role="table" aria-label="Listado de mesas">
              <div className={`${styles.tablesGridHeader} ${styles.tablesGridRowWithMap}`} role="row">
                <span role="columnheader">Nombre</span>
                <span role="columnheader" title="Capacidad (personas)">Plazas</span>
                <span role="columnheader">Mapa</span>
                <span className={styles.tablesGridHeaderAction} aria-hidden="true" />
              </div>
              {filteredTableEntries.length === 0 ? (
                <p className={styles.tablesFilterEmpty}>
                  {hasTableFilters
                    ? 'Ninguna mesa coincide con los filtros.'
                    : 'No hay mesas. Añade la primera con «+ Añadir mesa».'}
                </p>
              ) : (
                filteredTableEntries.map(({ table, index }) => (
                  <div
                    key={table.id ?? `new-${index}`}
                    className={`${styles.tablesGridRow} ${styles.tablesGridRowWithMap} ${
                      typeof maxTables === 'number' && maxTables > 0 && index >= maxTables
                        ? styles.tablesGridRowOver
                        : ''
                    }`}
                    role="row"
                  >
                    <input
                      className={styles.tablesGridCell}
                      value={table.name}
                      onChange={(e) => updateTable(index, { name: e.target.value })}
                      placeholder="Mesa 1"
                      aria-label={`Nombre mesa ${index + 1}`}
                    />
                    <span className={styles.stepper}>
                      {demo ? null : (
                        <button
                          type="button"
                          onClick={() => updateTable(index, { capacity: Math.max(1, table.capacity - 1) })}
                          disabled={table.capacity <= 1}
                          aria-label={`Una plaza menos en ${table.name || `mesa ${index + 1}`}`}
                        >
                          −
                        </button>
                      )}
                      <input
                        className={`${styles.tablesGridCell} ${styles.tablesGridCellNumber}`}
                        type="number"
                        min={1}
                        max={99}
                        value={table.capacity}
                        onChange={(e) =>
                          updateTable(index, { capacity: Math.min(99, Number(e.target.value) || 1) })
                        }
                        aria-label={`Capacidad mesa ${index + 1}`}
                      />
                      {demo ? null : (
                        <button
                          type="button"
                          onClick={() => updateTable(index, { capacity: Math.min(99, table.capacity + 1) })}
                          disabled={table.capacity >= 99}
                          aria-label={`Una plaza más en ${table.name || `mesa ${index + 1}`}`}
                        >
                          +
                        </button>
                      )}
                    </span>
                    <select
                      className={`${styles.tablesGridCell} ${styles.tablesGridCellSelect}`}
                      value={table.floorPlanId || form.floorPlans[0]?.id || ''}
                      onChange={(e) => {
                        const nextPlanId = e.target.value
                        setTables((current) => {
                          const next = current.map((item, tableIndex) =>
                            tableIndex === index ? { ...item, floorPlanId: nextPlanId } : item,
                          )
                          syncMapsWithTables(next)
                          return next
                        })
                      }}
                      aria-label={`Mapa de ${table.name || `mesa ${index + 1}`}`}
                    >
                      {form.floorPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.enabled ? plan.name : `${plan.name} (inactivo)`}
                        </option>
                      ))}
                    </select>
                    {demo ? <span aria-hidden="true" /> : (
                    <button
                      type="button"
                      className={styles.tablesDeleteButton}
                      onClick={() => removeTable(index)}
                      disabled={tables.length <= 1}
                      title="Eliminar mesa"
                      aria-label={`Eliminar ${table.name || `mesa ${index + 1}`}`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    )}
                  </div>
                ))
              )}
            </div>
            {!demo && typeof maxTables === 'number' && maxTables > 0 && tables.length > maxTables ? (
              <p className={styles.planOverLimit} role="status">
                Tu plan permite {maxTables} mesas reservables: los clientes solo pueden reservar las {maxTables} primeras
                de la lista. Las otras {tables.length - maxTables} (en gris) se guardan, pero no salen al reservar. Pasa
                a {requiredPlanName('tables', planRequiredForCount('tables', tables.length))} o elimina las que no uses.
              </p>
            ) : null}
          </FormCard>

          <FormCard
            title="Mapa del local"
            description={
              selectedPlan?.enabled
                ? 'Los clientes verán este mapa al reservar.'
                : 'El mapa se guarda, pero los clientes no lo verán hasta que lo actives.'
            }
            className={styles.mapPanel}
          >
            {activeSection === 'tables' ? (
              <>
                <div className={styles.mapTabs}>
                  <div className={styles.mapTabList} role="tablist" aria-label="Mapas del restaurante">
                    {form.floorPlans.map((plan) => {
                      const selected = selectedPlan?.id === plan.id
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          className={`${styles.mapTab} ${selected ? styles.mapTabActive : ''} ${plan.enabled ? '' : styles.mapTabInactive}`}
                          onClick={() => setSelectedMapId(plan.id)}
                        >
                          <span
                            className={`${styles.mapTabDot} ${plan.enabled ? styles.mapTabDotOn : ''}`}
                            aria-hidden="true"
                          />
                          {plan.name}
                          {plan.enabled ? '' : <span className={styles.srOnly}> (inactivo)</span>}
                        </button>
                      )
                    })}
                    {demo ? null : (
                      <button
                        type="button"
                        className={styles.mapAddButton}
                        onClick={addFloorPlan}
                        disabled={form.floorPlans.length >= maxFloorPlans}
                      >
                        + Añadir mapa
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.mapMetaRow}>
                  <label className={styles.mapNameField}>
                    <span>Nombre del mapa</span>
                    <input
                      value={selectedPlan?.name ?? ''}
                      onChange={(e) => {
                        const planId = selectedPlan?.id || ''
                        if (!selectedMapId && planId) {
                          setSelectedMapId(planId)
                        }
                        renameSelectedMap(planId, e.target.value)
                      }}
                      placeholder="Terraza, comedor, Piso 1…"
                      maxLength={40}
                      aria-label="Nombre del mapa seleccionado"
                    />
                  </label>
                  {selectedPlan ? (
                    <div className={styles.lockedField}>
                      <label className={styles.mapSwitchInline}>
                        <span className={styles.mapSwitchText}>
                          {selectedPlan.enabled ? 'Activo al reservar' : 'Inactivo al reservar'}
                        </span>
                        <span className={styles.mapSwitch}>
                          <input
                            type="checkbox"
                            className={styles.mapSwitchInput}
                            checked={selectedPlan.enabled}
                            onChange={(e) => setMapEnabled(selectedPlan.id, e.target.checked)}
                          />
                          <span className={styles.mapSwitchSlider} aria-hidden="true" />
                        </span>
                      </label>
                      {!allowsFloorPlan ? (
                        <PlanLockHint feature="activar el mapa al reservar" capabilityId="floor_plan" />
                      ) : maxActiveMaps != null
                        && !selectedPlan.enabled
                        && (form.floorPlans.filter((plan) => plan.enabled).length >= maxActiveMaps) ? (
                        <PlanLockHint
                          feature={maxActiveMaps === 1 ? 'activar más de un mapa' : 'activar más mapas'}
                          capabilityId="active_maps"
                          requiredPlanId={planRequiredForCount(
                            'active_maps',
                            form.floorPlans.filter((plan) => plan.enabled).length + 1,
                          )}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {!demo && form.floorPlans.length > 1 ? (
                    <button
                      type="button"
                      className={styles.mapDeleteButton}
                      onClick={() => removeSelectedMap()}
                    >
                      Quitar mapa
                    </button>
                  ) : null}
                </div>
                <Suspense fallback={<p className={styles.mapPlaceholder}>Cargando mapa…</p>}>
                  {selectedPlan ? (
                    <FloorPlanEditor
                      key={selectedPlan.id}
                      embedded
                      readOnly={demo}
                      tables={tablesForFloorPlan(tables, selectedPlan, form.floorPlans)}
                      floorPlan={selectedPlan}
                      onChange={(floorPlan) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                ...withFloorPlans(
                                  current.floorPlans.map((plan) =>
                                    plan.id === floorPlan.id
                                      ? { ...floorPlan, enabled: plan.enabled }
                                      : plan,
                                  ),
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  ) : null}
                </Suspense>
              </>
            ) : (
              <p className={styles.mapPlaceholder}>
                Elige un mapa, ponle nombre y actívalo solo si quieres que los clientes lo vean al reservar.
              </p>
            )}
          </FormCard>
        </div>

        {renderSectionSave(
          'tables',
          'Guardar mesas',
          handleSaveTables,
          <button
            type="button"
            className={styles.saveMapButton}
            onClick={() => void handleSaveMapOnly()}
            disabled={isSavingMap || isAnySaving}
            title="Guarda solo la colocación del mapa, sin tocar el listado de mesas"
          >
            {isSavingMap ? 'Guardando mapa…' : 'Guardar solo el mapa'}
          </button>,
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(removeMapConfirm)}
        title="Quitar mapa"
        message={removeMapConfirm ? '¿Quitar «' + removeMapConfirm.removedName + '»? Sus mesas pasarán a «' + removeMapConfirm.fallbackName + '».' : ''}
        confirmLabel="Sí, quitar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => removeSelectedMap(true)}
        onCancel={() => setRemoveMapConfirm(null)}
      />
      <ConfirmDialog
        isOpen={deactivateDialogOpen}
        variant="danger"
        title="Desactivar restaurante"
        message="Tu restaurante dejará de aparecer en «Descubrir» y los clientes no podrán ver tu carta ni reservar. Podrás reactivarlo cuando quieras desde esta misma pantalla."
        confirmLabel={visibilitySaving ? 'Desactivando…' : 'Desactivar'}
        cancelLabel="Seguir activo"
        isLoading={visibilitySaving}
        onConfirm={() => void applyVisibility(true)}
        onCancel={() => setDeactivateDialogOpen(false)}
      />

      <QrCustomizerModal
        isOpen={qrCustomizerOpen}
        kind="booking"
        url={withQrMark(clientBookingUrl, 'reservas')}
        filename={`qr-reservas-${slugify(company.slug || company.name)}.png`}
        companyId={company.id}
        context={qrBrandingContext}
        initialConfig={company.qrBranding.booking}
        onClose={() => setQrCustomizerOpen(false)}
        onSaved={() => void refreshCompany()}
      />
    </div>
  )
})

export default CompanySettings
