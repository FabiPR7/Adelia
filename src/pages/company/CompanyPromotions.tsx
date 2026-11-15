import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { getPublicPromotionLandingUrl, slugify } from '../../utils/helpers'
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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

    void buildBrandedQrDataUrl(promotionLandingUrl, renderOptions)
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

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visiblePromotions = normalizedSearch
    ? filteredPromotions.filter((promotion) => promotion.title.toLowerCase().includes(normalizedSearch))
    : filteredPromotions

  const activeCount = promotions.filter((promotion) => promotion.active).length
  const editingPromotion = editingId ? promotions.find((item) => item.id === editingId) ?? null : null

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Promociones</h2>
          <p className={styles.subtitle}>
            Ofertas por visitas, por franja horaria o con cupo. Los clientes las ven en tu ficha y las
            canjean en el local con tu código.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadPromotions()}
            disabled={loading}
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
          <LockedControl
            locked={!canCreatePromo || !selectedTypeAllowed}
            feature="crear más promociones"
            capabilityId={promotionTypeCapability(selectedType)}
            requiredPlanId={nextPromoPlanId}
          >
            {demo ? null : (
              <button type="button" className={styles.primaryButton} onClick={openCreate}>
                + Nueva promoción
              </button>
            )}
          </LockedControl>
        </div>
      </header>

      <section className={styles.pinCard} aria-labelledby="promotion-pin-title">
        <div className={styles.pinIntro}>
          <h3 id="promotion-pin-title">Código de canje</h3>
          <p>El cliente lo escribe en el local para validar la promoción y el gasto mínimo.</p>
        </div>

        {pinLoading ? (
          <p className={styles.pinLoading}>Cargando código…</p>
        ) : (
          <div className={styles.pinControls}>
            <label className={styles.pinField}>
              <span className={styles.srOnly}>Código actual</span>
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
                placeholder="1234"
                aria-label="Código de canje"
              />
            </label>
            <label className={styles.pinRotationField}>
              <span>Cambio automático</span>
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
                  className={styles.secondaryButton}
                  onClick={() => setPinCode(generatePromotionPinCode())}
                  disabled={pinSaving}
                >
                  Generar otro
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleSavePin(false)}
                  disabled={pinSaving}
                >
                  {pinSaving ? 'Guardando…' : 'Guardar código'}
                </button>
              </div>
            )}
          </div>
        )}

        {!pinLoading ? (
          <div className={styles.pinFooter}>
            <p className={styles.pinHint}>{formatPromotionPinRotationHint(pinRotation, pinNextRotationAt)}</p>
            {pinError && <p className={styles.inlineError}>{pinError}</p>}
            {pinSavedMessage && <p className={styles.inlineSuccess}>✓ {pinSavedMessage}</p>}
          </div>
        ) : null}
      </section>

      <section className={styles.listCard}>
        <div className={styles.listToolbar}>
          <div className={styles.typeTabs} role="tablist" aria-label="Tipo de promoción">
            {PROMOTION_TYPES.map((type) => {
              const typeLocked = !planAllowsPromotionType(planId, type)
              const button = (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={selectedType === type}
                  className={`${styles.typeTab} ${selectedType === type ? styles.typeTabActive : ''}`}
                  onClick={() => handleTypeChange(type)}
                  title={PROMOTION_TYPE_HINTS[type]}
                >
                  {PROMOTION_TYPE_LABELS[type]}
                  <span className={styles.typeTabCount}>{typeCounts[type]}</span>
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
          <div className={styles.listToolbarRight}>
            <span className={styles.activeSummary}>
              <strong>{activeCount}</strong> {activeCount === 1 ? 'activa' : 'activas'} de {promotions.length}
            </span>
            <input
              type="search"
              className={styles.searchInput}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar promoción…"
              aria-label="Buscar promoción por título"
            />
          </div>
        </div>

        <p className={styles.typeHint}>{PROMOTION_TYPE_HINTS[selectedType]}</p>

        {error && <div className={styles.errorBanner} role="alert">{error}</div>}
        {formError && !drawerOpen && <div className={styles.errorBanner} role="alert">{formError}</div>}

        {loading && promotions.length === 0 ? (
          <div className={styles.stateBox}>Cargando promociones…</div>
        ) : visiblePromotions.length === 0 ? (
          <div className={styles.stateBox}>
            {normalizedSearch ? (
              <p>Ninguna promoción coincide con «{searchQuery.trim()}».</p>
            ) : (
              <>
                <p className={styles.stateTitle}>Aún no tienes promociones de este tipo</p>
                <p>{PROMOTION_TYPE_HINTS[selectedType]}</p>
                {demo || !canCreatePromo ? null : (
                  <button type="button" className={styles.primaryButton} onClick={openCreate}>
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
                  <th scope="col">Estado</th>
                  <th scope="col" className={styles.colActions}>
                    <span className={styles.srOnly}>Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePromotions.map((promotion) => {
                  const max = promotion.maxRedemptions
                  const used = promotion.currentRedemptions ?? 0
                  const soldOut = promotion.active && max != null && max > 0 && used >= max
                  const percent = max != null && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
                  const rules = describePromotionRules(promotion).filter(
                    (rule) => !/plaza/i.test(rule),
                  )

                  return (
                    <tr
                      key={promotion.id}
                      className={editingId === promotion.id ? styles.rowSelected : undefined}
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
                          {rules.slice(0, 3).map((rule) => (
                            <em key={rule}>{rule}</em>
                          ))}
                          {rules.length > 3 ? <em>+{rules.length - 3}</em> : null}
                        </span>
                      </td>
                      <td className={styles.colSpots}>
                        {max != null && max > 0 ? (
                          <span className={styles.spots}>
                            <span className={styles.spotsText}>
                              <strong>{used}</strong> / {max}
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
                      <td>
                        <span
                          className={`${styles.statusChip} ${
                            !promotion.active
                              ? styles.statusPaused
                              : soldOut
                                ? styles.statusSoldOut
                                : styles.statusActive
                          }`}
                        >
                          {!promotion.active ? 'Pausada' : soldOut ? 'Agotada' : 'Activa'}
                        </span>
                      </td>
                      <td className={styles.colActions}>
                        <div className={styles.rowActions}>
                          {demo ? null : (
                            <button
                              type="button"
                              className={styles.rowButton}
                              onClick={() => void handleToggleActive(promotion)}
                              disabled={togglingId === promotion.id}
                            >
                              {togglingId === promotion.id
                                ? '…'
                                : promotion.active ? 'Pausar' : 'Activar'}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.rowButton}
                            onClick={() => openEdit(promotion)}
                          >
                            {demo ? 'Ver' : 'Editar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
              <div>
                <p className={styles.drawerEyebrow}>{PROMOTION_TYPE_LABELS[selectedType]}</p>
                <h3 id="promotion-drawer-title">
                  {editingId ? (editingPromotion?.title || 'Editar promoción') : 'Nueva promoción'}
                </h3>
              </div>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={closeDrawer}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>

            <div className={styles.drawerBody}>
              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Oferta</h4>
                <div className={styles.sectionGrid}>
                  <div className={`${styles.formField} ${styles.formFieldWide}`}>
                    <div className={styles.titleRow}>
                      <label htmlFor="promotion-title">Título</label>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => setForm({
                          ...form,
                          title: suggestPromotionTitle(form.offer, previewProductRefs),
                        })}
                      >
                        Sugerir título
                      </button>
                    </div>
                    <input
                      id="promotion-title"
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                      placeholder="Ej. 2×1 en cañas seleccionadas"
                    />
                  </div>

                  <div className={`${styles.formField} ${styles.formFieldWide}`}>
                    <label htmlFor="promotion-description">Descripción</label>
                    <textarea
                      id="promotion-description"
                      value={form.description}
                      onChange={(event) => setForm({ ...form, description: event.target.value })}
                      placeholder="Explica el premio y las condiciones"
                    />
                  </div>

                  <div className={`${styles.formField} ${styles.formFieldWide}`}>
                    <label htmlFor="promotion-offer-kind">Tipo de oferta</label>
                    <select
                      id="promotion-offer-kind"
                      value={form.offer.kind}
                      onChange={(event) => {
                        const kind = event.target.value as PromotionOfferKind
                        setForm({
                          ...form,
                          offer: defaultPromotionOffer(kind),
                        })
                      }}
                    >
                      {PROMOTION_OFFER_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {PROMOTION_OFFER_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                    <p className={styles.fieldHint}>{PROMOTION_OFFER_KIND_HINTS[form.offer.kind]}</p>
                  </div>

                  {form.offer.kind === 'bundle' && (
                    <>
                      <div className={styles.formField}>
                        <label htmlFor="promotion-bundle-get">Unidades que lleva</label>
                        <input
                          id="promotion-bundle-get"
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
                      <div className={styles.formField}>
                        <label htmlFor="promotion-bundle-pay">Unidades que paga</label>
                        <input
                          id="promotion-bundle-pay"
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
                    </>
                  )}

                  {(form.offer.kind === 'discount' || form.offer.kind === 'second_unit') && (
                    <div className={styles.formField}>
                      <label htmlFor="promotion-discount">
                        {form.offer.kind === 'second_unit' ? 'Descuento 2ª unidad (%)' : 'Descuento (%)'}
                      </label>
                      <input
                        id="promotion-discount"
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
                  )}

                  {form.offer.kind === 'fixed_price' && (
                    <div className={styles.formField}>
                      <label htmlFor="promotion-fixed-price">Precio fijo (€)</label>
                      <input
                        id="promotion-fixed-price"
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
                  )}

                  {form.offer.kind === 'custom' && (
                    <div className={styles.formField}>
                      <label htmlFor="promotion-custom-label">Etiqueta destacada</label>
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
                  )}
                </div>
              </section>

              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Productos e imagen</h4>
                <p className={styles.formSectionHint}>
                  Elige productos de la carta: si tienen foto, la imagen de la promoción se crea sola.
                </p>
                <div className={styles.mediaLayout}>
                  <div className={styles.productsColumn}>
                    <PromotionProductPicker
                      menuNodes={menuNodes}
                      selectedIds={form.productIds}
                      onChange={(productIds) => setForm({ ...form, productIds })}
                    />
                  </div>

                  <aside className={styles.photoColumn}>
                    <div className={styles.photoCard}>
                      <span className={styles.photoCardLabel}>Vista previa</span>
                      <PromotionPhotoCollage
                        productRefs={previewProductRefs}
                        fallbackPhotoUrl={form.photoUrl}
                        size="preview"
                        alt={form.title}
                      />
                      <div className={styles.photoCardActions}>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setQrCustomizerOpen(true)}
                          disabled={!editingId || !promotionLandingUrl}
                          title={editingId ? 'Crear y personalizar el QR de esta promoción' : 'Guarda la promoción para crear el QR'}
                        >
                          Crear QR
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setScanPreviewOpen(true)}
                          disabled={!scanPreviewPromotion}
                        >
                          Visualizar
                        </button>
                      </div>
                      {qrPreviewUrl ? (
                        <img
                          src={qrPreviewUrl}
                          alt="QR de la promoción"
                          className={styles.promoQrPreview}
                        />
                      ) : null}
                      <p className={styles.photoCardHint}>
                        {!editingId
                          ? 'Guarda la promoción para crear su QR. «Visualizar» enseña cómo se ve al escanearlo.'
                          : previewProductRefs.length === 0
                            ? 'Añade productos con foto o sube una imagen.'
                            : previewProductRefs.length === 1
                              ? 'Foto del producto elegido.'
                              : previewProductRefs.length > 4
                                ? `Collage con ${previewProductRefs.length} productos.`
                                : 'Collage con las fotos disponibles.'}
                      </p>
                    </div>

                    {(form.offer.kind === 'custom' || previewProductRefs.length === 0) && (
                      <div className={styles.photoUploaderWrap}>
                        <ImageUploader
                          label="Foto manual"
                          hint="Opcional si hay productos con foto"
                          currentImageUrl={form.photoUrl}
                          onImageUploaded={(url) => setForm({ ...form, photoUrl: url })}
                          onImageRemoved={() => setForm({ ...form, photoUrl: '' })}
                        />
                      </div>
                    )}
                  </aside>
                </div>
              </section>

              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Condiciones</h4>
                <p className={styles.formSectionHint}>
                  {selectedType === 'reservation_ladder' && 'Qué tiene que hacer el cliente para conseguir el premio.'}
                  {selectedType === 'time_limited' && 'La franja horaria en la que se puede usar.'}
                  {selectedType === 'attendance' && 'Horario, plazas y tiempo para llegar.'}
                </p>

                {selectedType === 'reservation_ladder' && (
                  <div className={styles.optionList}>
                    <label className={styles.switchRow}>
                      <span className={styles.switchText}>
                        <strong>Pedir reservas o consumos</strong>
                        <small>Cada reserva o consumo verificado suma para el premio.</small>
                      </span>
                      <span className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={form.requiresReservation}
                          onChange={(event) => setForm({
                            ...form,
                            requiresReservation: event.target.checked,
                          })}
                        />
                        <span aria-hidden="true" />
                      </span>
                    </label>
                    <div className={styles.optionDetail}>
                      <div className={styles.formField}>
                        <label htmlFor="promotion-reservations">Reservas o consumos necesarios</label>
                        <input
                          id="promotion-reservations"
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
                          placeholder={form.requiresReservation ? 'Ej. 3' : '0 o vacío'}
                        />
                      </div>
                      <p className={styles.fieldHint}>
                        Solo puede haber una oferta activa por cada número de reservas o consumos.
                      </p>
                    </div>

                    <label className={styles.switchRow}>
                      <span className={styles.switchText}>
                        <strong>Canjear solo en una franja horaria</strong>
                        <small>
                          {form.claimWindowEnabled
                            ? `Las visitas cuentan a cualquier hora, pero el premio solo se reclama de ${form.activeFromTime || '…'} a ${form.activeToTime || '…'}.`
                            : 'Por ejemplo, el postre gratis solo al mediodía.'}
                        </small>
                      </span>
                      <span className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={form.claimWindowEnabled}
                          onChange={(event) => setForm({ ...form, claimWindowEnabled: event.target.checked })}
                        />
                        <span aria-hidden="true" />
                      </span>
                    </label>
                    {form.claimWindowEnabled ? (
                      <div className={`${styles.optionDetail} ${styles.sectionGrid}`}>
                        <div className={styles.formField}>
                          <label htmlFor="promotion-claim-from">Desde</label>
                          <input
                            id="promotion-claim-from"
                            type="time"
                            value={form.activeFromTime}
                            onChange={(event) => setForm({ ...form, activeFromTime: event.target.value })}
                          />
                        </div>
                        <div className={styles.formField}>
                          <label htmlFor="promotion-claim-to">Hasta</label>
                          <input
                            id="promotion-claim-to"
                            type="time"
                            value={form.activeToTime}
                            onChange={(event) => setForm({ ...form, activeToTime: event.target.value })}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {(selectedType === 'time_limited' || selectedType === 'attendance') && (
                  <div className={styles.sectionGrid}>
                    <div className={styles.formField}>
                      <label htmlFor="promotion-from">Activa desde</label>
                      <input
                        id="promotion-from"
                        type="time"
                        value={form.activeFromTime}
                        onChange={(event) => setForm({ ...form, activeFromTime: event.target.value })}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label htmlFor="promotion-to">Activa hasta</label>
                      <input
                        id="promotion-to"
                        type="time"
                        value={form.activeToTime}
                        onChange={(event) => setForm({ ...form, activeToTime: event.target.value })}
                      />
                    </div>
                    {selectedType === 'attendance' && (
                      <div className={`${styles.formField} ${styles.formFieldWide}`}>
                        <label htmlFor="promotion-arrival">Tiempo máximo para llegar (min)</label>
                        <input
                          id="promotion-arrival"
                          type="number"
                          min={1}
                          value={form.arrivalWindowMinutes ?? 30}
                          onChange={(event) => setForm({
                            ...form,
                            arrivalWindowMinutes: Math.max(1, Number(event.target.value) || 1),
                          })}
                        />
                        <p className={styles.fieldHint}>
                          Si el cliente no confirma su llegada a tiempo, la plaza se libera sola.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className={`${styles.optionList} ${styles.optionListSpaced}`}>
                  <label className={styles.switchRow}>
                    <span className={styles.switchText}>
                      <strong>Limitar plazas en total</strong>
                      <small>
                        {form.maxRedemptions != null
                          ? `Al usarse las ${form.maxRedemptions} plazas saldrá como «Agotada».`
                          : 'Sin límite: puede usarla todo el que quiera.'}
                      </small>
                    </span>
                    <span className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={form.maxRedemptions != null}
                        onChange={(event) => setForm({
                          ...form,
                          maxRedemptions: event.target.checked ? (form.maxRedemptions ?? 10) : null,
                        })}
                      />
                      <span aria-hidden="true" />
                    </span>
                  </label>
                  {form.maxRedemptions != null ? (
                    <div className={styles.optionDetail}>
                      <div className={styles.formField}>
                        <label htmlFor="promotion-max">Plazas en total</label>
                        <input
                          id="promotion-max"
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={form.maxRedemptions}
                          onChange={(event) => setForm({
                            ...form,
                            maxRedemptions: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                          })}
                        />
                      </div>
                    </div>
                  ) : null}

                  <label className={styles.switchRow}>
                    <span className={styles.switchText}>
                      <strong>Limitar usos por cliente</strong>
                      <small>
                        {form.maxClaimsPerCustomer != null
                          ? `Cada cliente podrá usarla ${form.maxClaimsPerCustomer === 1 ? 'una sola vez' : `${form.maxClaimsPerCustomer} veces`}.`
                          : 'Sin límite: cada cliente puede usarla siempre que vuelva.'}
                      </small>
                    </span>
                    <span className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={form.maxClaimsPerCustomer != null}
                        onChange={(event) => setForm({
                          ...form,
                          maxClaimsPerCustomer: event.target.checked ? (form.maxClaimsPerCustomer ?? 1) : null,
                        })}
                      />
                      <span aria-hidden="true" />
                    </span>
                  </label>
                  {form.maxClaimsPerCustomer != null ? (
                    <div className={styles.optionDetail}>
                      <div className={styles.formField}>
                        <label htmlFor="promotion-per-customer">Veces por cliente</label>
                        <input
                          id="promotion-per-customer"
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={form.maxClaimsPerCustomer}
                          onChange={(event) => setForm({
                            ...form,
                            maxClaimsPerCustomer: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                          })}
                        />
                      </div>
                    </div>
                  ) : null}

                  <label className={styles.switchRow}>
                    <span className={styles.switchText}>
                      <strong>Gasto mínimo</strong>
                      <small>El cliente tiene que gastar al menos este importe para usarla.</small>
                    </span>
                    <span className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={form.minimumSpendEnabled}
                        onChange={(event) => setForm({
                          ...form,
                          minimumSpendEnabled: event.target.checked,
                          minimumSpendCents: event.target.checked
                            ? (form.minimumSpendCents ?? 1200)
                            : null,
                        })}
                      />
                      <span aria-hidden="true" />
                    </span>
                  </label>
                  {form.minimumSpendEnabled ? (
                    <div className={styles.optionDetail}>
                      <div className={styles.formField}>
                        <label htmlFor="promotion-min-spend">Importe mínimo (€)</label>
                        <input
                          id="promotion-min-spend"
                          type="number"
                          min={0}
                          step={0.5}
                          value={((form.minimumSpendCents ?? 0) / 100).toFixed(2)}
                          onChange={(event) => setForm({
                            ...form,
                            minimumSpendCents: Math.max(
                              0,
                              Math.round(Number(event.target.value) * 100) || 0,
                            ),
                          })}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={styles.rulesPreview} aria-live="polite">
                  <p className={styles.rulesPreviewTitle}>Así lo verá el cliente</p>
                  <div className={styles.ruleChips}>
                    {describePromotionRules({ ...form, type: selectedType }).map((rule) => (
                      <em key={rule}>{rule}</em>
                    ))}
                  </div>
                  <p className={styles.rulesPreviewHint}>
                    Si no puede usarla en ese momento (fuera de horario, sin plazas o sin usos), la verá
                    con un candado y el motivo.
                  </p>
                </div>
              </section>
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
                    <span>{form.active ? 'Activa' : 'Pausada'}</span>
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
                        Eliminar
                      </button>
                    )}
                    <button type="button" className={styles.secondaryButton} onClick={closeDrawer}>
                      Cerrar
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
          url={promotionLandingUrl}
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

export default CompanyPromotions
