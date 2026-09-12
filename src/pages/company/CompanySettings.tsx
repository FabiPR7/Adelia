import { Suspense, lazy, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import ImageUploader from '../../components/ImageUploader'
import CharacteristicPicker from '../../components/CharacteristicPicker'
import CityAutocomplete from '../../components/CityAutocomplete'
import LocationMapPicker from '../../components/LocationMapPicker'
import MediaGalleryUploader from '../../components/MediaGalleryUploader'
import ProfileToggleGrid from '../../components/ProfileToggleGrid'
import InfoHint from '../../components/company/InfoHint'
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
import type { Company, CompanySettingsPayload, SettingsSection, TableInput } from '../../types'
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
import { copyTextToClipboard, defaultSchedule, getPublicBookingUrl, selectInputText, slugify } from '../../utils/helpers'
import {
  getDaySchedulePeriodCount,
  getDaySchedulePeriods,
  MAX_SCHEDULE_PERIODS,
  normalizeCompanySchedule,
  resizeDaySchedulePeriods,
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
import { downloadBookingQrCode } from '../../utils/bookingQr'
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
} from '../../data/companyReservationMode'
import {
  applySectionSnapshot,
  createAllSectionSnapshots,
  createSectionSnapshot,
  isSectionDirty as isSettingsSectionDirty,
  type SettingsEditorState,
} from '../../utils/settingsSnapshots'
import styles from './CompanySettings.module.css'

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
  return `${styles.card} ${styles.sectionCard} ${
    activeSection === section ? styles.sectionCardActive : ''
  }`
}

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

  if (!Number.isFinite(value) || value <= 0 || value > MAX_TIME_SLOT_MINUTES) {
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

const CompanySettings = forwardRef(function CompanySettings(
  { activeSection }: CompanySettingsProps,
  ref: Ref<CompanySettingsHandle>,
) {
  const { company, refreshCompany } = useAuth()
  const demo = useCompanyDemo()
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
  const [selectedMapId, setSelectedMapId] = useState('')
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

        return matchesName && matchesCapacity
      })
  }, [tables, tableSearchQuery, tableCapacityFilter])

  const hasTableFilters = Boolean(tableSearchQuery.trim() || tableCapacityFilter)

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
      setError('La duración debe ser un número entre 1 y 240 minutos.')
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

  const removeSelectedMap = () => {
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

    if (!window.confirm(`¿Quitar «${removedName}»? Sus mesas pasarán a «${fallbackName}».`)) {
      return
    }

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

  const renderSectionSave = (
    section: SettingsSection,
    label: string,
    onSave: () => Promise<boolean> | boolean,
  ) =>
    demo ? null : (
    <div className={styles.sectionActions}>
      <button
        type="button"
        className={styles.saveButton}
        onClick={() => void Promise.resolve(onSave())}
        disabled={isAnySaving}
      >
        {savingSection === section ? 'Guardando…' : label}
      </button>
    </div>
  )

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

  const handleDownloadClientQr = async () => {
    if (!company) {
      return
    }

    setIsDownloadingQr(true)
    setError(null)

    try {
      const filename = `qr-reservas-${slugify(company.slug || company.name)}.png`
      const renderOptions = resolveBrandedQrOptions(company.qrBranding.booking, 'booking', qrBrandingContext)
      await downloadBookingQrCode(clientBookingUrl, filename, renderOptions)
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
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}
        </div>
      )}

      <section className={sectionCardClass('contact', activeSection)}>
        <header className={styles.cardHeader}>
          <h2>
            Contacto y ubicación
            <InfoHint label="Sobre contacto y ubicación">Datos visibles para clientes y reservas.</InfoHint>
          </h2>
        </header>
        <div className={`${styles.grid} ${styles.contactGrid}`}>
          <label className={styles.fullWidth}>
            Nombre del restaurante
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej. Restaurante Carol"
            />
          </label>
          <label>
            Email de contacto
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              placeholder="reservas@restaurante.com"
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              type="tel"
              inputMode="tel"
              placeholder="612 345 678"
              maxLength={20}
            />
          </label>
          <label>
            Dirección
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              maxLength={200}
              placeholder="Calle y número"
            />
          </label>
          <label className={styles.fullWidth}>
            Web (opcional)
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://turestaurante.com"
              maxLength={200}
            />
          </label>
          <div className={`${styles.fullWidth} ${styles.clientLinkBox}`}>
            <span className={styles.clientLinkLabel}>Enlace para clientes</span>
            <div className={styles.clientLinkRow}>
              <input
                ref={clientLinkInputRef}
                type="text"
                readOnly
                value={clientBookingUrl}
                className={styles.clientLinkInput}
                aria-label="Enlace para clientes"
                onFocus={(event) => event.currentTarget.select()}
                onClick={(event) => event.currentTarget.select()}
              />
              <div className={styles.clientLinkActions}>
                <button type="button" className={styles.copyLinkButton} onClick={() => void handleCopyClientLink()}>
                  {linkCopied ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  type="button"
                  className={styles.customizeQrButton}
                  onClick={() => setQrCustomizerOpen(true)}
                >
                  Personalizar QR
                </button>
                <button
                  type="button"
                  className={styles.downloadQrButton}
                  onClick={() => void handleDownloadClientQr()}
                  disabled={isDownloadingQr}
                >
                  {isDownloadingQr ? 'Generando…' : 'Descargar QR'}
                </button>
              </div>
            </div>
            <p className={styles.clientLinkHint}>
              Comparte el enlace o imprime el QR para que tus clientes reserven mesa online.
            </p>
          </div>
          <div className={`${styles.fullWidth} ${styles.logoField}`}>
            <ImageUploader
              label="Logo del restaurante"
              hint="PNG o JPG. Se sube a Cloudinary al seleccionar el archivo."
              currentImageUrl={form.logoUrl}
              onImageUploaded={(url) => setForm({ ...form, logoUrl: url })}
              onImageRemoved={() => setForm({ ...form, logoUrl: '' })}
            />
          </div>
        </div>
        {renderSectionSave('contact', 'Guardar contacto', handleSaveContact)}
      </section>

      <section className={sectionCardClass('profile', activeSection)}>
        <header className={styles.cardHeader}>
          <h2>
            Perfil del local
            <InfoHint label="Sobre el perfil del local">
              Ubicación compacta, tipo de local, servicios y hasta 10 características.
            </InfoHint>
          </h2>
        </header>

        <div className={styles.profileLayout}>
          <div className={styles.profileBlock}>
            <h3>Ubicación</h3>
            <div className={styles.locationSplit}>
              <div className={styles.locationFields}>
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
                <p className={styles.mapFieldHint}>
                  Obligatorio para aparecer en Adelia. Marca la entrada exacta en el mapa.
                </p>
              </div>
              <div className={styles.mapSquareBlock}>
                <LocationMapPicker
                  compact
                  square
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

          <div className={styles.profileBlock}>
            <ProfileToggleGrid
              label="Tipo de local"
              hint="Elige hasta 3. Un sitio puede ser restaurante y bar a la vez."
              options={COMPANY_VENUE_TYPES}
              selected={form.venueTypes}
              maxSelected={MAX_COMPANY_VENUE_TYPES}
              onChange={(venueTypes) => setForm({ ...form, venueTypes })}
            />
          </div>

          <div className={styles.profileBlock}>
            <div className={styles.priceHeader}>
              <span className={styles.priceLabel}>Precio medio</span>
              <span className={styles.priceHint}>Opcional. Lo verán los clientes.</span>
            </div>
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

          <div className={styles.profileBlock}>
            <ProfileToggleGrid
              label="Servicios"
              hint="Activa solo lo que tiene tu local: parking, wifi, pagos, accesibilidad…"
              options={COMPANY_AMENITIES}
              selected={form.amenities}
              onChange={(amenities) => setForm({ ...form, amenities })}
            />
          </div>

          <div className={styles.profileBlock}>
            <CharacteristicPicker
              options={COMPANY_CHARACTERISTIC_OPTIONS}
              selected={form.characteristics}
              maxSelected={MAX_COMPANY_CHARACTERISTICS}
              onChange={(characteristics) => setForm({ ...form, characteristics })}
            />
          </div>

          <label className={styles.profileBlock}>
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={2000}
              placeholder="Qué hace especial a tu restaurante…"
            />
          </label>

          <div className={styles.profileMedia}>
            <MediaGalleryUploader
              label="Fotos del local"
              hint={`Máximo ${MAX_COMPANY_PHOTOS} fotos. Marca una como principal.`}
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
            <MediaGalleryUploader
              label="Vídeos del local"
              hint={companyVideoUploadHint(MAX_COMPANY_VIDEOS)}
              urls={form.videos}
              maxItems={MAX_COMPANY_VIDEOS}
              mediaType="video"
              onChange={(videos) => setForm({ ...form, videos })}
            />
          </div>
        </div>
        {renderSectionSave('profile', 'Guardar perfil', handleSaveProfile)}

        {demo ? null : (
          <div
            className={`${styles.visibilityBlock} ${
              company.deactivated ? styles.visibilityBlockOff : ''
            }`}
          >
            <div className={styles.visibilityText}>
              <h3>
                Visibilidad del restaurante
                <InfoHint label="Sobre la visibilidad">
                  Si lo desactivas, tu restaurante desaparece de «Descubrir», y tu página de
                  reservas y tus promociones dejan de estar disponibles para los clientes. Tú
                  conservas el acceso al panel y puedes reactivarlo cuando quieras.
                </InfoHint>
              </h3>
              <p>
                {company.deactivated
                  ? 'Desactivado: los clientes no pueden encontrarte, ver tu carta ni reservar.'
                  : 'Activo: los clientes pueden encontrarte, ver tu carta y reservar.'}
              </p>
            </div>
            <label
              className={`${styles.visibilitySwitchInline} ${
                visibilitySaving ? styles.visibilitySwitchInlineDisabled : ''
              }`}
            >
              <span className={styles.visibilitySwitchText}>
                {company.deactivated ? 'Activar' : 'Activo'}
              </span>
              <span className={styles.visibilitySwitch}>
                <input
                  type="checkbox"
                  className={styles.visibilitySwitchInput}
                  checked={!company.deactivated}
                  disabled={visibilitySaving}
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
        )}
      </section>

      <section className={sectionCardClass('reservation-settings', activeSection)}>
        <header className={styles.cardHeader}>
          <h2>
            Reservas y horario
            <InfoHint label="Sobre reservas y horario">
              Cómo aceptas reservas, duración, fianza por comensales y días de apertura.
            </InfoHint>
          </h2>
        </header>
        <fieldset className={styles.reservationMode}>
          <legend className={styles.reservationModeLegend}>Reserva</legend>
          <div className={styles.reservationModeOptions} role="radiogroup" aria-label="Modo de reserva">
            {COMPANY_RESERVATION_MODE_OPTIONS.map((option) => {
              const selected = form.reservationMode === option.id
              return (
                <label
                  key={option.id}
                  className={`${styles.reservationModeOption} ${selected ? styles.reservationModeOptionOn : ''}`}
                >
                  <input
                    type="radio"
                    name="reservation-mode"
                    value={option.id}
                    checked={selected}
                    onChange={() => setForm({ ...form, reservationMode: option.id })}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
          <p className={styles.reservationModeHint}>{reservationModeHint(form.reservationMode)}</p>
        </fieldset>
        {form.reservationMode !== 'none' ? (
          <label className={styles.inlineField}>
            Duración de cada reserva (minutos)
            <input
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
          </label>
        ) : null}

        {form.reservationMode !== 'none' ? (
        <div className={styles.depositBlock}>
          <header className={styles.depositBlockHeader}>
            <h3>Fianzas con Stripe</h3>
            <p className={styles.scheduleHint}>
              Conecta Stripe y, cuando esté listo, activa las fianzas por reserva. Solo se cobrarán
              si el cliente cancela o no confirma su asistencia.
            </p>
          </header>

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

          <div className={styles.depositSettings}>
            <div className={styles.depositSettingsHeader}>
              <div>
                <h4>Fianza por reserva</h4>
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
                ) : (
                  <p className={styles.scheduleHint}>
                    Si una reserva alcanza el número mínimo de comensales, se pedirá fianza por
                    persona.
                  </p>
                )}
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
                <span className={styles.depositSwitchText}>Activar fianzas</span>
                <span className={styles.depositSwitch}>
                  <input
                    type="checkbox"
                    className={styles.depositSwitchInput}
                    checked={form.depositEnabled && canEnableDeposits}
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

            {form.depositEnabled && canEnableDeposits ? (
              <>
                <div className={styles.depositRow}>
                  <label className={styles.depositField}>
                    Comensales desde los que se pide fianza
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={form.depositMinPax ?? ''}
                      onChange={(event) => {
                        const raw = event.target.value.trim()

                        if (!raw) {
                          setForm({
                            ...form,
                            depositMinPax: null,
                          })
                          return
                        }

                        const parsed = Math.min(500, Math.max(0, Number(raw)))

                        setForm({
                          ...form,
                          depositMinPax: parsed > 0 ? Math.trunc(parsed) : null,
                        })
                      }}
                      placeholder="Ej. 15"
                    />
                  </label>
                  <label className={styles.depositField}>
                    Fianza por comensal (€)
                    <input
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
                      placeholder="Ej. 10,00"
                    />
                  </label>
                  <label className={styles.depositField}>
                    Cancelación sin cargo (horas antes)
                    <input
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
                      placeholder="Ej. 12"
                    />
                  </label>
                </div>
                {form.depositMinPax && form.depositPerGuestCents ? (
                  <p className={styles.depositPreview}>
                    Ejemplo: una reserva de {form.depositMinPax + 5} comensales pediría{' '}
                    <strong>
                      {((form.depositPerGuestCents * (form.depositMinPax + 5)) / 100)
                        .toFixed(2)
                        .replace('.', ',')}{' '}
                      €
                    </strong>{' '}
                    de fianza ({((form.depositPerGuestCents) / 100).toFixed(2).replace('.', ',')}{' '}
                    € × {form.depositMinPax + 5} comensales).
                    {form.depositCancellationHours ? (
                      <>
                        {' '}
                        {formatDepositCancellationPolicy(form.depositCancellationHours)}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        ) : null}

        <div className={styles.scheduleBlock}>
          <h3>Horario semanal</h3>
          <p className={styles.scheduleHint}>
            Marca los días activos y hasta {MAX_SCHEDULE_PERIODS} tramos por día (por ejemplo,
            12:00–16:00 y 20:00–00:00). Los tramos no pueden cruzarse.
          </p>
          <div className={styles.scheduleTable}>
          {SCHEDULE_DAY_KEYS.map((dayKey) => {
            const day = form.schedule[dayKey]
            const periods = getDaySchedulePeriods(day)
            const periodCount = getDaySchedulePeriodCount(day)

            return (
              <div
                key={dayKey}
                className={`${styles.scheduleTableRow} ${
                  periodCount > 1 ? styles.scheduleTableRowMulti : ''
                } ${!day.active ? styles.scheduleTableRowInactive : ''}`}
              >
                <label className={styles.scheduleDayCell}>
                  <input
                    type="checkbox"
                    checked={day.active}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        schedule: {
                          ...form.schedule,
                          [dayKey]: { ...day, active: e.target.checked },
                        },
                      })
                    }
                  />
                  <span className={styles.dayNameFull}>{SCHEDULE_DAY_LABELS[dayKey]}</span>
                  <span className={styles.dayNameShort}>{SCHEDULE_DAY_SHORT[dayKey]}</span>
                </label>

                <label className={styles.scheduleTurnsCell}>
                  <span className={styles.scheduleTurnsLabel}>Tramos</span>
                  <select
                    disabled={!day.active}
                    value={periodCount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        schedule: {
                          ...form.schedule,
                          [dayKey]: resizeDaySchedulePeriods(day, Number(e.target.value)),
                        },
                      })
                    }
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>

                <div className={styles.scheduleHoursCell}>
                  {periods.map((period, periodIndex) => (
                    <div key={periodIndex} className={styles.scheduleTimeRange}>
                      {periodCount > 1 ? (
                        <span className={styles.scheduleTimeBadge}>{periodIndex + 1}</span>
                      ) : null}
                      <input
                        type="time"
                        disabled={!day.active}
                        value={period.open}
                        aria-label={`Apertura turno ${periodIndex + 1}, ${SCHEDULE_DAY_LABELS[dayKey]}`}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            schedule: {
                              ...form.schedule,
                              [dayKey]: updateDaySchedulePeriod(
                                day,
                                periodIndex,
                                'open',
                                e.target.value,
                              ),
                            },
                          })
                        }
                      />
                      <span className={styles.scheduleTimeSep} aria-hidden="true">—</span>
                      <input
                        type="time"
                        disabled={!day.active}
                        value={period.close}
                        aria-label={`Cierre turno ${periodIndex + 1}, ${SCHEDULE_DAY_LABELS[dayKey]}`}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            schedule: {
                              ...form.schedule,
                              [dayKey]: updateDaySchedulePeriod(
                                day,
                                periodIndex,
                                'close',
                                e.target.value,
                              ),
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          </div>
        </div>
        {renderSectionSave('reservation-settings', 'Guardar reservas y horario', handleSaveReservations)}
      </section>

      <section className={`${sectionCardClass('tables', activeSection)} ${styles.tablesSection}`}>
        <header className={styles.tablesHeader}>
          <div className={styles.tablesHeaderText}>
            <h2>Mesas</h2>
            <p>Nombre, capacidad y mapa de cada mesa. Activa solo los mapas que quieras mostrar al reservar.</p>
          </div>
        </header>

        <div className={styles.tablesLayout}>
          <div className={styles.tablesListPanel}>
            <div className={styles.tablesFilters}>
              <label className={styles.tablesFilterField}>
                <span className={styles.tablesFilterLabel}>Buscar mesa</span>
                <input
                  type="search"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="Nombre de mesa…"
                  aria-label="Buscar mesa por nombre"
                />
              </label>
              <label className={styles.tablesFilterField}>
                <span className={styles.tablesFilterLabel}>Capacidad</span>
                <select
                  value={tableCapacityFilter}
                  onChange={(e) => setTableCapacityFilter(e.target.value)}
                  aria-label="Filtrar por capacidad"
                >
                  <option value="">Todas</option>
                  {tableCapacityOptions.map((capacity) => (
                    <option key={capacity} value={String(capacity)}>
                      {capacity} {capacity === 1 ? 'persona' : 'personas'}
                    </option>
                  ))}
                </select>
              </label>
              {hasTableFilters && (
                <button
                  type="button"
                  className={styles.tablesFilterClear}
                  onClick={() => {
                    setTableSearchQuery('')
                    setTableCapacityFilter('')
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className={styles.tablesGrid} role="table" aria-label="Listado de mesas">
              <div className={`${styles.tablesGridHeader} ${styles.tablesGridRowWithMap}`} role="row">
                <span role="columnheader">Nombre</span>
                <span role="columnheader">Capacidad</span>
                <span role="columnheader">Mapa</span>
                <span className={styles.tablesGridHeaderAction} aria-hidden="true" />
              </div>
              {filteredTableEntries.length === 0 ? (
                <p className={styles.tablesFilterEmpty}>
                  {hasTableFilters
                    ? 'Ninguna mesa coincide con los filtros.'
                    : 'No hay mesas. Añade la primera con el botón de abajo.'}
                </p>
              ) : (
                filteredTableEntries.map(({ table, index }) => (
                  <div
                    key={table.id ?? `new-${index}`}
                    className={`${styles.tablesGridRow} ${styles.tablesGridRowWithMap}`}
                    role="row"
                  >
                    <input
                      className={styles.tablesGridCell}
                      value={table.name}
                      onChange={(e) => updateTable(index, { name: e.target.value })}
                      placeholder="Mesa 1"
                      aria-label={`Nombre mesa ${index + 1}`}
                    />
                    <input
                      className={`${styles.tablesGridCell} ${styles.tablesGridCellNumber}`}
                      type="number"
                      min={1}
                      max={99}
                      value={table.capacity}
                      onChange={(e) =>
                        updateTable(index, { capacity: Number(e.target.value) || 1 })
                      }
                      aria-label={`Capacidad mesa ${index + 1}`}
                    />
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
                    {demo ? null : (
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
            {demo ? null : (
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
            )}
            {renderSectionSave('tables', 'Guardar mesas', handleSaveTables)}
          </div>

          <div className={styles.mapPanel}>
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
                          {plan.name}
                          {plan.enabled ? '' : ' · inactivo'}
                        </button>
                      )
                    })}
                  </div>
                  <div className={styles.mapTabActions}>
                    {demo ? null : (
                      <>
                    <button
                      type="button"
                      className={styles.mapAddButton}
                      onClick={addFloorPlan}
                      disabled={form.floorPlans.length >= maxFloorPlans}
                    >
                      + Añadir mapa
                    </button>
                    {form.floorPlans.length > 1 ? (
                      <button
                        type="button"
                        className={styles.mapDeleteButton}
                        onClick={removeSelectedMap}
                      >
                        Quitar mapa
                      </button>
                    ) : null}
                      </>
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
                </div>
                <p className={styles.mapEnabledHint}>
                  {selectedPlan?.enabled
                    ? 'Los clientes verán este mapa al reservar.'
                    : 'El mapa se guarda, pero los clientes no lo verán hasta que lo actives.'}
                </p>
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
                <div className={styles.mapActions}>
                  {demo ? null : (
                  <button
                    type="button"
                    className={styles.saveMapButton}
                    onClick={() => void handleSaveMapOnly()}
                    disabled={isSavingMap || isAnySaving}
                  >
                    {isSavingMap ? 'Guardando mapa…' : 'Guardar mapa'}
                  </button>
                  )}
                </div>
              </>
            ) : (
              <p className={styles.mapPlaceholder}>
                Elige un mapa, ponle nombre y actívalo solo si quieres que los clientes lo vean al reservar.
              </p>
            )}
          </div>
        </div>
      </section>

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
        url={clientBookingUrl}
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
