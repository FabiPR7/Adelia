import { useEffect, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { getAdminCompanies, markCompanyMustChangePassword, syncAllCompanyLoginIndexes } from '../services/firestore'
import { createCompany, deleteCompany, updateCompany } from '../services/adminCompanies'
import { logout } from '../services/auth'
import type { AdminCompany } from '../types'
import { ADELIA_LOGO_URL } from '../constants/brand'
import AdminKpiCard from '../components/admin/AdminKpiCard'
import AdminGrowthLineChart from '../components/admin/AdminGrowthLineChart'
import AdminGeographicBarChart from '../components/admin/AdminGeographicBarChart'
import AdminAnalyticsFilters from '../components/admin/AdminAnalyticsFilters'
import {
  getAdminStats,
  getUserGrowthData,
  getCompanyGrowthData,
  getUsersByCountry,
  getCompaniesByCountry,
  getAllCountries,
  type AdminStats,
  type UserGrowthData,
  type CompanyGrowthData,
  type GeographicData,
  type TimeRange,
  type DateRangeFilter,
} from '../services/adminAnalytics'
import styles from './AdminDashboard.module.css'

interface CompanyFormState {
  name: string
  location: string
  phone: string
  website: string
  password: string
}

const EMPTY_FORM: CompanyFormState = {
  name: '',
  location: '',
  phone: '',
  website: '',
  password: '',
}

function formatRegisteredDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function AdminDashboard() {
  const { refreshProfile } = useAuth()
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState<AdminCompany | null>(null)
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<AdminCompany | null>(null)
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)

  // Analytics state
  const [currentView, setCurrentView] = useState<'analytics' | 'companies'>('analytics')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [userGrowth, setUserGrowth] = useState<UserGrowthData>({ labels: [], values: [] })
  const [companyGrowth, setCompanyGrowth] = useState<CompanyGrowthData>({ labels: [], values: [] })
  const [usersByCountry, setUsersByCountry] = useState<GeographicData[]>([])
  const [companiesByCountry, setCompaniesByCountry] = useState<GeographicData[]>([])
  const [availableCountries, setAvailableCountries] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>('month')
  const [countryFilter, setCountryFilter] = useState<string>('')
  const [customDateRange, setCustomDateRange] = useState<DateRangeFilter | undefined>(undefined)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)

  const loadCompanies = async () => {
    setIsLoading(true)
    setError(null)

    try {
      void syncAllCompanyLoginIndexes().catch(() => {
        // El login sigue resolviendo accesos por nombre de empresa.
      })

      const data = await getAdminCompanies()
      setCompanies(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las empresas desde Firestore.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true)
    setError(null)

    try {
      const [
        statsData,
        userGrowthData,
        companyGrowthData,
        usersGeoData,
        companiesGeoData,
        countries,
      ] = await Promise.all([
        getAdminStats(),
        getUserGrowthData(timeRange, customDateRange),
        getCompanyGrowthData(timeRange, customDateRange),
        getUsersByCountry(countryFilter || undefined),
        getCompaniesByCountry(countryFilter || undefined),
        getAllCountries(),
      ])

      setStats(statsData)
      setUserGrowth(userGrowthData)
      setCompanyGrowth(companyGrowthData)
      setUsersByCountry(usersGeoData)
      setCompaniesByCountry(companiesGeoData)
      setAvailableCountries(countries)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las estadísticas.',
      )
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  useEffect(() => {
    void loadCompanies()
  }, [])

  useEffect(() => {
    if (currentView === 'analytics') {
      void loadAnalytics()
    }
  }, [currentView, timeRange, countryFilter, customDateRange])

  const openCreateForm = () => {
    setEditingCompany(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setSuccess(null)
  }

  const openEditForm = (company: AdminCompany) => {
    setEditingCompany(company)
    setForm({
      name: company.name,
      location: company.location,
      phone: company.phone,
      website: company.website,
      password: '',
    })
    setShowForm(true)
    setSuccess(null)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingCompany(null)
    setForm(EMPTY_FORM)
  }

  const togglePasswordVisibility = (companyId: string) => {
    setVisiblePasswords((current) => ({
      ...current,
      [companyId]: !current[companyId],
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const newPassword = form.password.trim()

      if (editingCompany) {
        if (newPassword) {
          setError(
            'Para cambiar la contraseña de una empresa existente, el restaurante debe hacerlo al entrar con «Cambiar contraseña», o créala de nuevo con la contraseña deseada.',
          )
          setIsSaving(false)
          return
        }

        await updateCompany(editingCompany.id, editingCompany, {
          name: form.name,
          location: form.location,
          phone: form.phone,
          website: form.website,
        })

        setSuccess(`Empresa "${form.name}" actualizada correctamente.`)
      } else {
        const result = await createCompany({
          name: form.name,
          location: form.location,
          phone: form.phone,
          website: form.website,
          password: newPassword,
        })

        await markCompanyMustChangePassword(result.company.ownerUid, result.company.id)
        setSuccess(`Empresa "${form.name}" creada. Deberá cambiar la contraseña al entrar.`)
      }

      closeForm()
      await loadCompanies()
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la empresa.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (company: AdminCompany) => {
    setCompanyToDelete(company)
  }

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) {
      return
    }

    setIsDeletingCompany(true)
    setError(null)
    setSuccess(null)

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

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src={ADELIA_LOGO_URL} alt="Adelia" className={styles.logo} />
          <div>
            <h1>Panel Admin</h1>
            <p>Gestión y estadísticas</p>
          </div>
        </div>
        <button type="button" className={styles.logoutButton} onClick={() => setLogoutConfirmOpen(true)}>
          Cerrar sesión
        </button>
      </header>

      <nav className={styles.nav}>
        <button
          type="button"
          className={`${styles.navButton} ${currentView === 'analytics' ? styles.navButtonActive : ''}`}
          onClick={() => setCurrentView('analytics')}
        >
          📊 Analytics
        </button>
        <button
          type="button"
          className={`${styles.navButton} ${currentView === 'companies' ? styles.navButtonActive : ''}`}
          onClick={() => setCurrentView('companies')}
        >
          🏢 Empresas
        </button>
      </nav>

      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {currentView === 'analytics' && (
          <>
            <div className={styles.analyticsSection}>
              <h2 className={styles.sectionTitle}>Estadísticas generales</h2>
              
              {isLoadingAnalytics ? (
                <p className={styles.loadingText}>Cargando estadísticas…</p>
              ) : stats ? (
                <>
                  <div className={styles.kpiGrid}>
                    <AdminKpiCard
                      title="Total Usuarios"
                      value={stats.totalCustomers}
                      subtitle="Clientes registrados"
                      trend={{
                        value: stats.newUsersThisMonth,
                        label: 'este mes',
                        positive: true,
                      }}
                      icon="👥"
                    />
                    <AdminKpiCard
                      title="Nuevos Hoy"
                      value={stats.newUsersToday}
                      subtitle="Usuarios nuevos hoy"
                      trend={{
                        value: stats.newUsersThisWeek,
                        label: 'esta semana',
                        positive: true,
                      }}
                      icon="✨"
                    />
                    <AdminKpiCard
                      title="Total Empresas"
                      value={stats.totalCompanies}
                      subtitle="Restaurantes activos"
                      trend={{
                        value: stats.newCompaniesThisMonth,
                        label: 'este mes',
                        positive: true,
                      }}
                      icon="🏢"
                    />
                    <AdminKpiCard
                      title="Empresas Nuevas"
                      value={stats.newCompaniesToday}
                      subtitle="Registradas hoy"
                      trend={{
                        value: stats.newCompaniesThisWeek,
                        label: 'esta semana',
                        positive: true,
                      }}
                      icon="🎯"
                    />
                  </div>

                  <AdminAnalyticsFilters
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    countryFilter={countryFilter}
                    onCountryFilterChange={setCountryFilter}
                    availableCountries={availableCountries}
                    onCustomDateRangeChange={setCustomDateRange}
                  />

                  <div className={styles.chartsGrid}>
                    <AdminGrowthLineChart
                      title="Crecimiento de Usuarios"
                      data={userGrowth}
                      color="#2e7d6b"
                    />
                    <AdminGrowthLineChart
                      title="Crecimiento de Empresas"
                      data={companyGrowth}
                      color="#8b6914"
                    />
                  </div>

                  <div className={styles.chartsGrid}>
                    <AdminGeographicBarChart
                      title="Usuarios por País"
                      data={usersByCountry}
                      color="#2e7d6b"
                    />
                    <AdminGeographicBarChart
                      title="Empresas por País"
                      data={companiesByCountry}
                      color="#8b6914"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </>
        )}

        {currentView === 'companies' && (
          <>
            <div className={styles.toolbar}>
              <div>
                <h2>Empresas registradas</h2>
                <p>{companies.length} empresa(s) activa(s)</p>
              </div>
              <button type="button" className={styles.createButton} onClick={openCreateForm}>
                + Nueva empresa
              </button>
            </div>

            {isLoading ? (
              <p className={styles.loadingText}>Cargando empresas…</p>
            ) : companies.length === 0 ? (
              <div className={styles.empty}>
                <p>No hay empresas todavía. Crea la primera.</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Nombre acceso</th>
                  <th>Contraseña</th>
                  <th>Alta</th>
                  <th>Contacto</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <strong>{company.name}</strong>
                      <span className={styles.subText}>{company.location}</span>
                    </td>
                    <td>{company.loginName}</td>
                    <td>
                      <div className={styles.passwordCell}>
                        {company.loginPassword === '—' ? (
                          <>
                            <span className={styles.missingPassword}>Sin registrar</span>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => openEditForm(company)}
                            >
                              Asignar
                            </button>
                          </>
                        ) : (
                          <>
                            <code>
                              {visiblePasswords[company.id]
                                ? company.loginPassword
                                : '••••••••'}
                            </code>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => togglePasswordVisibility(company.id)}
                            >
                              {visiblePasswords[company.id] ? 'Ocultar' : 'Ver'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td>{formatRegisteredDate(company.createdAt)}</td>
                    <td>
                      <span className={styles.subText}>{company.phone}</span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" onClick={() => openEditForm(company)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => handleDelete(company)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {showForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>{editingCompany ? 'Editar empresa' : 'Nueva empresa'}</h3>
            <p className={styles.modalHint}>
              {editingCompany
                ? 'Actualiza los datos de la empresa. Si cambias la contraseña, se guardará aquí.'
                : 'Solo tú puedes dar de alta empresas. No hay registro público.'}
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label>
                Nombre de la empresa
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Dirección
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  required
                />
              </label>
              <label>
                Teléfono
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </label>
              <label>
                Web (opcional)
                <input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </label>
              <label>
                {editingCompany ? 'Nueva contraseña' : 'Contraseña de acceso'}
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingCompany}
                  placeholder={
                    editingCompany
                      ? 'Escribe la nueva contraseña (obligatorio si quieres cambiarla)'
                      : ''
                  }
                />
              </label>

              <div className={styles.formActions}>
                <button type="button" onClick={closeForm}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Cerrar sesión"
        message="¿Estás seguro de que quieres cerrar sesión?"
        confirmLabel="Cerrar sesión"
        onConfirm={() => void handleLogout()}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(companyToDelete)}
        title="Eliminar empresa"
        message={
          companyToDelete
            ? `¿Estás seguro de eliminar "${companyToDelete.name}"? Se borrará su acceso, contraseña, mesas y reservas.`
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
