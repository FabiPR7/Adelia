import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import ImageUploader from '../../components/ImageUploader'
import { useAuth } from '../../context/AuthContext'
import {
  createCompanyPromotion,
  deleteCompanyPromotion,
  getCompanyPromotions,
  updateCompanyPromotion,
} from '../../services/promotions'
import { getFirestoreErrorMessage } from '../../services/firestore'
import type { CompanyPromotion, PromotionInput, PromotionType } from '../../types'
import {
  defaultPromotionInput,
  PROMOTION_TYPE_HINTS,
  PROMOTION_TYPE_LABELS,
  validatePromotionInput,
} from '../../types/company'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import styles from './CompanyPromotions.module.css'

interface CompanyPromotionsProps {
  companyId: string
}

const PROMOTION_TYPES: PromotionType[] = ['reservation_ladder', 'time_limited', 'attendance']

function promotionToInput(promotion: CompanyPromotion): PromotionInput {
  return {
    type: promotion.type,
    title: promotion.title,
    description: promotion.description,
    photoUrl: promotion.photoUrl,
    active: promotion.active,
    requiresReservation: promotion.requiresReservation,
    requiredReservations: promotion.requiredReservations,
    activeFromTime: promotion.activeFromTime,
    activeToTime: promotion.activeToTime,
    maxRedemptions: promotion.maxRedemptions,
    arrivalWindowMinutes: promotion.arrivalWindowMinutes,
  }
}

function promotionSummary(promotion: CompanyPromotion): string {
  if (promotion.type === 'reservation_ladder') {
    return `${promotion.requiredReservations ?? 0} reservas · escalable`
  }

  if (promotion.type === 'attendance') {
    return `${promotion.activeFromTime}-${promotion.activeToTime} · ${promotion.arrivalWindowMinutes} min`
  }

  return `${promotion.activeFromTime}-${promotion.activeToTime} · máx. ${promotion.maxRedemptions ?? 0}`
}

function CompanyPromotions({ companyId }: CompanyPromotionsProps) {
  const { user, profile } = useAuth()
  const [promotions, setPromotions] = useState<CompanyPromotion[]>([])
  const [selectedType, setSelectedType] = useState<PromotionType>('reservation_ladder')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PromotionInput>(defaultPromotionInput('reservation_ladder'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CompanyPromotion | null>(null)

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

  useEffect(() => {
    if (!user || profile?.companyId !== companyId) {
      return
    }

    void loadPromotions()
  }, [user, profile?.companyId, companyId, loadPromotions])

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
    const payload: PromotionInput = { ...form, type: selectedType }
    const validationError = validatePromotionInput(payload, promotions, editingId)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      if (editingId) {
        await updateCompanyPromotion(companyId, editingId, payload)
      } else {
        const newId = await createCompanyPromotion(companyId, payload)
        setEditingId(newId)
      }

      await loadPromotions()
    } catch (err) {
      setFormError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setSaving(false)
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
          Crea premios por reservas (escalables), promociones por tiempo limitado y cupos con
          asistencia puntual. Más adelante los clientes podrán canjearlos desde su zona de usuario.
        </p>
      </header>

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
              {filteredPromotions.map((promotion) => {
                const thumbUrl = promotion.photoUrl
                  ? optimizeCloudinaryUrl(promotion.photoUrl, CLOUDINARY_DISPLAY.photoThumb)
                  : ''

                return (
                  <button
                    key={promotion.id}
                    type="button"
                    className={`${styles.promotionCard} ${
                      editingId === promotion.id ? styles.promotionCardSelected : ''
                    }`}
                    onClick={() => startEdit(promotion)}
                  >
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className={styles.promotionThumb} />
                    ) : (
                      <div className={`${styles.promotionThumb} ${styles.promotionThumbEmpty}`}>Sin foto</div>
                    )}
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
                )
              })}
            </div>
          )}
        </section>

        <section className={styles.formPanel}>
          <h3>{editingId ? 'Editar promoción' : 'Nueva promoción'}</h3>

          <div className={styles.infoBox}>
            {PROMOTION_TYPE_HINTS[selectedType]}
            {selectedType === 'reservation_ladder' && (
              <>
                {' '}
                Solo puede haber una promoción activa por cada número de reservas requeridas.
              </>
            )}
            {selectedType === 'attendance' && (
              <>
                {' '}
                Si el cliente no confirma asistencia a tiempo, el cupo se liberará automáticamente
                (cuando exista la zona de usuarios).
              </>
            )}
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.formField} ${styles.formFieldWide}`}>
              <label htmlFor="promotion-title">Título</label>
              <input
                id="promotion-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Ej. Copa de cava de bienvenida"
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

            <div className={`${styles.formField} ${styles.formFieldWide}`}>
              <ImageUploader
                label="Foto de la promoción"
                hint="Imagen cuadrada recomendada"
                currentImageUrl={form.photoUrl}
                onImageUploaded={(url) => setForm({ ...form, photoUrl: url })}
                onImageRemoved={() => setForm({ ...form, photoUrl: '' })}
              />
            </div>

            {selectedType === 'reservation_ladder' && (
              <>
                <div className={styles.formField}>
                  <label htmlFor="promotion-reservations">Reservas requeridas</label>
                  <input
                    id="promotion-reservations"
                    type="number"
                    min={1}
                    value={form.requiredReservations ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      setForm({
                        ...form,
                        requiresReservation: true,
                        requiredReservations: raw === '' ? null : Number(raw),
                      })
                    }}
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={form.requiresReservation}
                      onChange={(event) => setForm({
                        ...form,
                        requiresReservation: event.target.checked,
                      })}
                    />
                    Requiere reserva
                  </label>
                </div>
              </>
            )}

            {(selectedType === 'time_limited' || selectedType === 'attendance') && (
              <>
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
              </>
            )}

            {selectedType === 'attendance' && (
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
            )}

            <div className={styles.formField}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                Promoción activa
              </label>
            </div>
          </div>

          {formError && <div className={styles.error}>{formError}</div>}

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
