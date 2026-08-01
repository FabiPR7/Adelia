import { Suspense, lazy, useEffect, useState } from 'react'
import ImageUploader from '../../components/ImageUploader'
import { useAuth } from '../../context/AuthContext'
import {
  getFirestoreErrorMessage,
  getTablesByCompany,
  replaceCompanyTables,
  updateCompanyFloorPlan,
  updateCompanySettings,
} from '../../services/firestore'
import type { Company, CompanySettingsPayload, SettingsSection, TableInput } from '../../types'
import {
  defaultFloorPlan,
  defaultTurns,
  SCHEDULE_DAY_KEYS,
  SCHEDULE_DAY_LABELS,
  syncFloorPlanWithTables,
} from '../../types/company'
import { defaultSchedule, getPublicBookingUrl } from '../../utils/helpers'
import styles from './CompanySettings.module.css'

const FloorPlanEditor = lazy(() => import('../../components/FloorPlanEditor'))

interface CompanySettingsProps {
  activeSection: SettingsSection
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

function companyToForm(company: Company): CompanySettingsPayload {
  return {
    name: company.name,
    contactEmail: company.contactEmail,
    phone: company.phone,
    website: company.website,
    location: company.location,
    logoUrl: company.logoUrl,
    timeSlotMinutes: company.timeSlotMinutes,
    schedule: company.schedule ?? defaultSchedule(),
    turns: company.turns?.length ? company.turns : defaultTurns(),
    floorPlan: company.floorPlan ?? defaultFloorPlan(),
  }
}

function emptyTable(index: number): TableInput {
  return {
    name: `Mesa ${index + 1}`,
    capacity: 4,
  }
}

function CompanySettings({ activeSection }: CompanySettingsProps) {
  const { company, refreshCompany } = useAuth()
  const [form, setForm] = useState<CompanySettingsPayload | null>(null)
  const [tables, setTables] = useState<TableInput[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingSection, setSavingSection] = useState<SettingsSection | null>(null)
  const [isSavingMap, setIsSavingMap] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    if (!company) {
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const tableRows = await getTablesByCompany(company.id)

        if (cancelled) {
          return
        }

        setForm(companyToForm(company))
        setTables(
          tableRows.length > 0
            ? tableRows.map((table) => ({
                id: table.id,
                name: table.name,
                capacity: table.capacity,
              }))
            : [emptyTable(0), emptyTable(1), emptyTable(2)],
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

  if (!company || !form) {
    return <p className={styles.loading}>Cargando configuración…</p>
  }

  if (isLoading) {
    return <p className={styles.loading}>Cargando configuración…</p>
  }

  const handleSaveContact = async () => {
    setError(null)
    setSuccess(null)

    if (!form.name.trim()) {
      setError('Indica el nombre del restaurante.')
      return
    }

    if (!form.phone.trim()) {
      setError('Indica el teléfono.')
      return
    }

    if (!form.location.trim()) {
      setError('Indica la dirección.')
      return
    }

    setSavingSection('contact')

    try {
      await updateCompanySettings(company.id, form)
      await refreshCompany()
      setSuccess('Contacto guardado correctamente.')
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveReservations = async () => {
    setError(null)
    setSuccess(null)

    if (form.timeSlotMinutes < 30 || form.timeSlotMinutes > 240) {
      setError('La duración debe estar entre 30 y 240 minutos.')
      return
    }

    setSavingSection('reservation-settings')

    try {
      await updateCompanySettings(company.id, form)
      await refreshCompany()
      setSuccess('Reservas guardadas correctamente.')
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveSchedule = async () => {
    setError(null)
    setSuccess(null)
    setSavingSection('schedule')

    try {
      await updateCompanySettings(company.id, form)
      await refreshCompany()
      setSuccess('Horario guardado correctamente.')
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveTables = async () => {
    setError(null)
    setSuccess(null)

    const validTables = tables.filter((table) => table.name.trim())

    if (validTables.length === 0) {
      setError('Añade al menos una mesa con nombre.')
      return
    }

    setSavingSection('tables')

    try {
      await replaceCompanyTables(company.id, validTables)

      const tableRows = await getTablesByCompany(company.id)
      const savedTables = tableRows.map((table) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
      }))

      const floorPlan = form.floorPlan.enabled
        ? syncFloorPlanWithTables(form.floorPlan, savedTables)
        : { ...form.floorPlan, enabled: false }

      await updateCompanyFloorPlan(company.id, floorPlan)
      setTables(savedTables)
      setForm((current) => (current ? { ...current, floorPlan } : current))
      await refreshCompany()
      setSuccess('Mesas guardadas correctamente.')
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
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

  const syncMapIfEnabled = (nextTables: TableInput[]) => {
    setForm((current) =>
      current && current.floorPlan.enabled
        ? {
            ...current,
            floorPlan: syncFloorPlanWithTables(current.floorPlan, nextTables),
          }
        : current,
    )
  }

  const addTable = () => {
    setTables((current) => {
      const next = [...current, emptyTable(current.length)]
      syncMapIfEnabled(next)
      return next
    })
  }

  const removeTable = (index: number) => {
    setTables((current) => {
      const next = current.filter((_, tableIndex) => tableIndex !== index)
      syncMapIfEnabled(next)
      return next
    })
  }

  const handleMapEnabledChange = (enabled: boolean) => {
    setForm((current) => {
      if (!current) {
        return current
      }

      if (!enabled) {
        return {
          ...current,
          floorPlan: { ...current.floorPlan, enabled: false },
        }
      }

      return {
        ...current,
        floorPlan: syncFloorPlanWithTables(
          { ...current.floorPlan, enabled: true },
          tables,
        ),
      }
    })
  }

  const isAnySaving = savingSection !== null || isSavingMap

  const renderSectionSave = (
    section: SettingsSection,
    label: string,
    onSave: () => void | Promise<void>,
  ) => (
    <div className={styles.sectionActions}>
      <button
        type="button"
        className={styles.saveButton}
        onClick={() => void onSave()}
        disabled={isAnySaving}
      >
        {savingSection === section ? 'Guardando…' : label}
      </button>
    </div>
  )

  const handleSaveMapOnly = async () => {
    if (!form.floorPlan.enabled) {
      setError('Activa el mapa antes de guardarlo.')
      return
    }

    setIsSavingMap(true)
    setError(null)
    setSuccess(null)

    try {
      const floorPlan = syncFloorPlanWithTables(form.floorPlan, tables)
      await updateCompanyFloorPlan(company.id, floorPlan)
      setForm((current) => (current ? { ...current, floorPlan } : current))
      await refreshCompany()
      setSuccess('Mapa guardado correctamente.')
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
    } finally {
      setIsSavingMap(false)
    }
  }

  const clientBookingUrl = getPublicBookingUrl(company.slug)

  const handleCopyClientLink = async () => {
    try {
      await navigator.clipboard.writeText(clientBookingUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setError('No se pudo copiar el enlace.')
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
          <h2>Contacto y ubicación</h2>
          <p>Datos visibles para clientes y reservas.</p>
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
            />
          </label>
          <label>
            Dirección
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <label className={styles.fullWidth}>
            Web (opcional)
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
            />
          </label>
          <div className={`${styles.fullWidth} ${styles.clientLinkBox}`}>
            <span className={styles.clientLinkLabel}>Enlace para clientes</span>
            <div className={styles.clientLinkRow}>
              <a href={clientBookingUrl} target="_blank" rel="noreferrer" className={styles.clientLink}>
                {clientBookingUrl}
              </a>
              <button type="button" className={styles.copyLinkButton} onClick={() => void handleCopyClientLink()}>
                {linkCopied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className={styles.clientLinkHint}>
              Comparte este enlace para que tus clientes reserven mesa online.
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

      <section className={sectionCardClass('reservation-settings', activeSection)}>
        <header className={styles.cardHeader}>
          <h2>Reservas</h2>
          <p>Duración por reserva y turnos del servicio.</p>
        </header>
        <label className={styles.inlineField}>
          Duración de cada reserva (minutos)
          <input
            type="number"
            min={30}
            max={240}
            step={15}
            value={form.timeSlotMinutes}
            onChange={(e) =>
              setForm({ ...form, timeSlotMinutes: Number(e.target.value) || 120 })
            }
          />
        </label>

        <div className={styles.turns}>
          <h3>Turnos</h3>
          {form.turns.map((turn, index) => (
            <div key={index} className={styles.turnRow}>
              <input
                value={turn.name}
                onChange={(e) => {
                  const turns = [...form.turns]
                  turns[index] = { ...turn, name: e.target.value }
                  setForm({ ...form, turns })
                }}
                placeholder="Nombre"
              />
              <input
                type="time"
                value={turn.start}
                onChange={(e) => {
                  const turns = [...form.turns]
                  turns[index] = { ...turn, start: e.target.value }
                  setForm({ ...form, turns })
                }}
              />
              <span>—</span>
              <input
                type="time"
                value={turn.end}
                onChange={(e) => {
                  const turns = [...form.turns]
                  turns[index] = { ...turn, end: e.target.value }
                  setForm({ ...form, turns })
                }}
              />
            </div>
          ))}
        </div>
        {renderSectionSave('reservation-settings', 'Guardar reservas', handleSaveReservations)}
      </section>

      <section className={sectionCardClass('schedule', activeSection)}>
        <header className={styles.cardHeader}>
          <h2>Horario semanal</h2>
          <p>Indica cuándo aceptas reservas cada día.</p>
        </header>
        <div className={styles.scheduleList}>
          {SCHEDULE_DAY_KEYS.map((dayKey) => {
            const day = form.schedule[dayKey]

            return (
              <div key={dayKey} className={styles.scheduleRow}>
                <label className={styles.dayToggle}>
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
                <input
                  type="time"
                  disabled={!day.active}
                  value={day.open}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      schedule: {
                        ...form.schedule,
                        [dayKey]: { ...day, open: e.target.value },
                      },
                    })
                  }
                />
                <span>—</span>
                <input
                  type="time"
                  disabled={!day.active}
                  value={day.close}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      schedule: {
                        ...form.schedule,
                        [dayKey]: { ...day, close: e.target.value },
                      },
                    })
                  }
                />
              </div>
            )
          })}
        </div>
        {renderSectionSave('schedule', 'Guardar horario', handleSaveSchedule)}
      </section>

      <section className={`${sectionCardClass('tables', activeSection)} ${styles.tablesSection}`}>
        <header className={styles.tablesHeader}>
          <div className={styles.tablesHeaderText}>
            <h2>Mesas</h2>
            <p>Nombre y capacidad de cada mesa (ocupantes máximos).</p>
          </div>
          <label className={styles.mapSwitchInline}>
            <span className={styles.mapSwitchText}>Mapa</span>
            <span className={styles.mapSwitch}>
              <input
                type="checkbox"
                className={styles.mapSwitchInput}
                checked={form.floorPlan.enabled}
                onChange={(e) => handleMapEnabledChange(e.target.checked)}
              />
              <span className={styles.mapSwitchSlider} aria-hidden="true" />
            </span>
          </label>
        </header>

        <div className={styles.tablesLayout}>
          <div className={styles.tablesListPanel}>
            <div className={styles.tablesGrid} role="table" aria-label="Listado de mesas">
              <div className={styles.tablesGridHeader} role="row">
                <span role="columnheader">Nombre</span>
                <span role="columnheader">Capacidad</span>
                <span className={styles.tablesGridHeaderAction} aria-hidden="true" />
              </div>
              {tables.map((table, index) => (
                <div
                  key={table.id ?? `new-${index}`}
                  className={styles.tablesGridRow}
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
                </div>
              ))}
            </div>
            <button type="button" className={styles.addButton} onClick={addTable}>
              + Añadir mesa
            </button>
            {renderSectionSave('tables', 'Guardar mesas', handleSaveTables)}
          </div>

          <div className={styles.mapPanel}>
            {form.floorPlan.enabled && activeSection === 'tables' ? (
              <>
                <Suspense fallback={<p className={styles.mapPlaceholder}>Cargando mapa…</p>}>
                  <FloorPlanEditor
                    embedded
                    tables={tables}
                    floorPlan={form.floorPlan}
                    onChange={(floorPlan) => setForm({ ...form, floorPlan })}
                  />
                </Suspense>
                <div className={styles.mapActions}>
                  <button
                    type="button"
                    className={styles.saveMapButton}
                    onClick={() => void handleSaveMapOnly()}
                    disabled={isSavingMap || isAnySaving}
                  >
                    {isSavingMap ? 'Guardando mapa…' : 'Guardar mapa'}
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.mapPlaceholder}>
                {form.floorPlan.enabled
                  ? 'El mapa se edita en esta pestaña de mesas.'
                  : 'Activa el mapa para colocar mesas y decoración de forma visual.'}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default CompanySettings
