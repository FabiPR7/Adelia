import { useCallback, useEffect, useMemo, useState } from 'react'
import { ADELIA_LOGO_EMAIL_URL } from '../../constants/brand'
import { useAuth } from '../../context/AuthContext'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import { previewCompanyEmailTemplate } from '../../services/companyEmailApi'
import { getFirestoreErrorMessage, updateCompanyEmailTemplates } from '../../services/firestore'
import type { EmailTemplateKind, ReservationEmailTemplate } from '../../types'
import {
  DEFAULT_CONFIRMATION_EMAIL_TEMPLATE,
  DEFAULT_RECEIVED_EMAIL_TEMPLATE,
} from '../../types'
import { EMAIL_TEMPLATE_BOOLEAN_FIELDS, normalizeReservationEmailTemplate } from '../../utils/emailTemplates'
import styles from './CompanyEmailTemplate.module.css'

interface CompanyEmailTemplateProps {
  kind: EmailTemplateKind
}

const TEMPLATE_META: Record<
  EmailTemplateKind,
  { title: string; description: string; defaults: ReservationEmailTemplate }
> = {
  received: {
    title: 'Plantilla de reserva recibida',
    description:
      'Correo al solicitar reserva. Personaliza textos, diseño y bloques opcionales. El pie de Adelia es obligatorio.',
    defaults: DEFAULT_RECEIVED_EMAIL_TEMPLATE,
  },
  confirmation: {
    title: 'Plantilla de confirmación',
    description:
      'Correo al confirmar asistencia. Activa promociones, botones y datos visibles según prefieras.',
    defaults: DEFAULT_CONFIRMATION_EMAIL_TEMPLATE,
  },
}

function CompanyEmailTemplate({ kind }: CompanyEmailTemplateProps) {
  const { company, refreshCompany } = useAuth()
  const demo = useCompanyDemo()
  const meta = TEMPLATE_META[kind]

  const [form, setForm] = useState<ReservationEmailTemplate>(() =>
    normalizeReservationEmailTemplate(
      company?.emailTemplates[kind] ?? meta.defaults,
      meta.defaults,
    ),
  )
  const [savedForm, setSavedForm] = useState(form)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!company) {
      return
    }

    const next = normalizeReservationEmailTemplate(company.emailTemplates[kind], meta.defaults)
    setForm(next)
    setSavedForm(next)
  }, [company, kind, meta.defaults])

  const isDirty = useMemo(
    () =>
      JSON.stringify(normalizeReservationEmailTemplate(form, meta.defaults))
      !== JSON.stringify(normalizeReservationEmailTemplate(savedForm, meta.defaults)),
    [form, savedForm, meta.defaults],
  )

  const loadPreview = useCallback(async () => {
    if (!company) {
      return
    }

    setIsPreviewLoading(true)

    const preview = await previewCompanyEmailTemplate(company.id, kind, form)

    if (preview) {
      setPreviewHtml(preview.html)
      setPreviewSubject(preview.subject)
    } else {
      setPreviewHtml('')
      setPreviewSubject('')
    }

    setIsPreviewLoading(false)
  }, [company, form, kind])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPreview()
    }, 350)

    return () => window.clearTimeout(timer)
  }, [loadPreview])

  const updateField = <K extends keyof ReservationEmailTemplate>(
    key: K,
    value: ReservationEmailTemplate[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    setStatus(null)
    setError(null)
  }

  const toggleBooleanField = (key: keyof ReservationEmailTemplate) => {
    setForm((current) => ({
      ...current,
      [key]: !current[key],
    }))
    setStatus(null)
    setError(null)
  }

  const handleSave = async () => {
    if (!company) {
      return
    }

    setIsSaving(true)
    setError(null)
    setStatus(null)

    try {
      const normalized = normalizeReservationEmailTemplate(form, meta.defaults)
      const nextTemplates = {
        ...company.emailTemplates,
        [kind]: normalized,
      }

      await updateCompanyEmailTemplates(company.id, nextTemplates)
      await refreshCompany()
      setForm(normalized)
      setSavedForm(normalized)
      setStatus('Plantilla guardada correctamente.')
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setForm({ ...meta.defaults })
    setStatus(null)
    setError(null)
  }

  const handleDiscard = () => {
    setForm(savedForm)
    setStatus(null)
    setError(null)
  }

  if (!company) {
    return null
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>{meta.title}</h2>
        <p>{meta.description}</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.formCard} aria-label="Editor de plantilla">
          <div className={styles.formSection}>
            <h3>Textos del correo</h3>
            <label>
              Asunto
              <input
                type="text"
                value={form.subject}
                placeholder="Vacío = asunto automático"
                onChange={(event) => updateField('subject', event.target.value)}
              />
            </label>
            <label>
              Etiqueta superior
              <input
                type="text"
                value={form.headerEyebrow}
                onChange={(event) => updateField('headerEyebrow', event.target.value)}
              />
            </label>
            <label>
              Título principal (opcional)
              <input
                type="text"
                value={form.headline}
                placeholder="Vacío = nombre del restaurante"
                onChange={(event) => updateField('headline', event.target.value)}
              />
            </label>
            <label>
              Mensaje de introducción
              <textarea
                value={form.introMessage}
                onChange={(event) => updateField('introMessage', event.target.value)}
              />
            </label>
            <label>
              Mensaje extra antes de los detalles
              <textarea
                value={form.preDetailsMessage}
                onChange={(event) => updateField('preDetailsMessage', event.target.value)}
              />
            </label>
            <label>
              Título de la sección de detalles
              <input
                type="text"
                value={form.detailsSectionTitle}
                onChange={(event) => updateField('detailsSectionTitle', event.target.value)}
              />
            </label>
            <label>
              Mensaje de cierre
              <textarea
                value={form.closingMessage}
                onChange={(event) => updateField('closingMessage', event.target.value)}
              />
            </label>
            <p className={styles.hint}>
              Variables: {'{nombre}'}, {'{restaurante}'}, {'{fecha}'}, {'{hora}'}
            </p>
          </div>

          <div className={styles.formSection}>
            <h3>Diseño</h3>
            <div className={styles.colorRow}>
              <label>
                Estilo de cabecera
                <select
                  value={form.headerStyle}
                  onChange={(event) =>
                    updateField('headerStyle', event.target.value as ReservationEmailTemplate['headerStyle'])
                  }
                >
                  <option value="gradient">Degradado</option>
                  <option value="solid">Color sólido</option>
                  <option value="light">Claro</option>
                </select>
              </label>
              <label>
                Densidad del contenido
                <select
                  value={form.layoutStyle}
                  onChange={(event) =>
                    updateField('layoutStyle', event.target.value as ReservationEmailTemplate['layoutStyle'])
                  }
                >
                  <option value="classic">Clásica</option>
                  <option value="compact">Compacta</option>
                </select>
              </label>
            </div>
            <div className={styles.colorRow}>
              <div className={styles.colorField}>
                <label htmlFor={`accent-${kind}`}>Color principal</label>
                <div className={styles.colorInputWrap}>
                  <input
                    id={`accent-${kind}`}
                    type="color"
                    value={form.accentColor}
                    onChange={(event) => updateField('accentColor', event.target.value)}
                  />
                  <input
                    type="text"
                    value={form.accentColor}
                    onChange={(event) => updateField('accentColor', event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.colorField}>
                <label htmlFor={`accent-end-${kind}`}>Color secundario</label>
                <div className={styles.colorInputWrap}>
                  <input
                    id={`accent-end-${kind}`}
                    type="color"
                    value={form.accentColorEnd}
                    onChange={(event) => updateField('accentColorEnd', event.target.value)}
                  />
                  <input
                    type="text"
                    value={form.accentColorEnd}
                    onChange={(event) => updateField('accentColorEnd', event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3>Elementos visibles</h3>
            <p>Activa o desactiva bloques del correo. Todo es compatible con clientes de correo habituales.</p>
            <div className={styles.optionGrid}>
              {EMAIL_TEMPLATE_BOOLEAN_FIELDS.map((option) => (
                <label key={option.key} className={styles.checkOption}>
                  <input
                    type="checkbox"
                    checked={Boolean(form[option.key])}
                    onChange={() => toggleBooleanField(option.key)}
                  />
                  <span>
                    {option.label}
                    {option.hint && <small>{option.hint}</small>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {form.showPromotion && (
            <div className={styles.formSection}>
              <h3>Promoción u oferta</h3>
              <p>Solo una promoción activa por plantilla. Ideal para menú del día, descuento, etc.</p>
              <div className={styles.subFields}>
                <label>
                  Título de la promoción
                  <input
                    type="text"
                    value={form.promotionTitle}
                    onChange={(event) => updateField('promotionTitle', event.target.value)}
                  />
                </label>
                <label>
                  Mensaje de la promoción
                  <textarea
                    value={form.promotionMessage}
                    onChange={(event) => updateField('promotionMessage', event.target.value)}
                  />
                </label>
                <label>
                  Código promocional (opcional)
                  <input
                    type="text"
                    value={form.promotionCode}
                    placeholder="Ej. VERANO10"
                    onChange={(event) => updateField('promotionCode', event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {form.showCancelButton && (
            <div className={styles.formSection}>
              <h3>Botón cancelar</h3>
              <div className={styles.subFields}>
                <label>
                  Texto del botón
                  <input
                    type="text"
                    value={form.cancelButtonLabel}
                    onChange={(event) => updateField('cancelButtonLabel', event.target.value)}
                  />
                </label>
                <label>
                  Texto de ayuda
                  <textarea
                    value={form.cancelHelpText}
                    onChange={(event) => updateField('cancelHelpText', event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {form.showViewRestaurantButton && (
            <div className={styles.formSection}>
              <h3>Botón ver restaurante</h3>
              <div className={styles.subFields}>
                <label>
                  Texto del botón
                  <input
                    type="text"
                    value={form.viewRestaurantButtonLabel}
                    onChange={(event) => updateField('viewRestaurantButtonLabel', event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          <div className={styles.fixedNotice}>
            <strong>Siempre incluido:</strong> logo de Adelia y «Reserva gestionada con adeliareservas» al final.
            <img src={ADELIA_LOGO_EMAIL_URL} alt="" width={48} height={48} style={{ display: 'block', marginTop: '0.5rem' }} />
          </div>

          {demo ? (
            <p className={styles.statusMessage}>En la demo las plantillas se pueden ver, no guardar.</p>
          ) : (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => void handleSave()}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? 'Guardando…' : 'Guardar plantilla'}
            </button>
            <button type="button" className={styles.resetButton} onClick={handleReset}>
              Restaurar predeterminada
            </button>
            {isDirty && (
              <button type="button" className={styles.resetButton} onClick={handleDiscard}>
                Descartar cambios
              </button>
            )}
          </div>
          )}

          {status && <p className={styles.statusMessage}>{status}</p>}
          {error && <p className={styles.errorMessage}>{error}</p>}
        </section>

        <section className={styles.previewCard} aria-label="Vista previa del correo">
          <div className={styles.previewHeader}>
            <h3>Vista previa</h3>
            <p className={styles.previewSubject}>Asunto: {previewSubject || 'Generando…'}</p>
          </div>

          {isPreviewLoading ? (
            <div className={styles.previewLoading}>Generando vista previa…</div>
          ) : previewHtml ? (
            <div className={styles.previewFrameWrap}>
              <iframe
                title="Vista previa del correo"
                className={styles.previewFrame}
                srcDoc={previewHtml}
                sandbox=""
              />
            </div>
          ) : (
            <div className={styles.previewEmpty}>
              No se pudo cargar la vista previa. Comprueba que la API esté en marcha.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default CompanyEmailTemplate
