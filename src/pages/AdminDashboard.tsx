import { useEffect, useState, type ReactNode } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { getAdminCompanies, getFirestoreErrorMessage, markCompanyMustChangePassword } from '../services/firestore'
import { createCompany, deleteCompany, updateCompany } from '../services/adminCompanies'
import {
  deleteIndexedReview,
  listAdminCustomers,
  listAdminMissions,
  listIndexedReviews,
  listLoginLocks,
  listSecurityEvents,
  listTopCustomersByAdelinas,
  saveAdminMission,
  setCustomerBlocked,
} from '../services/adminOps'
import { logout } from '../services/auth'
import type { AdminCompany } from '../types'
import type {
  AdminCustomerRow,
  AdminLoginLock,
  AdminMissionRow,
  AdminSecurityEvent,
  IndexedReview,
} from '../types/adminOps'
import { ADELIA_LOGO_URL } from '../constants/brand'
import AdminOverviewBoard from '../components/admin/AdminOverviewBoard'
import AdminCompaniesWorkspace, { type CompanyEditorState } from '../components/admin/AdminCompaniesWorkspace'
import AdminPlansBoard from '../components/admin/AdminPlansBoard'
import AdminCustomersBoard from '../components/admin/AdminCustomersBoard'
import AdminModerationBoard from '../components/admin/AdminModerationBoard'
import AdminDiscoveryBoard from '../components/admin/AdminDiscoveryBoard'
import AdminPlayBoard from '../components/admin/AdminPlayBoard'
import AdminIncidentsBoard from '../components/admin/AdminIncidentsBoard'
import {
  IconAlert,
  IconBuildings,
  IconLogout,
  IconOverview,
  IconPlans,
  IconPlay,
  IconPlus,
  IconRefresh,
  IconShield,
  IconSpark,
  IconUsers,
} from '../components/admin/AdminIcons'
import { getAdminOverview } from '../services/adminAnalytics'
import type { AdminOverview } from '../utils/adminOverview'
import type { DateRangeFilter, TimeRange } from '../services/adminAnalytics.types'
import { isAllowedMonthlyBillingDate, parseDateInput } from '../data/companyPlans'
import { loadAnalyticsFilters, saveAnalyticsFilters } from '../utils/analyticsStorage'
import styles from './AdminDashboard.module.css'

type AdminView =
  | 'analytics'
  | 'companies'
  | 'plans'
  | 'customers'
  | 'moderation'
  | 'discovery'
  | 'play'
  | 'incidents'

const VIEW_TITLE: Record<AdminView, string> = {
  analytics: 'El pulso de Adelia',
  companies: 'Restaurantes',
  plans: 'Planes y cobro',
  customers: 'Clientes',
  moderation: 'Moderación',
  discovery: 'Descubrimiento',
  play: 'Compite y Adelinás',
  incidents: 'Incidencias',
}

function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function AdminDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [opsError, setOpsError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<AdminCompany | null>(null)
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)
  const [createSignal, setCreateSignal] = useState(0)
  const [focusCompanyId, setFocusCompanyId] = useState<string | null>(null)

  const [currentView, setCurrentView] = useState<AdminView>('analytics')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [customDateRange, setCustomDateRange] = useState<DateRangeFilter | undefined>(undefined)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>(() => loadAnalyticsFilters()?.timeRange ?? 'month')
  const [countryFilter, setCountryFilter] = useState<string>(() => loadAnalyticsFilters()?.countryFilter ?? '')

  const [customers, setCustomers] = useState<AdminCustomerRow[]>([])
  const [customersTotal, setCustomersTotal] = useState(0)
  const [reviews, setReviews] = useState<IndexedReview[]>([])
  const [missions, setMissions] = useState<AdminMissionRow[]>([])
  const [events, setEvents] = useState<AdminSecurityEvent[]>([])
  const [locks, setLocks] = useState<AdminLoginLock[]>([])
  const [opsLoading, setOpsLoading] = useState(false)

  const adminName = profile?.displayName?.trim() || 'Fabian'

  const loadCompanies = async () => {
    setIsLoading(true)
    setError(null)

    try {
      setCompanies(await getAdminCompanies())
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true)
    setAnalyticsError(null)
    try {
      setOverview(await getAdminOverview({
        timeRange,
        customRange: customDateRange,
        countryFilter: countryFilter || undefined,
      }))
    } catch (err) {
      setAnalyticsError(getFirestoreErrorMessage(err))
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  const loadViewData = async (view: AdminView) => {
    if (view === 'analytics' || view === 'companies' || view === 'plans' || view === 'discovery') {
      return
    }

    setOpsLoading(true)
    setOpsError(null)
    try {
      if (view === 'customers') {
        const listed = await listAdminCustomers()
        setCustomers(listed.rows)
        setCustomersTotal(listed.totalCount)
      } else if (view === 'moderation') {
        setReviews(await listIndexedReviews())
      } else if (view === 'play') {
        const [nextMissions, nextCustomers] = await Promise.all([
          listAdminMissions(),
          listTopCustomersByAdelinas(8),
        ])
        setMissions(nextMissions)
        setCustomers(nextCustomers)
      } else if (view === 'incidents') {
        const [nextEvents, nextLocks] = await Promise.all([listSecurityEvents(), listLoginLocks()])
        setEvents(nextEvents)
        setLocks(nextLocks)
      }
    } catch (err) {
      setOpsError(getFirestoreErrorMessage(err))
    } finally {
      setOpsLoading(false)
    }
  }

  useEffect(() => {
    if (
      currentView === 'companies'
      || currentView === 'plans'
      || currentView === 'discovery'
    ) {
      if (companies.length === 0) {
        void loadCompanies()
      }
    }
  }, [currentView])

  useEffect(() => {
    if (currentView === 'analytics') {
      void loadAnalytics()
    }
  }, [currentView, timeRange, countryFilter, customDateRange])

  useEffect(() => {
    saveAnalyticsFilters({ timeRange, countryFilter })
  }, [timeRange, countryFilter])

  useEffect(() => {
    void loadViewData(currentView)
  }, [currentView])

  const openCompany = (companyId: string) => {
    setFocusCompanyId(companyId)
    setCurrentView('companies')
  }

  const handleCompanySubmit = async (editing: AdminCompany | null, form: CompanyEditorState) => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    const monthlyDate = form.planId !== 'free' && form.planBilling !== 'perpetual'
      ? parseDateInput(form.planStartedOn)
      : null

    if (form.planId !== 'free' && form.planBilling !== 'perpetual') {
      if (!monthlyDate || !isAllowedMonthlyBillingDate(monthlyDate, editing?.planStartedAt ?? null)) {
        setIsSaving(false)
        setError('La fecha del plan mensual solo puede ser hoy o más adelante.')
        throw new Error('La fecha del plan mensual solo puede ser hoy o más adelante.')
      }
    }

    try {
      if (editing) {
        await updateCompany(editing.id, editing, {
          name: form.name,
          location: form.location,
          municipality: form.municipality,
          postalCode: form.postalCode,
          country: form.country,
          phone: form.phone,
          contactEmail: form.contactEmail,
          website: form.website,
          password: form.password.trim() || undefined,
          planId: form.planId,
          planBilling: form.planId === 'free' ? null : form.planBilling ?? 'monthly',
          planStartedAt: monthlyDate,
          discoveryFeatured: form.discoveryFeatured,
        })
        setSuccess(`"${form.name}" actualizado.`)
      } else {
        const result = await createCompany({
          name: form.name,
          location: form.location,
          municipality: form.municipality,
          postalCode: form.postalCode,
          country: form.country,
          phone: form.phone,
          contactEmail: form.contactEmail,
          website: form.website,
          password: form.password.trim(),
          planId: form.planId,
          planBilling: form.planId === 'free' ? null : form.planBilling ?? 'monthly',
          planStartedAt: monthlyDate,
          discoveryFeatured: form.discoveryFeatured,
        })
        await markCompanyMustChangePassword(result.company.ownerUid, result.company.id)
        setSuccess(`"${form.name}" creado. Deberá cambiar la contraseña al entrar.`)
      }

      await loadCompanies()
      await refreshProfile()
    } catch (err) {
      setError(getFirestoreErrorMessage(err, 'save'))
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) return
    setIsDeletingCompany(true)
    setError(null)
    try {
      await deleteCompany(companyToDelete.id, companyToDelete)
      setSuccess(`Empresa "${companyToDelete.name}" eliminada.`)
      setCompanyToDelete(null)
      await loadCompanies()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la empresa.')
    } finally {
      setIsDeletingCompany(false)
    }
  }

  const handleMarkPaid = async (company: AdminCompany) => {
    setIsSaving(true)
    setOpsError(null)
    try {
      await updateCompany(company.id, company, { planLastPaidAt: 'now' })
      setSuccess(`Cobro marcado en ${company.name}.`)
      await loadCompanies()
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : 'No se pudo marcar el cobro.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleFeatured = async (company: AdminCompany) => {
    setIsSaving(true)
    try {
      await updateCompany(company.id, company, { discoveryFeatured: !company.discoveryFeatured })
      await loadCompanies()
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : 'No se pudo destacar el local.')
    } finally {
      setIsSaving(false)
    }
  }


  const navButton = (view: AdminView, label: string, icon: ReactNode, badge?: number) => (
    <button
      type="button"
      className={`${styles.sideLink} ${currentView === view ? styles.sideLinkOn : ''}`}
      onClick={() => setCurrentView(view)}
    >
      {icon}
      {label}
      {typeof badge === 'number' ? <em>{badge}</em> : null}
    </button>
  )

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
          <div>
            <strong>Adelia</strong>
            <span>Control center</span>
          </div>
        </div>

        <nav className={styles.sideNav}>
          {navButton('analytics', 'Visión general', <IconOverview />)}
          {navButton('companies', 'Restaurantes', <IconBuildings />, companies.length)}
          {navButton('plans', 'Planes', <IconPlans />)}
          {navButton('customers', 'Clientes', <IconUsers />)}
          {navButton('moderation', 'Moderación', <IconShield />)}
          {navButton('discovery', 'Descubrimiento', <IconSpark />)}
          {navButton('play', 'Compite', <IconPlay />)}
          {navButton('incidents', 'Incidencias', <IconAlert />)}
        </nav>

        <button type="button" className={styles.sideLogout} onClick={() => setLogoutConfirmOpen(true)}>
          <IconLogout />
          Cerrar sesión
        </button>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.kicker}>{greetingFor()}, {adminName}</p>
            <h1>{VIEW_TITLE[currentView]}</h1>
          </div>
          {currentView === 'analytics' ? (
            <button type="button" className={styles.iconButton} onClick={() => void loadAnalytics()} disabled={isLoadingAnalytics}>
              <IconRefresh />
              Actualizar
            </button>
          ) : currentView === 'companies' ? (
            <button type="button" className={styles.primaryButton} onClick={() => setCreateSignal((value) => value + 1)}>
              <IconPlus />
              Nuevo restaurante
            </button>
          ) : (
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                void loadCompanies()
                void loadViewData(currentView)
              }}
            >
              <IconRefresh />
              Actualizar
            </button>
          )}
        </header>

        <main className={styles.main}>
          {success ? <div className={styles.success}>{success}</div> : null}
          {opsError && currentView !== 'companies' ? <div className={styles.errorBanner}>{opsError}</div> : null}

          {currentView === 'analytics' ? (
            <AdminOverviewBoard
              overview={overview}
              isLoading={isLoadingAnalytics}
              error={analyticsError}
              timeRange={timeRange}
              countryFilter={countryFilter}
              onTimeRangeChange={setTimeRange}
              onCountryFilterChange={setCountryFilter}
              onCustomDateRangeChange={setCustomDateRange}
              onRetry={() => void loadAnalytics()}
            />
          ) : null}

          {currentView === 'companies' ? (
            <AdminCompaniesWorkspace
              companies={companies}
              isLoading={isLoading}
              isSaving={isSaving}
              error={error}
              createSignal={createSignal}
              focusCompanyId={focusCompanyId}
              onSubmit={handleCompanySubmit}
              onRequestDelete={setCompanyToDelete}
            />
          ) : null}

          {currentView === 'plans' ? (
            <AdminPlansBoard
              companies={companies}
              isSaving={isSaving}
              onOpenCompany={openCompany}
              onMarkPaid={handleMarkPaid}
            />
          ) : null}

          {currentView === 'customers' ? (
            <AdminCustomersBoard
              customers={customers}
              totalCount={customersTotal}
              isLoading={opsLoading}
              isSaving={isSaving}
              error={opsError}
              onToggleBlocked={async (customer) => {
                setIsSaving(true)
                try {
                  await setCustomerBlocked(customer.id, !customer.blocked)
                  setCustomers((current) => current.map((item) => (
                    item.id === customer.id ? { ...item, blocked: !customer.blocked } : item
                  )))
                } finally {
                  setIsSaving(false)
                }
              }}
            />
          ) : null}

          {currentView === 'moderation' ? (
            <AdminModerationBoard
              reviews={reviews}
              isLoading={opsLoading}
              isSaving={isSaving}
              error={opsError}
              onDelete={async (review) => {
                setIsSaving(true)
                try {
                  await deleteIndexedReview(review)
                  setReviews((current) => current.filter((item) => item.id !== review.id))
                } finally {
                  setIsSaving(false)
                }
              }}
            />
          ) : null}

          {currentView === 'discovery' ? (
            <AdminDiscoveryBoard
              companies={companies}
              isSaving={isSaving}
              onOpenCompany={openCompany}
              onToggleFeatured={handleToggleFeatured}
            />
          ) : null}

          {currentView === 'play' ? (
            <AdminPlayBoard
              missions={missions}
              customers={customers}
              isLoading={opsLoading}
              isSaving={isSaving}
              error={opsError}
              onSaveMission={async (mission) => {
                setIsSaving(true)
                try {
                  await saveAdminMission(mission)
                  setMissions((current) => current.map((item) => item.id === mission.id ? mission : item))
                  setSuccess(`Misión "${mission.name}" guardada.`)
                } finally {
                  setIsSaving(false)
                }
              }}
            />
          ) : null}

          {currentView === 'incidents' ? (
            <AdminIncidentsBoard
              events={events}
              locks={locks}
              isLoading={opsLoading}
              error={opsError}
            />
          ) : null}
        </main>
      </div>

      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Cerrar sesión"
        message="¿Seguro que quieres salir del panel?"
        confirmLabel="Cerrar sesión"
        onConfirm={() => void logout()}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
      <ConfirmDialog
        isOpen={Boolean(companyToDelete)}
        title="Eliminar empresa"
        message={
          companyToDelete
            ? `¿Eliminar "${companyToDelete.name}"? Se borra su acceso, mesas y reservas.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        isLoading={isDeletingCompany}
        onConfirm={() => void handleConfirmDeleteCompany()}
        onCancel={() => setCompanyToDelete(null)}
      />
    </div>
  )
}

export default AdminDashboard
