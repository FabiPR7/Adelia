import { useEffect, useMemo, useState } from 'react'
import type { AdminCompany } from '../../types'
import {
  COMPANY_PLANS,
  dateToInputValue,
  formatCompanyPlanStartedAt,
  isAllowedMonthlyBillingDate,
  monthlyChargeLabel,
  monthlyChargeState,
  nextMonthlyChargeDate,
  getCompanyPlan,
  parseCompanyPlanBilling,
  parseCompanyPlanId,
  parseDateInput,
  type CompanyPlanBilling,
  type CompanyPlanId,
} from '../../data/companyPlans'
import { countCompanyMenuBoards } from '../../services/adminCompanies'
import { companyHealthScore, companyProfileHealth } from '../../utils/companyHealth'
import { IconPlus, IconSearch } from './AdminIcons'
import styles from './AdminCompaniesWorkspace.module.css'

export interface CompanyEditorState {
  name: string
  location: string
  municipality: string
  postalCode: string
  country: string
  phone: string
  contactEmail: string
  website: string
  password: string
  planId: CompanyPlanId
  planBilling: CompanyPlanBilling | null
  planStartedOn: string
  discoveryFeatured: boolean
}

const EMPTY_FORM: CompanyEditorState = {
  name: '',
  location: '',
  municipality: '',
  postalCode: '',
  country: 'España',
  phone: '',
  contactEmail: '',
  website: '',
  password: '',
  planId: 'free',
  planBilling: null,
  planStartedOn: '',
  discoveryFeatured: false,
}

interface AdminCompaniesWorkspaceProps {
  companies: AdminCompany[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  createSignal: number
  focusCompanyId?: string | null
  onSubmit: (editing: AdminCompany | null, form: CompanyEditorState) => Promise<void>
  onRequestDelete: (company: AdminCompany) => void
}

function formFromCompany(company: AdminCompany): CompanyEditorState {
  const planId = parseCompanyPlanId(company.planId)
  return {
    name: company.name,
    location: company.location,
    municipality: company.municipality ?? '',
    postalCode: company.postalCode ?? '',
    country: company.country || 'España',
    phone: company.phone,
    contactEmail: company.contactEmail ?? '',
    website: company.website ?? '',
    password: '',
    planId,
    planBilling: parseCompanyPlanBilling(company.planBilling, planId),
    planStartedOn: company.planStartedAt ? dateToInputValue(company.planStartedAt) : '',
    discoveryFeatured: company.discoveryFeatured === true,
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function AdminCompaniesWorkspace({
  companies,
  isLoading,
  isSaving,
  error,
  createSignal,
  focusCompanyId,
  onSubmit,
  onRequestDelete,
}: AdminCompaniesWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [planFilter, setPlanFilter] = useState<CompanyPlanId | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(companies[0]?.id ?? null)
  const [form, setForm] = useState<CompanyEditorState>(
    companies[0] ? formFromCompany(companies[0]) : EMPTY_FORM,
  )
  const [menuBoards, setMenuBoards] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const selectedCompany = selectedId && selectedId !== 'new'
    ? companies.find((company) => company.id === selectedId) ?? null
    : null

  useEffect(() => {
    if (createSignal > 0) {
      setSelectedId('new')
      setForm(EMPTY_FORM)
      setFormError(null)
    }
  }, [createSignal])

  useEffect(() => {
    if (!focusCompanyId) {
      return
    }
    const match = companies.find((company) => company.id === focusCompanyId)
    if (match) {
      setSelectedId(match.id)
      setForm(formFromCompany(match))
      setFormError(null)
    }
  }, [focusCompanyId, companies])

  useEffect(() => {
    if (selectedId === 'new') {
      return
    }

    const current = selectedId ? companies.find((company) => company.id === selectedId) : null
    if (current) {
      return
    }

    if (companies[0]) {
      setSelectedId(companies[0].id)
      setForm(formFromCompany(companies[0]))
      return
    }

    setSelectedId(null)
    setForm(EMPTY_FORM)
  }, [companies, selectedId])

  useEffect(() => {
    if (!selectedCompany) {
      setMenuBoards(null)
      return
    }

    let cancelled = false
    setMenuBoards(null)
    void countCompanyMenuBoards(selectedCompany.id)
      .then((count) => {
        if (!cancelled) {
          setMenuBoards(count)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMenuBoards(0)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedCompany])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return companies.filter((company) => {
      const planId = parseCompanyPlanId(company.planId)
      if (planFilter !== 'all' && planId !== planFilter) {
        return false
      }
      if (!needle) {
        return true
      }
      const planName = COMPANY_PLANS.find((plan) => plan.id === planId)?.name ?? ''
      return [company.name, company.location, company.municipality, company.loginName, company.phone, planName]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [companies, planFilter, query])

  const paidCount = companies.filter((company) => parseCompanyPlanId(company.planId) !== 'free').length

  const startCreate = () => {
    setSelectedId('new')
    setForm(EMPTY_FORM)
  }

  const selectCompany = (company: AdminCompany) => {
    setSelectedId(company.id)
    setForm(formFromCompany(company))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (form.planId !== 'free' && form.planBilling !== 'perpetual') {
      const monthlyDate = parseDateInput(form.planStartedOn)
      if (!monthlyDate) {
        setFormError('En un plan mensual tienes que poner la fecha de cobro: hoy o más adelante.')
        return
      }
      if (!isAllowedMonthlyBillingDate(monthlyDate, selectedCompany?.planStartedAt ?? null)) {
        setFormError('La fecha del plan mensual solo puede ser hoy o más adelante.')
        return
      }
    }

    try {
      await onSubmit(selectedCompany, form)
      if (!selectedCompany) {
        setSelectedId(null)
      }
    } catch {
      // El panel muestra el error.
    }
  }

  const applyPlanId = (planId: CompanyPlanId) => {
    const billing = planId === 'free' ? null : form.planBilling ?? 'monthly'
    setForm({
      ...form,
      planId,
      planBilling: billing,
      planStartedOn:
        planId === 'free'
          ? ''
          : billing === 'monthly'
            ? form.planStartedOn || dateToInputValue(new Date())
            : form.planStartedOn,
    })
  }

  const healthItems = selectedCompany
    ? companyProfileHealth(selectedCompany, { menuBoards: menuBoards ?? undefined })
    : []
  const healthScore = companyHealthScore(healthItems)
  const monthlyDate = parseDateInput(form.planStartedOn)
  const todayInput = dateToInputValue(new Date())
  const chargeState =
    form.planId !== 'free' && form.planBilling !== 'perpetual' && monthlyDate
      ? monthlyChargeState({
          startedAt: monthlyDate,
          lastPaidAt: selectedCompany?.planLastPaidAt ?? null,
        })
      : null

  return (
    <div className={styles.wrap}>
      {error ? <div className={styles.error}>{error}</div> : null}
      {formError ? <div className={styles.error}>{formError}</div> : null}

      <div className={styles.stats}>
        <article>
          <strong>{companies.length}</strong>
          <span>Locales</span>
        </article>
        <article>
          <strong>{paidCount}</strong>
          <span>De pago</span>
        </article>
        <article>
          <strong>{companies.length - paidCount}</strong>
          <span>En Mesa</span>
        </article>
      </div>

      <div className={styles.board}>
        <aside className={styles.listPane}>
          <div className={styles.listToolbar}>
            <label className={styles.search}>
              <IconSearch />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar local, plan o teléfono"
              />
            </label>
            <button type="button" className={styles.newButton} onClick={startCreate}>
              <IconPlus />
              Nuevo
            </button>
          </div>

          <div className={styles.planFilters} role="tablist" aria-label="Filtrar por plan">
            <button
              type="button"
              className={planFilter === 'all' ? styles.planFilterOn : ''}
              onClick={() => setPlanFilter('all')}
            >
              Todos
            </button>
            {COMPANY_PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={planFilter === plan.id ? styles.planFilterOn : ''}
                onClick={() => setPlanFilter(plan.id)}
              >
                {plan.name}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className={styles.muted}>Cargando restaurantes…</p>
          ) : filtered.length === 0 ? (
            <p className={styles.muted}>
              {companies.length === 0 ? 'Crea el primer restaurante.' : 'Ningún local coincide.'}
            </p>
          ) : (
            <ul className={styles.list}>
              {filtered.map((company) => {
                const planId = parseCompanyPlanId(company.planId)
                const plan = getCompanyPlan(planId)
                return (
                  <li key={company.id}>
                    <button
                      type="button"
                      className={`${styles.card} ${selectedId === company.id ? styles.cardOn : ''}`}
                      onClick={() => selectCompany(company)}
                    >
                      <span className={styles.cardName}>{company.name}</span>
                      <span className={styles.cardMeta}>
                        {company.municipality || company.location || 'Sin ubicación'}
                      </span>
                      <span className={`${styles.planChip} ${styles[`plan_${planId}`]}`}>
                        {plan?.name ?? 'Mesa'}
                        {planId !== 'free'
                          ? ` · ${company.planBilling === 'perpetual' ? 'Perpetua' : 'Mensual'}`
                          : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section className={styles.editor}>
          {selectedId == null && companies.length === 0 && !isLoading ? (
            <div className={styles.emptyEditor}>
              <h3>Aún no hay restaurantes</h3>
              <p>Da de alta el primero. El plan y si es mensual o perpetua los asignas tú.</p>
              <button type="button" className={styles.primary} onClick={startCreate}>
                Crear restaurante
              </button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
              <header className={styles.editorHead}>
                <div>
                  <p className={styles.kicker}>{selectedCompany ? 'Ficha del local' : 'Alta nueva'}</p>
                  <h3>{selectedCompany ? selectedCompany.name : 'Nuevo restaurante'}</h3>
                </div>
                {selectedCompany ? (
                  <p className={styles.access}>
                    Acceso: <strong>{selectedCompany.loginName}</strong>
                    <span>Alta {formatDate(selectedCompany.createdAt)}</span>
                  </p>
                ) : null}
              </header>

              <fieldset className={styles.fieldset}>
                <legend>Datos del local</legend>
                <label>
                  Nombre
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Dirección
                  <input
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    required
                  />
                </label>
                <div className={styles.row3}>
                  <label>
                    Municipio
                    <input
                      value={form.municipality}
                      onChange={(event) => setForm({ ...form, municipality: event.target.value })}
                    />
                  </label>
                  <label>
                    Código postal
                    <input
                      value={form.postalCode}
                      onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                    />
                  </label>
                  <label>
                    País
                    <input
                      value={form.country}
                      onChange={(event) => setForm({ ...form, country: event.target.value })}
                    />
                  </label>
                </div>
                <div className={styles.row2}>
                  <label>
                    Teléfono
                    <input
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Email de contacto
                    <input
                      type="email"
                      value={form.contactEmail}
                      onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Web
                  <input
                    value={form.website}
                    onChange={(event) => setForm({ ...form, website: event.target.value })}
                    placeholder="https://"
                  />
                </label>
              </fieldset>

              <fieldset className={styles.fieldset}>
                <legend>Plan en Adelia</legend>
                <p className={styles.hint}>El restaurante no puede cambiar esto. Solo lo asignas tú.</p>
                <label>
                  Plan
                  <select
                    value={form.planId}
                    onChange={(event) => applyPlanId(parseCompanyPlanId(event.target.value))}
                  >
                    {COMPANY_PLANS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                    {form.planId === 'premium_plus' ? (
                      <option value="premium_plus">Casa (retirado)</option>
                    ) : null}
                  </select>
                </label>
                {form.planId !== 'free' ? (
                  <div className={styles.billing}>
                    <label className={styles.radio}>
                      <input
                        type="radio"
                        name="planBilling"
                        checked={form.planBilling !== 'perpetual'}
                        onChange={() => setForm({
                          ...form,
                          planBilling: 'monthly',
                          planStartedOn: form.planStartedOn || dateToInputValue(new Date()),
                        })}
                      />
                      Mensual
                    </label>
                    <label className={styles.radio}>
                      <input
                        type="radio"
                        name="planBilling"
                        checked={form.planBilling === 'perpetual'}
                        onChange={() => setForm({ ...form, planBilling: 'perpetual' })}
                      />
                      Perpetua
                    </label>
                  </div>
                ) : (
                  <p className={styles.hint}>Mesa no tiene cobro mensual ni perpetuo.</p>
                )}
                {form.planId !== 'free' && form.planBilling !== 'perpetual' ? (
                  <label>
                    Fecha de cobro mensual
                    <input
                      type="date"
                      value={form.planStartedOn}
                      min={todayInput}
                      onChange={(event) => setForm({ ...form, planStartedOn: event.target.value })}
                      required
                    />
                  </label>
                ) : null}
                {form.planId !== 'free' && form.planBilling !== 'perpetual' ? (
                  <p className={styles.hint}>
                    Solo hoy o una fecha posterior. El cobro se repite el mismo día de cada mes.
                    {monthlyDate
                      ? ` ${monthlyChargeLabel(chargeState ?? 'upcoming')}. Próxima marca: ${formatCompanyPlanStartedAt(nextMonthlyChargeDate(monthlyDate))}.`
                      : ''}
                  </p>
                ) : selectedCompany?.planStartedAt && form.planId !== 'free' ? (
                  <p className={styles.hint}>En este plan desde el {formatDate(selectedCompany.planStartedAt)}.</p>
                ) : null}
                {form.planId !== 'free' ? (
                  <label className={styles.radio}>
                    <input
                      type="checkbox"
                      checked={form.discoveryFeatured}
                      onChange={(event) => setForm({ ...form, discoveryFeatured: event.target.checked })}
                    />
                    Destacar en Descubrimiento
                  </label>
                ) : null}
              </fieldset>

              {selectedCompany ? (
                <section className={styles.health} aria-label="Salud del local">
                  <header>
                    <p className={styles.kicker}>Salud del local</p>
                    <strong>{healthScore}%</strong>
                  </header>
                  <ul>
                    {healthItems.map((item) => (
                      <li key={item.id} className={item.ok ? styles.healthOk : styles.healthOff}>
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {!selectedCompany ? (
                <fieldset className={styles.fieldset}>
                  <legend>Acceso</legend>
                  <label>
                    Contraseña inicial
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <p className={styles.hint}>
                    Mínimo 8 caracteres, con mayúsculas, minúsculas y un número. Firebase Auth la hashea;
                    no se guarda en Firestore.
                  </p>
                </fieldset>
              ) : null}

              <div className={styles.actions}>
                {selectedCompany ? (
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => onRequestDelete(selectedCompany)}
                  >
                    Eliminar local
                  </button>
                ) : (
                  <span />
                )}
                <button type="submit" className={styles.primary} disabled={isSaving}>
                  {isSaving ? 'Guardando…' : selectedCompany ? 'Guardar cambios' : 'Crear restaurante'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

export default AdminCompaniesWorkspace
