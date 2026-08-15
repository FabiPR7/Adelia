import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import ImageUploader from '../../components/ImageUploader'
import PromotionPhotoCollage from '../../components/promotions/PromotionPhotoCollage'
import PromotionProductPicker from '../../components/promotions/PromotionProductPicker'
import { useAuth } from '../../context/AuthContext'
import { getCompanyMenuNodes } from '../../services/companyMenu'
import {
  createCompanyPromotion,
  deleteCompanyPromotion,
  getCompanyPromotions,
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
import {
  buildPromotionProductRefs,
  formatPromotionOfferSummary,
  suggestPromotionTitle,
} from '../../utils/promotionOffer'
import {
  formatPromotionPinRotationHint,
  generatePromotionPinCode,
  normalizePromotionPinCode,
  PROMOTION_PIN_ROTATION_LABELS,
  validatePromotionPinCode,
} from '../../utils/promotionPin'
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
  }
}

function promotionSummary(promotion: CompanyPromotion): string {
  const offerSummary = formatPromotionOfferSummary(promotion.offer)
  const productCount = promotion.productRefs.length
  const minSpendLabel = promotion.minimumSpendEnabled && promotion.minimumSpendCents != null && promotion.minimumSpendCents > 0
    ? `mín. ${(promotion.minimumSpendCents / 100).toFixed(2).replace('.', ',')} €`
    : null

  if (promotion.type === 'reservation_ladder') {
    const parts: string[] = [offerSummary]

    if (promotion.requiresReservation && promotion.requiredReservations != null && promotion.requiredReservations > 0) {
      parts.unshift(`${promotion.requiredReservations} reservas`)
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
  const { user, profile } = useAuth()
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

      setError(
        errorCode === 'permission-denied'
          ? `${message} Vuelve a publicar reglas con npm run deploy:rules y comprueba en Firebase Console → Firestore → base «adelia» → Reglas que aparece «promotions».`
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

  const startCreate = () => {
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
    const payload: PromotionInput = {
      ...form,
      type: selectedType,
      maxRedemptions: selectedType === 'attendance' ? form.maxRedemptions : null,
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
        startCreate()
      }
      setDeleteTarget(null)
      await loadPromotions()
    } catch (err) {
      setFormError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>Zona de promociones</h2>
        <p>
          Crea ofertas escalables, promociones por tiempo limitado y cupos con
          asistencia puntual. Más adelante los clientes podrán canjearlas desde su zona de usuario.
        </p>
      </header>

      <section className={styles.pinPanel} aria-labelledby="promotion-pin-title">
        <div className={styles.pinPanelHead}>
          <div>
            <h3 id="promotion-pin-title">Código de canje</h3>
            <p>
              Los clientes usarán este PIN para validar promociones. Más adelante lo pediremos en su zona de usuario.
            </p>
          </div>
        </div>

        {pinLoading ? (
          <p className={styles.pinLoading}>Cargando código…</p>
        ) : (
          <>
            <div className={styles.pinRow}>
              <label className={styles.pinField}>
                <span>Código actual</span>
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
                />
              </label>

              <div className={styles.pinActions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => setPinCode(generatePromotionPinCode())}
                  disabled={pinSaving}
                >
                  Cambiar aleatoriamente
                </button>
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                  onClick={() => void handleSavePin(false)}
                  disabled={pinSaving}
                >
                  {pinSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>

            <fieldset className={styles.pinRotationFieldset}>
              <legend>Rotación automática</legend>
              <div className={styles.pinRotationOptions}>
                {PIN_ROTATIONS.map((rotation) => (
                  <label key={rotation} className={styles.pinRotationOption}>
                    <input
                      type="radio"
                      name="promotion-pin-rotation"
                      value={rotation}
                      checked={pinRotation === rotation}
                      onChange={() => {
                        setPinRotation(rotation)
                        setPinSavedMessage(null)
                      }}
                    />
                    <span>{PROMOTION_PIN_ROTATION_LABELS[rotation]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <p className={styles.pinHint}>
              {formatPromotionPinRotationHint(pinRotation, pinNextRotationAt)}
            </p>

            {pinError && <div className={styles.error}>{pinError}</div>}
            {pinSavedMessage && <p className={styles.pinSuccess}>{pinSavedMessage}</p>}
          </>
        )}
      </section>

      <div className={styles.toolbar}>
        <div className={styles.typeToggle} role="tablist" aria-label="Tipo de promoción">
          {PROMOTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={selectedType === type}
              className={`${styles.typeButton} ${selectedType === type ? styles.typeButtonActive : ''}`}
              onClick={() => handleTypeChange(type)}
            >
              {PROMOTION_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <button type="button" className={`${styles.actionButton} ${styles.actionButtonPrimary}`} onClick={startCreate}>
          Nueva promoción
        </button>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => void loadPromotions()}
          disabled={loading}
        >
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.layout}>
        <section className={styles.listPanel}>
          <h3>{PROMOTION_TYPE_LABELS[selectedType]}</h3>

          {loading ? (
            <div className={styles.loading}>Cargando promociones…</div>
          ) : filteredPromotions.length === 0 ? (
            <div className={styles.empty}>No hay promociones de este tipo todavía.</div>
          ) : (
            <div className={styles.promotionList}>
              {filteredPromotions.map((promotion) => (
                  <button
                    key={promotion.id}
                    type="button"
                    className={`${styles.promotionCard} ${
                      editingId === promotion.id ? styles.promotionCardSelected : ''
                    }`}
                    onClick={() => startEdit(promotion)}
                  >
                    <PromotionPhotoCollage
                      productRefs={promotion.productRefs}
                      fallbackPhotoUrl={promotion.photoUrl}
                      alt={promotion.title}
                    />
                    <div className={styles.promotionCardBody}>
                      <strong>{promotion.title}</strong>
                      <span>{promotionSummary(promotion)}</span>
                    </div>
                    <span className={`${styles.statusBadge} ${
                      promotion.active ? styles.statusActive : styles.statusInactive
                    }`}
                    >
                      {promotion.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </section>

        <section className={styles.formPanel}>
          <div className={styles.formPanelHead}>
            <h3>{editingId ? 'Editar promoción' : 'Nueva promoción'}</h3>
            <p className={styles.formPanelIntro}>{PROMOTION_TYPE_HINTS[selectedType]}</p>
          </div>

          <div className={styles.formSections}>
            <section className={styles.formSection}>
              <div className={styles.sectionHead}>
                <h4>Información</h4>
                <p>Título y descripción que verá el cliente.</p>
              </div>

              <div className={styles.sectionGrid}>
                <div className={`${styles.formField} ${styles.formFieldWide}`}>
                  <div className={styles.titleRow}>
                    <label htmlFor="promotion-title">Título</label>
                    <button
                      type="button"
                      className={styles.suggestButton}
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
                    placeholder="Explica el premio y condiciones"
                  />
                </div>
              </div>
            </section>

            <section className={styles.formSection}>
              <div className={styles.sectionHead}>
                <h4>Tipo de oferta</h4>
                <p>Define el formato del descuento o regalo.</p>
              </div>

              <div className={styles.sectionGrid}>
                <div className={`${styles.formField} ${styles.formFieldWide}`}>
                  <label htmlFor="promotion-offer-kind">Formato</label>
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
              <div className={styles.sectionHead}>
                <h4>Productos e imagen</h4>
                <p>Elige productos de la carta; la foto se genera sola si tienen imagen.</p>
              </div>

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
                    <p className={styles.photoCardHint}>
                      {previewProductRefs.length === 0
                        ? 'Añade productos con foto o sube una imagen.'
                        : previewProductRefs.length === 1
                          ? 'Foto del producto seleccionado.'
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
              <div className={styles.sectionHead}>
                <h4>Condiciones</h4>
                <p>
                  {selectedType === 'reservation_ladder' && 'Requisitos para canjear la oferta.'}
                  {selectedType === 'time_limited' && 'Franja horaria en la que aplica.'}
                  {selectedType === 'attendance' && 'Horario, cupos y plazo de llegada.'}
                </p>
              </div>

              {selectedType === 'reservation_ladder' && (
                <div className={styles.sectionGrid}>
                  <div className={styles.formField}>
                    <label htmlFor="promotion-reservations">Reservas requeridas</label>
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

                  <label className={`${styles.toggleCard} ${form.requiresReservation ? styles.toggleCardActive : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.requiresReservation}
                      onChange={(event) => setForm({
                        ...form,
                        requiresReservation: event.target.checked,
                      })}
                    />
                    <span>
                      <strong>Requiere reserva</strong>
                      <small>Obliga a reservar mesa</small>
                    </span>
                  </label>

                  <p className={`${styles.fieldHint} ${styles.formFieldWide}`}>
                    Solo puede haber una oferta activa por cada número de reservas requeridas.
                  </p>
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
                </div>
              )}

              {selectedType === 'attendance' && (
                <div className={`${styles.sectionGrid} ${styles.sectionGridTop}`}>
                  <div className={styles.formField}>
                    <label htmlFor="promotion-max">Máximo de canjes</label>
                    <input
                      id="promotion-max"
                      type="number"
                      min={1}
                      value={form.maxRedemptions ?? 1}
                      onChange={(event) => setForm({
                        ...form,
                        maxRedemptions: Math.max(1, Number(event.target.value) || 1),
                      })}
                    />
                  </div>

                  <div className={styles.formField}>
                    <label htmlFor="promotion-arrival">Tiempo máximo de llegada (min)</label>
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
                  </div>

                  <p className={`${styles.fieldHint} ${styles.formFieldWide}`}>
                    Si el cliente no confirma asistencia a tiempo, el cupo se liberará automáticamente.
                  </p>
                </div>
              )}

              <div className={`${styles.sectionGrid} ${styles.sectionGridTop}`}>
                <label className={`${styles.toggleCard} ${styles.formFieldWide} ${form.minimumSpendEnabled ? styles.toggleCardActive : ''}`}>
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
                  <span>
                    <strong>Gasto mínimo</strong>
                    <small>Desde 0 € sin límite superior</small>
                  </span>
                </label>

                {form.minimumSpendEnabled ? (
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
                ) : null}
              </div>
            </section>

            <section className={`${styles.formSection} ${styles.formSectionFooter}`}>
              <label className={`${styles.toggleCard} ${styles.toggleCardWide} ${form.active ? styles.toggleCardActive : ''}`}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                <span>
                  <strong>Promoción activa</strong>
                  <small>Visible para clientes cuando esté publicada</small>
                </span>
              </label>
            </section>
          </div>

          {formError && <div className={styles.formError}>{formError}</div>}

          <div className={styles.formActions}>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear promoción'}
            </button>

            {editingId && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => {
                  const promotion = promotions.find((item) => item.id === editingId)
                  if (promotion) {
                    setDeleteTarget(promotion)
                  }
                }}
                disabled={saving}
              >
                Eliminar
              </button>
            )}
          </div>
        </section>
      </div>

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
    </div>
  )
}

export default CompanyPromotions
