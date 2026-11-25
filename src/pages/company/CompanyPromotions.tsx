import { useCallback, useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import {
  Check,
  Euro,
  Eye,
  Gift,
  Info,
  KeyRound,
  Layers,
  Pause,
  Pencil,
  Percent,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Shuffle,
  Sparkles,
  Tag,
  Tags,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import ConfirmDialog from '../../components/ConfirmDialog'
import ImageUploader from '../../components/ImageUploader'
import PromotionPhotoCollage from '../../components/promotions/PromotionPhotoCollage'
import PromotionProductPicker from '../../components/promotions/PromotionProductPicker'
import PromotionScanLanding from '../../components/promotions/PromotionScanLanding'
import QrCustomizerModal from '../../components/QrCustomizerModal'
import { useAuth } from '../../context/AuthContext'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import { getCompanyPlan, parseCompanyPlanId } from '../../data/companyPlans'
import {
  planAllowsPromotionType,
  planMaxPromosOfType,
  planRequiredForPromoCount,
  promotionTypeCapability,
  requiredPlanName,
} from '../../data/companyPlanLimits'
import { LockedControl } from '../../components/PlanLockHint'
import { getCompanyMenuNodes } from '../../services/companyMenu'
import {
  createCompanyPromotion,
  deleteCompanyPromotion,
  getCompanyPromotions,
  setCompanyPromotionActive,
  updateCompanyPromotion,
} from '../../services/promotions'
import { getPromotionPinSettings, savePromotionPinSettings } from '../../services/promotionPin'
import { getFirestoreErrorMessage } from '../../services/firestore'
import type {
  CompanyPromotion,
  MenuNode,
  PromotionInput,
  PromotionOfferKind,
  PromotionPinRotation,
  PromotionType,
} from '../../types'
import {
  defaultPromotionInput,
  defaultPromotionOffer,
  PROMOTION_OFFER_KIND_HINTS,
  PROMOTION_OFFER_KIND_LABELS,
  PROMOTION_TYPE_HINTS,
  PROMOTION_TYPE_LABELS,
  validatePromotionInput,
} from '../../types/company'
import { buildBrandedQrDataUrl } from '../../utils/bookingQr'
import { getPublicPromotionLandingUrl, slugify, withQrMark } from '../../utils/helpers'
import {
  buildPromotionProductRefs,
  formatPromotionOfferSummary,
  formatReservationOrConsumptionCount,
  suggestPromotionTitle,
} from '../../utils/promotionOffer'
import { buildPromotionScanPreview } from '../../utils/promotionScanPreview'
import { describePromotionRules } from '../../utils/promotionRules'
import {
  formatPromotionPinRotationHint,
  generatePromotionPinCode,
  normalizePromotionPinCode,
  PROMOTION_PIN_ROTATION_LABELS,
  validatePromotionPinCode,
} from '../../utils/promotionPin'
import { defaultQrBrandingConfig, resolveBrandedQrOptions } from '../../utils/qrBranding'
import styles from './CompanyPromotions.module.css'
import { useQrScanCounts } from '../../hooks/useQrScanCounts'
import QrScanBadge from '../../components/QrScanBadge'

interface CompanyPromotionsProps {
  companyId: string
}

const PROMOTION_TYPES: PromotionType[] = ['reservation_ladder', 'time_limited', 'attendance']
const PROMOTION_OFFER_KINDS = Object.keys(PROMOTION_OFFER_KIND_LABELS) as PromotionOfferKind[]
const PIN_ROTATIONS: PromotionPinRotation[] = ['daily', 'weekly', 'monthly', 'manual']

function promotionToInput(promotion: CompanyPromotion): PromotionInput {
  return {
    type: promotion.type,
    title: promotion.title,
    description: promotion.description,
    photoUrl: promotion.photoUrl,
    offer: { ...promotion.offer },
    productIds: promotion.productRefs.map((ref) => ref.nodeId),
    active: promotion.active,
    requiresReservation: promotion.requiresReservation,
    requiredReservations: promotion.requiredReservations,
    minimumSpendEnabled: promotion.minimumSpendEnabled,
    minimumSpendCents: promotion.minimumSpendCents,
    activeFromTime: promotion.activeFromTime,
    activeToTime: promotion.activeToTime,
    maxRedemptions: promotion.maxRedemptions,
    arrivalWindowMinutes: promotion.arrivalWindowMinutes,
    maxClaimsPerCustomer: promotion.maxClaimsPerCustomer,
    claimWindowEnabled: promotion.claimWindowEnabled,
  }
}

function promotionSummary(promotion: CompanyPromotion): string {
  const offerSummary = formatPromotionOfferSummary(promotion.offer)
  const productCount = promotion.productRefs.length
  const minSpendLabel = promotion.minimumSpendEnabled && promotion.minimumSpendCents != null && promotion.minimumSpendCents > 0
    ? `mín. ${(promotion.minimumSpendCents / 100).toFixed(2).replace('.', ',')} €`
    : null

  if (promotion.type === 'reservation_ladder') {
    const parts: string[] = [offerSummary]

    if (promotion.requiresReservation && promotion.requiredReservations != null && promotion.requiredReservations > 0) {
      parts.unshift(formatReservationOrConsumptionCount(promotion.requiredReservations))
    }

    if (minSpendLabel) {
      parts.push(minSpendLabel)
    }

    return parts.join(' · ')
  }

  if (promotion.type === 'attendance') {
    const parts = [`${promotion.activeFromTime}-${promotion.activeToTime}`, offerSummary]
    if (minSpendLabel) {
      parts.push(minSpendLabel)
    }
    return parts.join(' · ')
  }

  const productLabel = productCount > 0 ? ` · ${productCount} producto${productCount === 1 ? '' : 's'}` : ''
  const parts = [`${promotion.activeFromTime}-${promotion.activeToTime}`, offerSummary]
  if (minSpendLabel) {
    parts.push(minSpendLabel)
  }
  return `${parts.join(' · ')}${productLabel}`
}

function CompanyPromotions({ companyId }: CompanyPromotionsProps) {
  const { user, profile, company, refreshCompany } = useAuth()
  const demo = useCompanyDemo()
  const planId = parseCompanyPlanId(company?.planId)
  const [promotions, setPromotions] = useState<CompanyPromotion[]>([])
  const [menuNodes, setMenuNodes] = useState<MenuNode[]>([])
  const [selectedType, setSelectedType] = useState<PromotionType>('reservation_ladder')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PromotionInput>(defaultPromotionInput('reservation_ladder'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CompanyPromotion | null>(null)
  const [pinCode, setPinCode] = useState('')
  const [pinRotation, setPinRotation] = useState<PromotionPinRotation>('manual')
  const [pinNextRotationAt, setPinNextRotationAt] = useState<Date | null>(null)
  const [pinLoading, setPinLoading] = useState(true)
  const [pinSaving, setPinSaving] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSavedMessage, setPinSavedMessage] = useState<string | null>(null)
  const [qrCustomizerOpen, setQrCustomizerOpen] = useState(false)
  const [scanPreviewOpen, setScanPreviewOpen] = useState(false)
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null)
  const qrScanCounts = useQrScanCounts(companyId)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'soldout'>('all')

  // Escape cierra el panel lateral (salvo que haya otra ventana encima).
  useEffect(() => {
    if (!drawerOpen || scanPreviewOpen || qrCustomizerOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false)
        setEditingId(null)
        setFormError(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, scanPreviewOpen, qrCustomizerOpen])

  const loadPromotions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getCompanyPromotions(companyId)
      setPromotions(data)
    } catch (err) {
      const message = getFirestoreErrorMessage(err)
      const errorCode = typeof err === 'object' && err !== null && 'code' in err
        ? String(err.code)
        : 'unknown'

      // Nada de instrucciones técnicas para el restaurante: el código ayuda a soporte.
      setError(
        errorCode === 'permission-denied'
          ? 'No se pudieron cargar tus promociones. Recarga la página y, si sigue igual, escríbenos.'
          : `${message} (${errorCode})`,
      )
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const menuProducts = useMemo(
    () => menuNodes.filter((node) => node.nodeType === 'product'),
    [menuNodes],
  )

  const previewProductRefs = useMemo(
    () => buildPromotionProductRefs(form.productIds, menuProducts),
    [form.productIds, menuProducts],
  )

  const promotionLandingUrl = company && editingId
    ? getPublicPromotionLandingUrl(company.slug, editingId)
    : ''

  const scanPreviewPromotion = useMemo(() => {
    if (!company) {
      return null
    }

    return buildPromotionScanPreview(
      company,
      form,
      previewProductRefs,
      editingId ?? 'preview',
    )
  }, [company, form, previewProductRefs, editingId])

  const qrBrandingContext = useMemo(
    () => ({
      companyName: company?.name ?? '',
      companyLogoUrl: company?.logoUrl ?? '',
      promotionTitle: form.title.trim() || company?.name || '',
    }),
    [company?.name, company?.logoUrl, form.title],
  )

  useEffect(() => {
    if (!promotionLandingUrl || !company) {
      setQrPreviewUrl(null)
      return
    }

    let cancelled = false
    const renderOptions = resolveBrandedQrOptions(
      company.qrBranding.promotion ?? defaultQrBrandingConfig(),
      'promotion',
      qrBrandingContext,
    )

    void buildBrandedQrDataUrl(withQrMark(promotionLandingUrl, 'promo'), renderOptions)
      .then((dataUrl) => {
        if (!cancelled) {
          setQrPreviewUrl(dataUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrPreviewUrl(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [company, promotionLandingUrl, qrBrandingContext])

  useEffect(() => {
    if (!scanPreviewOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setScanPreviewOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [scanPreviewOpen])

  const loadMenuProducts = useCallback(async () => {
    try {
      const nodes = await getCompanyMenuNodes(companyId)
      setMenuNodes(nodes)
    } catch {
      setMenuNodes([])
    }
  }, [companyId])

  const loadPromotionPin = useCallback(async () => {
    setPinLoading(true)
    setPinError(null)

    try {
      const settings = await getPromotionPinSettings(companyId)
      setPinCode(settings.code)
      setPinRotation(settings.rotation)
      setPinNextRotationAt(settings.nextRotationAt)
    } catch (err) {
      setPinError(getFirestoreErrorMessage(err, 'load'))
    } finally {
      setPinLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (!user || profile?.companyId !== companyId) {
      return
    }

    void loadMenuProducts()
  }, [user, profile?.companyId, companyId, loadMenuProducts])

  useEffect(() => {
    if (!user || profile?.companyId !== companyId) {
      return
    }

    void loadPromotions()
  }, [user, profile?.companyId, companyId, loadPromotions])

  useEffect(() => {
    if (!user || profile?.companyId !== companyId) {
      return
    }

    void loadPromotionPin()
  }, [user, profile?.companyId, companyId, loadPromotionPin])

  const filteredPromotions = useMemo(
    () => promotions
      .filter((promotion) => promotion.type === selectedType)
      .sort((left, right) => {
        if (selectedType === 'reservation_ladder') {
          return (left.requiredReservations ?? 0) - (right.requiredReservations ?? 0)
        }
        return right.updatedAt.getTime() - left.updatedAt.getTime()
      }),
    [promotions, selectedType],
  )

  const selectedTypeCount = promotions.filter((promotion) => promotion.type === selectedType).length
  const selectedTypeMax = planMaxPromosOfType(planId, selectedType)
  const selectedTypeAllowed = planAllowsPromotionType(planId, selectedType)
  const canCreatePromo = selectedTypeAllowed && (selectedTypeMax == null || selectedTypeCount < selectedTypeMax)
  const nextPromoPlanId = planRequiredForPromoCount(selectedType, selectedTypeCount + 1)

  const promoCapMessage = () => {
    const typeLabel = PROMOTION_TYPE_LABELS[selectedType].toLowerCase()
    const planName = getCompanyPlan(planId).name
    if (selectedTypeMax == null) {
      return `No puedes crear más promociones de ${typeLabel}.`
    }
    if (nextPromoPlanId === planId || planMaxPromosOfType(nextPromoPlanId, selectedType) === selectedTypeMax) {
      return `En ${planName} el máximo es ${selectedTypeMax} promociones de ${typeLabel}.`
    }
    return `En ${planName} puedes tener ${selectedTypeMax} promociones de ${typeLabel}. Pasa a ${requiredPlanName(promotionTypeCapability(selectedType), nextPromoPlanId)} para crear más.`
  }

  useEffect(() => {
    if (selectedTypeAllowed) {
      return
    }

    const fallback = PROMOTION_TYPES.find((type) => planAllowsPromotionType(planId, type))
    if (fallback) {
      setSelectedType(fallback)
      setForm(defaultPromotionInput(fallback))
    }
  }, [planId, selectedType, selectedTypeAllowed])

  const startCreate = () => {
    if (!selectedTypeAllowed) {
      setFormError(`Este tipo de promoción está en el plan ${requiredPlanName(promotionTypeCapability(selectedType))}.`)
      return
    }

    if (!canCreatePromo) {
      setFormError(promoCapMessage())
      return
    }

    setEditingId(null)
    setForm(defaultPromotionInput(selectedType))
    setFormError(null)
  }

  const startEdit = (promotion: CompanyPromotion) => {
    setEditingId(promotion.id)
    setForm(promotionToInput(promotion))
    setFormError(null)
  }

  const handleTypeChange = (type: PromotionType) => {
    setSelectedType(type)
    setEditingId(null)
    setForm(defaultPromotionInput(type))
    setFormError(null)
  }

  const handleSave = async () => {
    if (!planAllowsPromotionType(planId, selectedType)) {
      setFormError(`Este tipo de promoción está en el plan ${requiredPlanName(promotionTypeCapability(selectedType))}.`)
      return
    }

    if (!editingId && !canCreatePromo) {
      setFormError(promoCapMessage())
      return
    }

    const payload: PromotionInput = {
      ...form,
      type: selectedType,
      maxRedemptions: form.maxRedemptions,
      maxClaimsPerCustomer: form.maxClaimsPerCustomer,
      minimumSpendCents: form.minimumSpendEnabled ? form.minimumSpendCents : null,
    }
    const validationError = validatePromotionInput(payload, promotions, editingId)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      if (editingId) {
        await updateCompanyPromotion(companyId, editingId, payload, menuProducts)
      } else {
        const newId = await createCompanyPromotion(companyId, payload, menuProducts)
        setEditingId(newId)
      }

      await loadPromotions()
    } catch (err) {
      setFormError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setSaving(false)
    }
  }

  const handleSavePin = async (regenerate = false) => {
    if (!regenerate) {
      const validationError = validatePromotionPinCode(pinCode)
      if (validationError) {
        setPinError(validationError)
        return
      }
    }

    setPinSaving(true)
    setPinError(null)
    setPinSavedMessage(null)

    try {
      const settings = await savePromotionPinSettings(
        companyId,
        { code: pinCode, rotation: pinRotation },
        { regenerate },
      )
      setPinCode(settings.code)
      setPinRotation(settings.rotation)
      setPinNextRotationAt(settings.nextRotationAt)
      setPinSavedMessage(regenerate ? 'Código aleatorio guardado.' : 'Código guardado.')
    } catch (err) {
      setPinError(err instanceof Error ? err.message : getFirestoreErrorMessage(err, 'save'))
    } finally {
      setPinSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }

    setSaving(true)
    try {
      await deleteCompanyPromotion(companyId, deleteTarget.id)
      if (editingId === deleteTarget.id) {
        setEditingId(null)
        setForm(defaultPromotionInput(selectedType))
        setDrawerOpen(false)
      }
      setDeleteTarget(null)
      await loadPromotions()
    } catch (err) {
      setFormError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    if (!selectedTypeAllowed || !canCreatePromo) {
      startCreate()
      return
    }

    startCreate()
    setDrawerOpen(true)
  }

  const openEdit = (promotion: CompanyPromotion) => {
    startEdit(promotion)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingId(null)
    setFormError(null)
  }

  const handleToggleActive = async (promotion: CompanyPromotion) => {
    const nextActive = !promotion.active

    if (nextActive) {
      const validationError = validatePromotionInput(
        { ...promotionToInput(promotion), active: true },
        promotions,
        promotion.id,
      )
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setTogglingId(promotion.id)
    setError(null)

    try {
      await setCompanyPromotionActive(companyId, promotion.id, nextActive)
      await loadPromotions()
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setTogglingId(null)
    }
  }

  const typeCounts = PROMOTION_TYPES.reduce<Record<PromotionType, number>>((counts, type) => {
    counts[type] = promotions.filter((promotion) => promotion.type === type).length
    return counts
  }, { reservation_ladder: 0, time_limited: 0, attendance: 0 })

  const promotionStatus = (promotion: CompanyPromotion): 'active' | 'paused' | 'soldout' => {
    if (!promotion.active) {
      return 'paused'
    }
    const max = promotion.maxRedemptions
    return max != null && max > 0 && (promotion.currentRedemptions ?? 0) >= max ? 'soldout' : 'active'
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visiblePromotions = filteredPromotions.filter((promotion) => {
    if (normalizedSearch && !promotion.title.toLowerCase().includes(normalizedSearch)) {
      return false
    }
    return statusFilter === 'all' || promotionStatus(promotion) === statusFilter
  })

  const activeCount = promotions.filter((promotion) => promotionStatus(promotion) === 'active').length
  const pausedCount = promotions.filter((promotion) => promotionStatus(promotion) === 'paused').length
  const soldOutCount = promotions.filter((promotion) => promotionStatus(promotion) === 'soldout').length
  const limitedPromotions = promotions.filter((promotion) => promotion.maxRedemptions != null && promotion.maxRedemptions > 0)
  const spotsUsed = limitedPromotions.reduce((sum, promotion) => sum + (promotion.currentRedemptions ?? 0), 0)
  const spotsTotal = limitedPromotions.reduce((sum, promotion) => sum + (promotion.maxRedemptions ?? 0), 0)
  const editingPromotion = editingId ? promotions.find((item) => item.id === editingId) ?? null : null
  const previewRules = describePromotionRules({ ...form, type: selectedType })

  const STATUS_FILTERS: { id: typeof statusFilter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'active', label: 'Activas' },
    { id: 'paused', label: 'Pausadas' },
    { id: 'soldout', label: 'Agotadas' },
  ]

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Promociones</h2>
          <p className={styles.subtitle}>
            Crea ofertas por visitas, por franja horaria o con cupo. Tus clientes las ven en tu ficha y
            las canjean en el local con tu código.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadPromotions()}
            disabled={loading}
          >
            <RefreshCw size={15} aria-hidden="true" className={loading ? styles.spin : undefined} />
            Actualizar
          </button>
          <LockedControl
            locked={!canCreatePromo || !selectedTypeAllowed}
            feature="crear más promociones"
            capabilityId={promotionTypeCapability(selectedType)}
            requiredPlanId={nextPromoPlanId}
          >
            {demo ? null : (
              <button type="button" className={styles.primaryButton} onClick={openCreate}>
                <Plus size={16} aria-hidden="true" />
                Nueva promoción
              </button>
            )}
          </LockedControl>
        </div>
      </header>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Activas</span>
          <span className={styles.kpiValue}>
            {activeCount}
            <small>de {promotions.length}</small>
          </span>
          <span className={styles.kpiHint}>Visibles para tus clientes</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Plazas ocupadas</span>
          <span className={styles.kpiValue}>
            {spotsTotal > 0 ? spotsUsed : '—'}
            {spotsTotal > 0 ? <small>de {spotsTotal}</small> : null}
          </span>
          <span className={styles.kpiHint}>
            {spotsTotal > 0 ? 'En las promociones con plazas limitadas' : 'Ninguna tiene plazas limitadas'}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Agotadas</span>
          <span className={`${styles.kpiValue} ${soldOutCount > 0 ? styles.kpiWarn : ''}`}>{soldOutCount}</span>
          <span className={styles.kpiHint}>
            {soldOutCount > 0 ? 'Amplía plazas o crea otra' : 'Ninguna sin plazas'}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Pausadas</span>
          <span className={styles.kpiValue}>{pausedCount}</span>
          <span className={styles.kpiHint}>Guardadas, pero ocultas</span>
        </div>
      </div>

      <section className={styles.pinCard} aria-labelledby="promotion-pin-title">
        <span className={styles.pinIcon} aria-hidden="true">
          <KeyRound size={18} />
        </span>
        <div className={styles.pinIntro}>
          <h3 id="promotion-pin-title">Código de canje</h3>
          <p>
            {pinLoading
              ? 'Cargando código…'
              : formatPromotionPinRotationHint(pinRotation, pinNextRotationAt)}
          </p>
          {pinError && <p className={styles.inlineError}>{pinError}</p>}
          {pinSavedMessage && <p className={styles.inlineSuccess}>{pinSavedMessage}</p>}
        </div>

        {pinLoading ? null : (
          <div className={styles.pinControls}>
            <label className={styles.pinField}>
              <span className={styles.fieldLabel}>Código</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pinCode}
                onChange={(event) => {
                  setPinCode(normalizePromotionPinCode(event.target.value))
                  setPinSavedMessage(null)
                }}
                placeholder="0000"
              />
            </label>
            <label className={styles.pinRotationField}>
              <span className={styles.fieldLabel}>Cambio automático</span>
              <select
                value={pinRotation}
                onChange={(event) => {
                  setPinRotation(event.target.value as PromotionPinRotation)
                  setPinSavedMessage(null)
                }}
              >
                {PIN_ROTATIONS.map((rotation) => (
                  <option key={rotation} value={rotation}>
                    {PROMOTION_PIN_ROTATION_LABELS[rotation]}
                  </option>
                ))}
              </select>
            </label>
            {demo ? null : (
              <div className={styles.pinActions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setPinCode(generatePromotionPinCode())}
                  disabled={pinSaving}
                  title="Generar un código al azar"
                  aria-label="Generar un código al azar"
                >
                  <Shuffle size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleSavePin(false)}
                  disabled={pinSaving}
                >
                  {pinSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={styles.listCard}>
        <div className={styles.tabsBar} role="tablist" aria-label="Tipo de promoción">
          {PROMOTION_TYPES.map((type) => {
            const typeLocked = !planAllowsPromotionType(planId, type)
            const button = (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={selectedType === type}
                className={`${styles.tab} ${selectedType === type ? styles.tabActive : ''}`}
                onClick={() => handleTypeChange(type)}
              >
                {PROMOTION_TYPE_LABELS[type]}
                <span className={styles.tabCount}>{typeCounts[type]}</span>
              </button>
            )

            if (!typeLocked) {
              return button
            }

            return (
              <LockedControl
                key={type}
                locked
                feature={PROMOTION_TYPE_LABELS[type].toLowerCase()}
                capabilityId={promotionTypeCapability(type)}
              >
                {button}
              </LockedControl>
            )
          })}
        </div>

        <div className={styles.listToolbar}>
          <label className={styles.searchField}>
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por nombre…"
              aria-label="Buscar promoción por nombre"
            />
          </label>
          <div className={styles.statusFilter} role="group" aria-label="Filtrar por estado">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.statusFilterButton} ${statusFilter === option.id ? styles.statusFilterButtonOn : ''}`}
                aria-pressed={statusFilter === option.id}
                onClick={() => setStatusFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className={styles.typeHint}>
            <Info size={14} aria-hidden="true" />
            {PROMOTION_TYPE_HINTS[selectedType]}
          </p>
        </div>

        {error && <div className={styles.errorBanner} role="alert">{error}</div>}
        {formError && !drawerOpen && <div className={styles.errorBanner} role="alert">{formError}</div>}

        {loading && promotions.length === 0 ? (
          <div className={styles.stateBox}>
            <span className={styles.stateSpinner} aria-hidden="true" />
            Cargando promociones…
          </div>
        ) : visiblePromotions.length === 0 ? (
          <div className={styles.stateBox}>
            <span className={styles.stateIcon} aria-hidden="true">
              <Tag size={20} />
            </span>
            {normalizedSearch || statusFilter !== 'all' ? (
              <>
                <p className={styles.stateTitle}>Nada con estos filtros</p>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('all')
                  }}
                >
                  Quitar filtros
                </button>
              </>
            ) : (
              <>
                <p className={styles.stateTitle}>Aún no tienes promociones de «{PROMOTION_TYPE_LABELS[selectedType]}»</p>
                <p>{PROMOTION_TYPE_HINTS[selectedType]}</p>
                {demo || !canCreatePromo ? null : (
                  <button type="button" className={styles.primaryButton} onClick={openCreate}>
                    <Plus size={16} aria-hidden="true" />
                    Crear la primera
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Promoción</th>
                  <th scope="col" className={styles.colRules}>Condiciones</th>
                  <th scope="col" className={styles.colSpots}>Plazas</th>
                  <th scope="col" className={styles.colStatus}>Estado</th>
                  <th scope="col" className={styles.colActions}>
                    <span className={styles.srOnly}>Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePromotions.map((promotion) => {
                  const max = promotion.maxRedemptions
                  const used = promotion.currentRedemptions ?? 0
                  const status = promotionStatus(promotion)
                  const percent = max != null && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
                  const rules = describePromotionRules(promotion).filter((rule) => !/plaza/i.test(rule))

                  return (
                    <tr
                      key={promotion.id}
                      className={editingId === promotion.id ? styles.rowSelected : undefined}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('button')) {
                          return
                        }
                        openEdit(promotion)
                      }}
                    >
                      <td>
                        <button
                          type="button"
                          className={styles.promoCell}
                          onClick={() => openEdit(promotion)}
                        >
                          <span className={styles.promoThumb}>
                            <PromotionPhotoCollage
                              productRefs={promotion.productRefs}
                              fallbackPhotoUrl={promotion.photoUrl}
                              alt=""
                            />
                          </span>
                          <span className={styles.promoText}>
                            <strong>{promotion.title}</strong>
                            <span>{promotionSummary(promotion)}</span>
                          </span>
                        </button>
                      </td>
                      <td className={styles.colRules}>
                        <span className={styles.ruleChips}>
                          {rules.slice(0, 2).map((rule) => (
                            <em key={rule}>{rule}</em>
                          ))}
                          {rules.length > 2 ? (
                            <em title={rules.slice(2).join(' · ')}>+{rules.length - 2}</em>
                          ) : null}
                        </span>
                      </td>
                      <td className={styles.colSpots}>
                        {max != null && max > 0 ? (
                          <span className={styles.spots}>
                            <span className={styles.spotsText}>
                              <strong>{used}</strong> de {max}
                              <span className={styles.spotsPercent}>{percent}%</span>
                            </span>
                            <span
                              className={`${styles.spotsBar} ${percent >= 80 ? styles.spotsBarHigh : ''}`}
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={max}
                              aria-valuenow={used}
                              aria-label={`${used} de ${max} plazas usadas`}
                            >
                              <span style={{ width: `${percent}%` }} />
                            </span>
                          </span>
                        ) : (
                          <span className={styles.muted}>Sin límite</span>
                        )}
                      </td>
                      <td className={styles.colStatus}>
                        <span className={`${styles.statusChip} ${styles[`status_${status}`]}`}>
                          <span className={styles.statusDot} aria-hidden="true" />
                          {status === 'paused' ? 'Pausada' : status === 'soldout' ? 'Agotada' : 'Activa'}
                        </span>
                      </td>
                      <td className={styles.colActions}>
                        <div className={styles.rowActions}>
                          {demo ? null : (
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => void handleToggleActive(promotion)}
                              disabled={togglingId === promotion.id}
                              title={promotion.active ? 'Pausar' : 'Activar'}
                              aria-label={`${promotion.active ? 'Pausar' : 'Activar'} ${promotion.title}`}
                            >
                              {promotion.active
                                ? <Pause size={15} aria-hidden="true" />
                                : <Play size={15} aria-hidden="true" />}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => openEdit(promotion)}
                            title={demo ? 'Ver' : 'Editar'}
                            aria-label={`${demo ? 'Ver' : 'Editar'} ${promotion.title}`}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className={styles.tableFooter}>
              {visiblePromotions.length} de {typeCounts[selectedType]}{' '}
              {typeCounts[selectedType] === 1 ? 'promoción' : 'promociones'}
            </div>
          </div>
        )}
      </section>

      {drawerOpen ? (
        <>
          <div className={styles.drawerBackdrop} onClick={closeDrawer} aria-hidden="true" />
          <aside
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-drawer-title"
          >
            <header className={styles.drawerHeader}>
              <div className={styles.drawerHeaderText}>
                <p className={styles.drawerEyebrow}>
                  {editingId ? 'Editar promoción' : 'Nueva promoción'} · {PROMOTION_TYPE_LABELS[selectedType]}
                </p>
                <h3 id="promotion-drawer-title">
                  {form.title.trim() || (editingId ? editingPromotion?.title : '') || 'Sin título'}
                </h3>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={closeDrawer}
                aria-label="Cerrar"
                title="Cerrar (Esc)"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.drawerMain}>
              <div className={styles.drawerBody}>
                <section className={styles.formSection}>
                  <header className={styles.formSectionHead}>
                    <span className={styles.stepNumber}>1</span>
                    <div>
                      <h4>Oferta</h4>
                      <p>Lo que gana el cliente y cómo se anuncia.</p>
                    </div>
                  </header>

                  <div className={styles.fieldStack}>
                    <div className={styles.field}>
                      <div className={styles.fieldLabelRow}>
                        <label htmlFor="promotion-title" className={styles.fieldLabel}>Título</label>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => setForm({
                            ...form,
                            title: suggestPromotionTitle(form.offer, previewProductRefs),
                          })}
                        >
                          <Sparkles size={13} aria-hidden="true" />
                          Sugerir
                        </button>
                      </div>
                      <input
                        id="promotion-title"
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                        placeholder="Ej. 2×1 en cañas seleccionadas"
                      />
                    </div>

                    <div className={styles.field}>
                      <label htmlFor="promotion-description" className={styles.fieldLabel}>
                        Descripción
                      </label>
                      <textarea
                        id="promotion-description"
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                        placeholder="Explica el premio y las condiciones con tus palabras"
                      />
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel} id="promotion-offer-kind-label">Tipo de oferta</span>
                      <div
                        className={styles.offerGrid}
                        role="radiogroup"
                        aria-labelledby="promotion-offer-kind-label"
                      >
                        {PROMOTION_OFFER_KINDS.map((kind) => {
                          const Icon = OFFER_KIND_ICONS[kind]
                          const selected = form.offer.kind === kind
                          return (
                            <button
                              key={kind}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              className={`${styles.offerOption} ${selected ? styles.offerOptionOn : ''}`}
                              onClick={() => {
                                if (!selected) {
                                  setForm({ ...form, offer: defaultPromotionOffer(kind) })
                                }
                              }}
                            >
                              <span className={styles.offerIcon} aria-hidden="true">
                                <Icon size={16} />
                              </span>
                              <span className={styles.offerLabel}>{PROMOTION_OFFER_KIND_LABELS[kind]}</span>
                              {selected ? (
                                <span className={styles.offerCheck} aria-hidden="true">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                      <p className={styles.fieldHelp}>{PROMOTION_OFFER_KIND_HINTS[form.offer.kind]}</p>
                    </div>

                    {form.offer.kind === 'bundle' && (
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label htmlFor="promotion-bundle-get" className={styles.fieldLabel}>Se lleva</label>
                          <UnitInput
                            id="promotion-bundle-get"
                            unit="uds."
                            type="number"
                            min={2}
                            value={form.offer.bundleGet ?? 2}
                            onChange={(event) => setForm({
                              ...form,
                              offer: {
                                ...form.offer,
                                bundleGet: Math.max(2, Number(event.target.value) || 2),
                              },
                            })}
                          />
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="promotion-bundle-pay" className={styles.fieldLabel}>Paga</label>
                          <UnitInput
                            id="promotion-bundle-pay"
                            unit="uds."
                            type="number"
                            min={1}
                            value={form.offer.bundlePay ?? 1}
                            onChange={(event) => setForm({
                              ...form,
                              offer: {
                                ...form.offer,
                                bundlePay: Math.max(1, Number(event.target.value) || 1),
                              },
                            })}
                          />
                        </div>
                      </div>
                    )}

                    {(form.offer.kind === 'discount' || form.offer.kind === 'second_unit') && (
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label htmlFor="promotion-discount" className={styles.fieldLabel}>
                            {form.offer.kind === 'second_unit' ? 'Descuento en la 2ª unidad' : 'Descuento'}
                          </label>
                          <UnitInput
                            id="promotion-discount"
                            unit="%"
                            type="number"
                            min={1}
                            max={100}
                            value={form.offer.discountPercent ?? 20}
                            onChange={(event) => setForm({
                              ...form,
                              offer: {
                                ...form.offer,
                                discountPercent: Math.min(100, Math.max(1, Number(event.target.value) || 1)),
                              },
                            })}
                          />
                        </div>
                      </div>
                    )}

                    {form.offer.kind === 'fixed_price' && (
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label htmlFor="promotion-fixed-price" className={styles.fieldLabel}>Precio especial</label>
                          <UnitInput
                            id="promotion-fixed-price"
                            unit="€"
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={((form.offer.fixedPriceCents ?? 1000) / 100).toFixed(2)}
                            onChange={(event) => setForm({
                              ...form,
                              offer: {
                                ...form.offer,
                                fixedPriceCents: Math.max(1, Math.round(Number(event.target.value) * 100) || 1),
                              },
                            })}
                          />
                        </div>
                      </div>
                    )}

                    {form.offer.kind === 'custom' && (
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label htmlFor="promotion-custom-label" className={styles.fieldLabel}>
                            Etiqueta destacada
                          </label>
                          <input
                            id="promotion-custom-label"
                            value={form.offer.customLabel}
                            onChange={(event) => setForm({
                              ...form,
                              offer: { ...form.offer, customLabel: event.target.value },
                            })}
                            placeholder="Ej. 2×1, -20%, GRATIS"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section className={styles.formSection}>
                  <header className={styles.formSectionHead}>
                    <span className={styles.stepNumber}>2</span>
                    <div>
                      <h4>Productos e imagen</h4>
                      <p>Elige productos de tu carta: si tienen foto, la imagen se crea sola.</p>
                    </div>
                  </header>
                  <div className={styles.fieldStack}>
                    <PromotionProductPicker
                      menuNodes={menuNodes}
                      selectedIds={form.productIds}
                      onChange={(productIds) => setForm({ ...form, productIds })}
                    />
                    {(form.offer.kind === 'custom' || previewProductRefs.length === 0) && (
                      <div className={styles.photoUploaderWrap}>
                        <ImageUploader
                          label="Foto propia"
                          hint="Opcional si eliges productos con foto"
                          currentImageUrl={form.photoUrl}
                          onImageUploaded={(url) => setForm({ ...form, photoUrl: url })}
                          onImageRemoved={() => setForm({ ...form, photoUrl: '' })}
                        />
                      </div>
                    )}
                  </div>
                </section>

                <section className={styles.formSection}>
                  <header className={styles.formSectionHead}>
                    <span className={styles.stepNumber}>3</span>
                    <div>
                      <h4>Condiciones</h4>
                      <p>
                        {selectedType === 'reservation_ladder' && 'Qué tiene que hacer el cliente para conseguir el premio.'}
                        {selectedType === 'time_limited' && 'La franja horaria en la que se puede usar.'}
                        {selectedType === 'attendance' && 'Horario, plazas y tiempo para llegar.'}
                      </p>
                    </div>
                  </header>

                  <div className={styles.fieldStack}>
                    {(selectedType === 'time_limited' || selectedType === 'attendance') && (
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label htmlFor="promotion-from" className={styles.fieldLabel}>Desde</label>
                          <input
                            id="promotion-from"
                            type="time"
                            value={form.activeFromTime}
                            onChange={(event) => setForm({ ...form, activeFromTime: event.target.value })}
                          />
                        </div>
                        <div className={styles.field}>
                          <label htmlFor="promotion-to" className={styles.fieldLabel}>Hasta</label>
                          <input
                            id="promotion-to"
                            type="time"
                            value={form.activeToTime}
                            onChange={(event) => setForm({ ...form, activeToTime: event.target.value })}
                          />
                        </div>
                        {selectedType === 'attendance' && (
                          <div className={styles.field}>
                            <label htmlFor="promotion-arrival" className={styles.fieldLabel}>Tiempo para llegar</label>
                            <UnitInput
                              id="promotion-arrival"
                              unit="min"
                              type="number"
                              min={1}
                              value={form.arrivalWindowMinutes ?? 30}
                              onChange={(event) => setForm({
                                ...form,
                                arrivalWindowMinutes: Math.max(1, Number(event.target.value) || 1),
                              })}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {selectedType === 'attendance' && (
                      <p className={styles.fieldHelp}>
                        Si el cliente no confirma su llegada a tiempo, la plaza se libera sola.
                      </p>
                    )}

                    <div className={styles.optionList}>
                      {selectedType === 'reservation_ladder' && (
                        <>
                          <OptionRow
                            title="Pedir reservas o consumos"
                            description="Cada reserva o consumo verificado suma para el premio."
                            checked={form.requiresReservation}
                            onChange={(checked) => setForm({ ...form, requiresReservation: checked })}
                          >
                            <div className={styles.field}>
                              <label htmlFor="promotion-reservations" className={styles.fieldLabel}>
                                Necesarios para el premio
                              </label>
                              <UnitInput
                                id="promotion-reservations"
                                unit="visitas"
                                type="number"
                                min={form.requiresReservation ? 1 : 0}
                                value={form.requiredReservations ?? ''}
                                onChange={(event) => {
                                  const raw = event.target.value
                                  setForm({
                                    ...form,
                                    requiredReservations: raw === '' ? null : Number(raw),
                                  })
                                }}
                                placeholder="3"
                              />
                              <p className={styles.fieldHelp}>
                                Solo puede haber una oferta activa por cada número de visitas.
                              </p>
                            </div>
                          </OptionRow>

                          <OptionRow
                            title="Canjear solo en una franja horaria"
                            description="Las visitas cuentan siempre; el premio solo se reclama en esa franja."
                            checked={form.claimWindowEnabled}
                            onChange={(checked) => setForm({ ...form, claimWindowEnabled: checked })}
                          >
                            <div className={styles.fieldRow}>
                              <div className={styles.field}>
                                <label htmlFor="promotion-claim-from" className={styles.fieldLabel}>Desde</label>
                                <input
                                  id="promotion-claim-from"
                                  type="time"
                                  value={form.activeFromTime}
                                  onChange={(event) => setForm({ ...form, activeFromTime: event.target.value })}
                                />
                              </div>
                              <div className={styles.field}>
                                <label htmlFor="promotion-claim-to" className={styles.fieldLabel}>Hasta</label>
                                <input
                                  id="promotion-claim-to"
                                  type="time"
                                  value={form.activeToTime}
                                  onChange={(event) => setForm({ ...form, activeToTime: event.target.value })}
                                />
                              </div>
                            </div>
                          </OptionRow>
                        </>
                      )}

                      <OptionRow
                        title="Limitar plazas"
                        description="Solo para los primeros clientes. Al acabarse sale como «Agotada»."
                        checked={form.maxRedemptions != null}
                        onChange={(checked) => setForm({
                          ...form,
                          maxRedemptions: checked ? (form.maxRedemptions ?? 10) : null,
                        })}
                      >
                        <div className={styles.field}>
                          <label htmlFor="promotion-max" className={styles.fieldLabel}>Plazas en total</label>
                          <UnitInput
                            id="promotion-max"
                            unit="plazas"
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={form.maxRedemptions ?? ''}
                            onChange={(event) => setForm({
                              ...form,
                              maxRedemptions: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                            })}
                          />
                        </div>
                      </OptionRow>

                      <OptionRow
                        title="Limitar usos por cliente"
                        description="Por ejemplo, 1 para una promoción de primera visita."
                        checked={form.maxClaimsPerCustomer != null}
                        onChange={(checked) => setForm({
                          ...form,
                          maxClaimsPerCustomer: checked ? (form.maxClaimsPerCustomer ?? 1) : null,
                        })}
                      >
                        <div className={styles.field}>
                          <label htmlFor="promotion-per-customer" className={styles.fieldLabel}>Usos por cliente</label>
                          <UnitInput
                            id="promotion-per-customer"
                            unit={form.maxClaimsPerCustomer === 1 ? 'vez' : 'veces'}
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={form.maxClaimsPerCustomer ?? ''}
                            onChange={(event) => setForm({
                              ...form,
                              maxClaimsPerCustomer: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                            })}
                          />
                        </div>
                      </OptionRow>

                      <OptionRow
                        title="Gasto mínimo"
                        description="El cliente tiene que gastar al menos este importe."
                        checked={form.minimumSpendEnabled}
                        onChange={(checked) => setForm({
                          ...form,
                          minimumSpendEnabled: checked,
                          minimumSpendCents: checked ? (form.minimumSpendCents ?? 1200) : null,
                        })}
                      >
                        <div className={styles.field}>
                          <label htmlFor="promotion-min-spend" className={styles.fieldLabel}>Importe mínimo</label>
                          <UnitInput
                            id="promotion-min-spend"
                            unit="€"
                            type="number"
                            min={0}
                            step={0.5}
                            value={((form.minimumSpendCents ?? 0) / 100).toFixed(2)}
                            onChange={(event) => setForm({
                              ...form,
                              minimumSpendCents: Math.max(0, Math.round(Number(event.target.value) * 100) || 0),
                            })}
                          />
                        </div>
                      </OptionRow>
                    </div>
                  </div>
                </section>
              </div>

              <aside className={styles.previewPane} aria-label="Vista previa">
                <p className={styles.previewLabel}>Así lo verá el cliente</p>
                <div className={styles.previewCard}>
                  <div className={styles.previewMedia}>
                    <PromotionPhotoCollage
                      productRefs={previewProductRefs}
                      fallbackPhotoUrl={form.photoUrl}
                      size="preview"
                      alt={form.title}
                    />
                    <span className={styles.previewBadge}>{formatPromotionOfferSummary(form.offer)}</span>
                  </div>
                  <div className={styles.previewBody}>
                    <strong>{form.title.trim() || 'Título de la promoción'}</strong>
                    <p>{form.description.trim() || 'Aquí saldrá la descripción.'}</p>
                    <span className={styles.ruleChips}>
                      {previewRules.map((rule) => (
                        <em key={rule}>{rule}</em>
                      ))}
                    </span>
                  </div>
                </div>
                <p className={styles.previewHint}>
                  Si no puede usarla en ese momento (fuera de horario, sin plazas o sin usos), la verá con
                  un candado y el motivo.
                </p>

                <div className={styles.qrBlock}>
                  <div className={styles.qrHead}>
                    <QrCode size={16} aria-hidden="true" />
                    <span>QR de la promoción</span>
                  </div>
                  {qrPreviewUrl ? (
                    <>
                      <img src={qrPreviewUrl} alt="QR de la promoción" className={styles.promoQrPreview} />
                      {editingId && qrScanCounts ? (
                        <QrScanBadge count={qrScanCounts.byPromo[editingId] ?? 0} />
                      ) : null}
                    </>
                  ) : (
                    <p className={styles.previewHint}>
                      {editingId ? 'Generando QR…' : 'Guarda la promoción para crear su QR.'}
                    </p>
                  )}
                  <div className={styles.qrActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setQrCustomizerOpen(true)}
                      disabled={!editingId || !promotionLandingUrl}
                    >
                      Personalizar QR
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setScanPreviewOpen(true)}
                      disabled={!scanPreviewPromotion}
                    >
                      <Eye size={15} aria-hidden="true" />
                      Ver al escanear
                    </button>
                  </div>
                </div>
              </aside>
            </div>

            <footer className={styles.drawerFooter}>
              {formError && <div className={styles.errorBanner} role="alert">{formError}</div>}
              {demo ? (
                <p className={styles.demoNote}>En la demo las promociones se pueden ver, no crear ni editar.</p>
              ) : (
                <div className={styles.drawerFooterRow}>
                  <label className={styles.activeSwitch}>
                    <span className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(event) => setForm({ ...form, active: event.target.checked })}
                      />
                      <span aria-hidden="true" />
                    </span>
                    <span className={styles.activeSwitchText}>
                      <strong>{form.active ? 'Activa' : 'Pausada'}</strong>
                      <small>{form.active ? 'Visible para tus clientes' : 'Oculta hasta que la actives'}</small>
                    </span>
                  </label>
                  <div className={styles.drawerFooterActions}>
                    {editingId && (
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => {
                          if (editingPromotion) {
                            setDeleteTarget(editingPromotion)
                          }
                        }}
                        disabled={saving}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        Eliminar
                      </button>
                    )}
                    <button type="button" className={styles.secondaryButton} onClick={closeDrawer}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void handleSave()}
                      disabled={saving}
                    >
                      {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear promoción'}
                    </button>
                  </div>
                </div>
              )}
            </footer>
          </aside>
        </>
      ) : null}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar promoción"
        message={`¿Eliminar "${deleteTarget?.title ?? ''}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        isLoading={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      {scanPreviewOpen && scanPreviewPromotion ? (
        <div className={styles.scanPreviewOverlay} role="dialog" aria-modal="true" aria-label="Vista previa de la promoción">
          <PromotionScanLanding
            promotion={scanPreviewPromotion}
            variant="preview"
            onClosePreview={() => setScanPreviewOpen(false)}
          />
        </div>
      ) : null}

      {company && editingId && promotionLandingUrl ? (
        <QrCustomizerModal
          isOpen={qrCustomizerOpen}
          kind="promotion"
          url={withQrMark(promotionLandingUrl, 'promo')}
          filename={`qr-promo-${slugify(form.title || 'promocion')}-${slugify(company.slug || company.name)}.png`}
          companyId={companyId}
          context={qrBrandingContext}
          initialConfig={company.qrBranding.promotion ?? defaultQrBrandingConfig()}
          onClose={() => setQrCustomizerOpen(false)}
          onSaved={() => void refreshCompany()}
        />
      ) : null}
    </div>
  )
}

/** Campo numérico con su unidad pegada a la derecha (€, %, min, plazas…). */
function UnitInput({ unit, ...props }: InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  return (
    <span className={styles.inputGroup}>
      <input {...props} />
      <span className={styles.inputUnit} aria-hidden="true">{unit}</span>
    </span>
  )
}

/** Fila de opción con interruptor; al activarla despliega sus campos. */
function OptionRow({
  title,
  description,
  checked,
  onChange,
  children,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className={`${styles.optionRow} ${checked ? styles.optionRowOn : ''}`}>
      <label className={styles.switchRow}>
        <span className={styles.switchText}>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className={styles.switch}>
          <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
          <span aria-hidden="true" />
        </span>
      </label>
      {checked && children ? <div className={styles.optionDetail}>{children}</div> : null}
    </div>
  )
}

const OFFER_KIND_ICONS: Record<PromotionOfferKind, LucideIcon> = {
  bundle: Layers,
  discount: Percent,
  fixed_price: Euro,
  second_unit: Tags,
  free_item: Gift,
  custom: Sparkles,
}

export default CompanyPromotions
