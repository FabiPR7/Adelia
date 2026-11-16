import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
} from 'react'
import {
  Braces,
  Inbox,
  LayoutList,
  LoaderCircle,
  Monitor,
  Paintbrush,
  RotateCcw,
  Save,
  Smartphone,
  Type,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
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
    title: 'Correo de reserva recibida',
    description: 'Lo recibe el cliente nada más pedir mesa. Cambia los textos, el diseño y lo que se muestra.',
    defaults: DEFAULT_RECEIVED_EMAIL_TEMPLATE,
  },
  confirmation: {
    title: 'Correo de confirmación',
    description: 'Lo recibe el cliente cuando confirmas la reserva. Puedes añadir una promoción y botones.',
    defaults: DEFAULT_CONFIRMATION_EMAIL_TEMPLATE,
  },
}

type EditorTab = 'content' | 'design' | 'blocks'

const EDITOR_TABS: { id: EditorTab; label: string; icon: LucideIcon }[] = [
  { id: 'content', label: 'Textos', icon: Type },
  { id: 'design', label: 'Diseño', icon: Paintbrush },
  { id: 'blocks', label: 'Qué se muestra', icon: LayoutList },
]

type TextFieldKey =
  | 'subject'
  | 'headerEyebrow'
  | 'headline'
  | 'introMessage'
  | 'preDetailsMessage'
  | 'detailsSectionTitle'
  | 'closingMessage'
  | 'cancelButtonLabel'
  | 'cancelHelpText'
  | 'promotionTitle'
  | 'promotionMessage'
  | 'promotionCode'
  | 'viewRestaurantButtonLabel'

const MAX_TEXT_LENGTH = 500

const TEMPLATE_VARIABLES = [
  { token: '{nombre}', hint: 'nombre del cliente' },
  { token: '{restaurante}', hint: 'nombre de tu restaurante' },
  { token: '{fecha}', hint: 'día de la reserva' },
  { token: '{hora}', hint: 'hora de la reserva' },
]

const HEADER_STYLES: { id: ReservationEmailTemplate['headerStyle']; label: string }[] = [
  { id: 'gradient', label: 'Degradado' },
  { id: 'solid', label: 'Color liso' },
  { id: 'light', label: 'Claro' },
]

const LAYOUT_STYLES: { id: ReservationEmailTemplate['layoutStyle']; label: string; hint: string }[] = [
  { id: 'classic', label: 'Clásico', hint: 'Más aire entre bloques' },
  { id: 'compact', label: 'Compacto', hint: 'Más corto, ideal en móvil' },
]

const COLOR_PRESETS = [
  { label: 'Teja', start: '#8a3f1c', end: '#c2703d' },
  { label: 'Vino', start: '#6b1f2a', end: '#a63d4a' },
  { label: 'Oliva', start: '#4d5b2a', end: '#8a9a4b' },
  { label: 'Bosque', start: '#1f4d3a', end: '#3f8a64' },
  { label: 'Mar', start: '#1f4e6b', end: '#3f8cb5' },
  { label: 'Mostaza', start: '#a56a12', end: '#d9a23a' },
  { label: 'Rosa', start: '#9b3b5a', end: '#d77a92' },
  { label: 'Noche', start: '#1c1917', end: '#4a4440' },
]

const BLOCK_GROUPS: { title: string; keys: (keyof ReservationEmailTemplate)[] }[] = [
  { title: 'Cabecera', keys: ['showRestaurantLogo', 'showRestaurantName'] },
  { title: 'Datos de la reserva', keys: ['showDate', 'showTime', 'showPax', 'showTable', 'showNotes'] },
  { title: 'Datos del restaurante', keys: ['showPhone', 'showLocation', 'showWebsite', 'showContactEmail'] },
  { title: 'Botones y extras', keys: ['showCancelButton', 'showViewRestaurantButton', 'showPromotion'] },
]

function headerThumbStyle(
  style: ReservationEmailTemplate['headerStyle'],
  start: string,
  end: string,
): CSSProperties {
  if (style === 'gradient') {
    return { background: `linear-gradient(135deg, ${start}, ${end})` }
  }
  if (style === 'solid') {
    return { background: start }
  }
  return { background: '#f6f3ee', borderTop: `3px solid ${start}`, color: start }
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
  const [activeTab, setActiveTab] = useState<EditorTab>('content')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const lastFieldRef = useRef<{
    key: TextFieldKey
    element: HTMLInputElement | HTMLTextAreaElement
  } | null>(null)

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

  const insertVariable = (token: string) => {
    const last = lastFieldRef.current
    const key: TextFieldKey = last?.key ?? 'introMessage'
    const element = last?.element && document.contains(last.element) ? last.element : null
    const current = String(form[key] ?? '')
    const start = element?.selectionStart ?? current.length
    const end = element?.selectionEnd ?? current.length
    const next = (current.slice(0, start) + token + current.slice(end)).slice(0, MAX_TEXT_LENGTH)
    updateField(key, next as ReservationEmailTemplate[typeof key])
    if (element) {
      window.requestAnimationFrame(() => {
        element.focus()
        const caret = start + token.length
        element.setSelectionRange(caret, caret)
      })
    }
  }

  if (!company) {
    return null
  }

  const restaurantName = company.name?.trim() || 'Tu restaurante'

  const renderTextField = (
    key: TextFieldKey,
    label: string,
    options: { multiline?: boolean; placeholder?: string; hint?: string } = {},
  ) => {
    const value = String(form[key] ?? '')
    const id = `email-${kind}-${key}`
    const commonProps = {
      id,
      value,
      placeholder: options.placeholder,
      maxLength: MAX_TEXT_LENGTH,
      onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        lastFieldRef.current = { key, element: event.currentTarget }
      },
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        updateField(key, event.target.value as ReservationEmailTemplate[typeof key]),
    }

    return (
      <div className={styles.field} key={key}>
        <div className={styles.fieldTop}>
          <label htmlFor={id}>{label}</label>
          {value.length > MAX_TEXT_LENGTH * 0.7 ? (
            <span className={styles.counter}>
              {value.length}/{MAX_TEXT_LENGTH}
            </span>
          ) : null}
        </div>
        {options.multiline ? <textarea rows={3} {...commonProps} /> : <input type="text" {...commonProps} />}
        {options.hint ? <span className={styles.fieldHint}>{options.hint}</span> : null}
      </div>
    )
  }

  const renderSwitch = (key: keyof ReservationEmailTemplate, label: string, hint?: string) => {
    const on = Boolean(form[key])
    return (
      <label className={styles.switchRow} key={key}>
        <span className={styles.switchText}>
          <strong>{label}</strong>
          {hint ? <span>{hint}</span> : null}
        </span>
        <span className={styles.switch}>
          <input type="checkbox" checked={on} onChange={() => toggleBooleanField(key)} />
          <span aria-hidden="true" />
        </span>
      </label>
    )
  }

  const fieldLabel = (key: keyof ReservationEmailTemplate) =>
    EMAIL_TEMPLATE_BOOLEAN_FIELDS.find((option) => option.key === key)

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2>{meta.title}</h2>
          <p>{meta.description}</p>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.saveState} ${isDirty ? styles.saveStateDirty : ''}`}>
            <span aria-hidden="true" />
            {demo ? 'Solo vista en la demo' : isDirty ? 'Cambios sin guardar' : 'Todo guardado'}
          </span>
          {!demo ? (
            <>
              {isDirty ? (
                <button type="button" className={styles.ghostButton} onClick={handleDiscard}>
                  <Undo2 size={15} aria-hidden /> Descartar
                </button>
              ) : null}
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSave()}
                disabled={isSaving || !isDirty}
              >
                <Save size={15} aria-hidden /> {isSaving ? 'Guardando…' : 'Guardar plantilla'}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {status ? <p className={styles.statusMessage} role="status">{status}</p> : null}
      {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}

      <div className={styles.layout}>
        <section className={styles.editorCard} aria-label="Editor de plantilla">
          <div className={styles.tabs} role="tablist" aria-label="Partes de la plantilla">
            {EDITOR_TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={15} aria-hidden /> {tab.label}
                </button>
              )
            })}
          </div>

          {activeTab === 'content' ? (
            <div className={styles.panel}>
              <div className={styles.variables}>
                <span className={styles.variablesLabel}>
                  <Braces size={14} aria-hidden /> Variables
                </span>
                {TEMPLATE_VARIABLES.map((variable) => (
                  <button
                    key={variable.token}
                    type="button"
                    className={styles.variableChip}
                    title={`Inserta ${variable.token}: ${variable.hint}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertVariable(variable.token)}
                  >
                    {variable.token}
                  </button>
                ))}
                <span className={styles.variablesHint}>Se insertan donde tengas el cursor.</span>
              </div>

              <div className={styles.group}>
                <h3>Bandeja de entrada</h3>
                {renderTextField('subject', 'Asunto', {
                  placeholder: 'Vacío = asunto automático',
                  hint: 'Lo primero que ve el cliente en su bandeja.',
                })}
              </div>

              <div className={styles.group}>
                <h3>Cabecera</h3>
                <div className={styles.twoCols}>
                  {renderTextField('headerEyebrow', 'Etiqueta superior')}
                  {renderTextField('headline', 'Título principal', { placeholder: `Vacío = ${restaurantName}` })}
                </div>
              </div>

              <div className={styles.group}>
                <h3>Mensaje</h3>
                {renderTextField('introMessage', 'Introducción', { multiline: true })}
                {renderTextField('preDetailsMessage', 'Texto antes de los detalles', { multiline: true })}
                {renderTextField('detailsSectionTitle', 'Título de los detalles')}
                {renderTextField('closingMessage', 'Despedida', { multiline: true })}
              </div>
            </div>
          ) : null}

          {activeTab === 'design' ? (
            <div className={styles.panel}>
              <div className={styles.group}>
                <h3>Cabecera</h3>
                <div className={styles.styleCards} role="radiogroup" aria-label="Estilo de cabecera">
                  {HEADER_STYLES.map((option) => {
                    const on = form.headerStyle === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`${styles.styleCard} ${on ? styles.styleCardOn : ''}`}
                        onClick={() => updateField('headerStyle', option.id)}
                      >
                        <span
                          className={styles.styleThumb}
                          style={headerThumbStyle(option.id, form.accentColor, form.accentColorEnd)}
                        >
                          <i />
                          <i />
                        </span>
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.group}>
                <h3>Colores</h3>
                <div className={styles.presets} role="group" aria-label="Combinaciones de color">
                  {COLOR_PRESETS.map((preset) => {
                    const on =
                      form.accentColor.toLowerCase() === preset.start
                      && form.accentColorEnd.toLowerCase() === preset.end
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`${styles.preset} ${on ? styles.presetOn : ''}`}
                        title={preset.label}
                        aria-label={preset.label}
                        aria-pressed={on}
                        style={{ background: `linear-gradient(135deg, ${preset.start}, ${preset.end})` }}
                        onClick={() => {
                          updateField('accentColor', preset.start)
                          updateField('accentColorEnd', preset.end)
                        }}
                      />
                    )
                  })}
                </div>
                <div className={styles.twoCols}>
                  {(
                    [
                      ['accentColor', 'Color principal'],
                      ['accentColorEnd', 'Color secundario'],
                    ] as const
                  ).map(([key, label]) => (
                    <div className={styles.field} key={key}>
                      <label htmlFor={`${key}-${kind}`}>{label}</label>
                      <div className={styles.colorInput}>
                        <input
                          id={`${key}-${kind}`}
                          type="color"
                          value={form[key]}
                          onChange={(event) => updateField(key, event.target.value)}
                        />
                        <input
                          type="text"
                          value={form[key]}
                          aria-label={`${label} en hexadecimal`}
                          onChange={(event) => updateField(key, event.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.group}>
                <h3>Espaciado</h3>
                <div className={styles.segmented} role="radiogroup" aria-label="Densidad del contenido">
                  {LAYOUT_STYLES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={form.layoutStyle === option.id}
                      className={form.layoutStyle === option.id ? styles.segmentedOn : ''}
                      onClick={() => updateField('layoutStyle', option.id)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'blocks' ? (
            <div className={styles.panel}>
              {BLOCK_GROUPS.map((group) => (
                <div className={styles.group} key={group.title}>
                  <h3>{group.title}</h3>
                  <div className={styles.switchList}>
                    {group.keys.map((key) => {
                      const option = fieldLabel(key)
                      return (
                        <div key={key} className={styles.switchItem}>
                          {renderSwitch(key, option?.label ?? key, option?.hint)}
                          {key === 'showCancelButton' && form.showCancelButton ? (
                            <div className={styles.subFields}>
                              {renderTextField('cancelButtonLabel', 'Texto del botón')}
                              {renderTextField('cancelHelpText', 'Texto de ayuda', { multiline: true })}
                            </div>
                          ) : null}
                          {key === 'showViewRestaurantButton' && form.showViewRestaurantButton ? (
                            <div className={styles.subFields}>
                              {renderTextField('viewRestaurantButtonLabel', 'Texto del botón')}
                            </div>
                          ) : null}
                          {key === 'showPromotion' && form.showPromotion ? (
                            <div className={styles.subFields}>
                              {renderTextField('promotionTitle', 'Título de la promoción')}
                              {renderTextField('promotionMessage', 'Mensaje', { multiline: true })}
                              {renderTextField('promotionCode', 'Código (opcional)', { placeholder: 'Ej. VERANO10' })}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className={styles.fixedNotice}>
                <img src={ADELIA_LOGO_EMAIL_URL} alt="" width={32} height={32} />
                <p>
                  <strong>Siempre incluido:</strong> el logo de Adelia y «Reserva gestionada con adeliareservas» al
                  final del correo.
                </p>
              </div>
            </div>
          ) : null}

          {!demo ? (
            <div className={styles.editorFooter}>
              <button type="button" className={styles.linkButton} onClick={handleReset}>
                <RotateCcw size={14} aria-hidden /> Restaurar la plantilla original
              </button>
            </div>
          ) : null}
        </section>

        <section className={styles.previewCard} aria-label="Vista previa del correo">
          <div className={styles.previewBar}>
            <h3>Vista previa</h3>
            <div className={styles.deviceToggle} role="group" aria-label="Tamaño de la vista previa">
              <button
                type="button"
                aria-pressed={device === 'desktop'}
                className={device === 'desktop' ? styles.deviceOn : ''}
                onClick={() => setDevice('desktop')}
              >
                <Monitor size={15} aria-hidden /> Ordenador
              </button>
              <button
                type="button"
                aria-pressed={device === 'mobile'}
                className={device === 'mobile' ? styles.deviceOn : ''}
                onClick={() => setDevice('mobile')}
              >
                <Smartphone size={15} aria-hidden /> Móvil
              </button>
            </div>
          </div>

          <div className={styles.inboxRow}>
            <span className={styles.inboxAvatar} aria-hidden="true">
              {restaurantName.charAt(0).toUpperCase()}
            </span>
            <div className={styles.inboxText}>
              <strong>{restaurantName}</strong>
              <span>{previewSubject || 'Generando asunto…'}</span>
            </div>
            <Inbox size={16} aria-hidden className={styles.inboxIcon} />
          </div>

          <div className={`${styles.previewStage} ${device === 'mobile' ? styles.previewStageMobile : ''}`}>
            {previewHtml ? (
              <div className={styles.previewFrameWrap}>
                <iframe
                  title="Vista previa del correo"
                  className={styles.previewFrame}
                  srcDoc={previewHtml}
                  sandbox=""
                />
                {isPreviewLoading ? (
                  <span className={styles.previewUpdating}>
                    <LoaderCircle size={14} aria-hidden /> Actualizando…
                  </span>
                ) : null}
              </div>
            ) : isPreviewLoading ? (
              <div className={styles.previewEmpty}>
                <LoaderCircle size={18} aria-hidden className={styles.spin} /> Generando vista previa…
              </div>
            ) : (
              <div className={styles.previewEmpty}>
                No se pudo cargar la vista previa. Vuelve a intentarlo en un momento.
              </div>
            )}
          </div>
          {demo ? (
            <p className={styles.previewNote}>En la demo la vista previa es de ejemplo y no cambia al editar.</p>
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default CompanyEmailTemplate
