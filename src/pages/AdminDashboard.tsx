import { useEffect, useMemo, useState, type ReactNode } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { getAdminCompanies, getFirestoreErrorMessage, markCompanyMustChangePassword } from '../services/firestore'
import { createCompany, deleteCompany, updateCompany } from '../services/adminCompanies'
import {
  deleteIndexedReview,
  findCustomerIdByEmail,
  listAdminCustomers,
  listAdminMissions,
  listIndexedReviews,
  listLoginLocks,
  listSecurityEvents,
  listTopCustomersByAdelinas,
  saveAdminMission,
} from '../services/adminOps'
import { adminApi } from '../services/adminApi'
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
import AdminHomeBoard from '../components/admin/AdminHomeBoard'
import AdminCompaniesWorkspace, { type CompanyEditorState } from '../components/admin/AdminCompaniesWorkspace'
import AdminPlansBoard from '../components/admin/AdminPlansBoard'
import AdminCustomersBoard from '../components/admin/AdminCustomersBoard'
import AdminCustomerDrawer from '../components/admin/AdminCustomerDrawer'
import AdminModerationBoard from '../components/admin/AdminModerationBoard'
import AdminDiscoveryBoard from '../components/admin/AdminDiscoveryBoard'
import AdminPlayBoard from '../components/admin/AdminPlayBoard'
import AdminIncidentsBoard from '../components/admin/AdminIncidentsBoard'
import AdminBroadcastBoard from '../components/admin/AdminBroadcastBoard'
import AdminAuditBoard from '../components/admin/AdminAuditBoard'
import AdminTabs from '../components/admin/AdminTabs'
import CatalogBilling from '../components/admin/catalog/CatalogBilling'
import { CatalogCompanyGame, CatalogCustomerGame } from '../components/admin/catalog/CatalogGame'
import CatalogItems from '../components/admin/catalog/CatalogItems'
import CatalogPlans from '../components/admin/catalog/CatalogPlans'
import { CatalogPenalties, CatalogRewards } from '../components/admin/catalog/CatalogRewards'
import {
  IconAlert,
  IconBuildings,
  IconInbox,
  IconLogout,
  IconOverview,
  IconPlans,
  IconPlay,
  IconPlus,
  IconRefresh,
  IconShield,
  IconUsers,
} from '../components/admin/AdminIcons'
import { isAllowedMonthlyBillingDate, parseDateInput } from '../data/companyPlans'
import styles from './AdminDashboard.module.css'

type AdminView = 'home' | 'companies' | 'plans' | 'customers' | 'game' | 'notify' | 'moderation' | 'security'

const VIEW_TITLE: Record<AdminView, string> = {
  home: 'El pulso de Adelia',
  companies: 'Restaurantes',
  plans: 'Planes y cobro',
  customers: 'Clientes',
  game: 'Juego',
  notify: 'Avisos',
  moderation: 'Moderación',
  security: 'Seguridad',
}

const VIEW_HINT: Record<AdminView, string> = {
  home: 'Ingresos, crecimiento y actividad de toda la plataforma.',
  companies: 'Altas, fichas, planes, actividad y desactivación de locales.',
  plans: 'Suscripciones, precios, límites de cada plan y cobro con Lemon Squeezy.',
  customers: 'Fichas de clientes: nivel, XP, Adelinás, objetos, reservas y bloqueos.',
  game: 'Misiones, niveles, objetos, recompensas y penalizaciones de clientes y restaurantes.',
  notify: 'Mensajes dentro de Adelia para un cliente, un local o todos.',
  moderation: 'Reseñas públicas de los restaurantes.',
  security: 'Accesos bloqueados, alertas y todos los cambios hechos desde este panel.',
}

const NAV: Array<{ group: string; items: Array<{ view: AdminView; label: string; icon: ReactNode }> }> = [
  { group: 'General', items: [{ view: 'home', label: 'Inicio', icon: <IconOverview /> }] },
  {
    group: 'Negocio',
    items: [
      { view: 'companies', label: 'Restaurantes', icon: <IconBuildings /> },
      { view: 'plans', label: 'Planes y cobro', icon: <IconPlans /> },
    ],
  },
  {
    group: 'Personas',
    items: [
      { view: 'customers', label: 'Clientes', icon: <IconUsers /> },
      { view: 'notify', label: 'Avisos', icon: <IconInbox /> },
    ],
  },
  { group: 'Producto', items: [{ view: 'game', label: 'Juego', icon: <IconPlay /> }] },
  {
    group: 'Control',
    items: [
      { view: 'moderation', label: 'Moderación', icon: <IconShield /> },
      { view: 'security', label: 'Seguridad', icon: <IconAlert /> },
    ],
  },
]

function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function AdminDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [companiesLoaded, setCompaniesLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [opsError, setOpsError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<AdminCompany | null>(null)
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)
  const [createSignal, setCreateSignal] = useState(0)
  const [focusCompanyId, setFocusCompanyId] = useState<string | null>(null)
  const [homeKey, setHomeKey] = useState(0)
  const [navOpen, setNavOpen] = useState(false)

  const [currentView, setCurrentView] = useState<AdminView>('home')

  const [customers, setCustomers] = useState<AdminCustomerRow[]>([])
  const [customersTotal, setCustomersTotal] = useState(0)
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<IndexedReview[]>([])
  const [missions, setMissions] = useState<AdminMissionRow[]>([])
  const [topPlayers, setTopPlayers] = useState<AdminCustomerRow[]>([])
  const [events, setEvents] = useState<AdminSecurityEvent[]>([])
  const [locks, setLocks] = useState<AdminLoginLock[]>([])
  const [opsLoading, setOpsLoading] = useState(false)

  const adminName = profile?.displayName?.trim() || 'Fabian'
  const companyNames = useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies])

  const loadCompanies = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setCompanies(await getAdminCompanies())
      setCompaniesLoaded(true)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const loadViewData = async (view: AdminView) => {
    setOpsLoading(true)
    setOpsError(null)
    try {
      if (view === 'customers') {
        const listed = await listAdminCustomers()
        setCustomers(listed.rows)
        setCustomersTotal(listed.totalCount)
      } else if (view === 'moderation') {
        setReviews(await listIndexedReviews())
      } else if (view === 'game') {
        const [nextMissions, nextPlayers] = await Promise.all([listAdminMissions(), listTopCustomersByAdelinas(8)])
        setMissions(nextMissions)
        setTopPlayers(nextPlayers)
      } else if (view === 'security') {
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
    const needsCompanies = ['companies', 'plans', 'notify', 'customers'].includes(currentView)
    if (needsCompanies && !companiesLoaded) {
      void loadCompanies()
    }
    void loadViewData(currentView)
    setSuccess(null)
    setNavOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView])

  const go = (view: AdminView) => setCurrentView(view)

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

    const payload = {
      name: form.name,
      location: form.location,
      municipality: form.municipality,
      postalCode: form.postalCode,
      country: form.country,
      phone: form.phone,
      contactEmail: form.contactEmail,
      website: form.website,
      planId: form.planId,
      planBilling: form.planId === 'free' ? null : form.planBilling ?? 'monthly',
      planStartedAt: monthlyDate,
      discoveryFeatured: form.discoveryFeatured,
    }

    try {
      if (editing) {
        await updateCompany(editing.id, editing, { ...payload, password: form.password.trim() || undefined })
        void adminApi.logChange('company.save', editing.id, { name: form.name, planId: form.planId })
        setSuccess(`«${form.name}» actualizado.`)
      } else {
        const result = await createCompany({ ...payload, password: form.password.trim() })
        await markCompanyMustChangePassword(result.company.ownerUid, result.company.id)
        void adminApi.logChange('company.create', result.company.id, { name: form.name, planId: form.planId })
        setSuccess(`«${form.name}» creado. Deberá cambiar la contraseña al entrar.`)
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
      void adminApi.logChange('company.delete', companyToDelete.id, { name: companyToDelete.name })
      setSuccess(`Restaurante «${companyToDelete.name}» eliminado.`)
      setCompanyToDelete(null)
      await loadCompanies()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el restaurante.')
    } finally {
      setIsDeletingCompany(false)
    }
  }

  const handleMarkPaid = async (company: AdminCompany) => {
    setIsSaving(true)
    setOpsError(null)
    try {
      await updateCompany(company.id, company, { planLastPaidAt: 'now' })
      void adminApi.logChange('company.save', company.id, { name: company.name, section: 'Cobro marcado a mano' })
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
      void adminApi.logChange('company.save', company.id, {
        name: company.name,
        section: company.discoveryFeatured ? 'Quitado de destacados' : 'Destacado',
      })
      await loadCompanies()
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : 'No se pudo destacar el local.')
    } finally {
      setIsSaving(false)
    }
  }

  const refresh = () => {
    if (currentView === 'home') {
      setHomeKey((value) => value + 1)
      return
    }
    void loadCompanies()
    void loadViewData(currentView)
  }

  return (
    <div className={`${styles.shell} ${navOpen ? styles.navOpen : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
          <div>
            <strong>Adelia</strong>
            <span>Administración</span>
          </div>
        </div>

        <nav className={styles.sideNav} aria-label="Secciones del panel">
          {NAV.map((group) => (
            <div key={group.group} className={styles.navGroup}>
              <p className={styles.navGroupLabel}>{group.group}</p>
              {group.items.map((item) => (
                <button
                  key={item.view}
                  type="button"
                  aria-current={currentView === item.view ? 'page' : undefined}
                  className={`${styles.sideLink} ${currentView === item.view ? styles.sideLinkOn : ''}`}
                  onClick={() => go(item.view)}
                >
                  {item.icon}
                  {item.label}
                  {item.view === 'companies' && companiesLoaded ? <em>{companies.length}</em> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <button type="button" className={styles.sideLogout} onClick={() => setLogoutConfirmOpen(true)}>
          <IconLogout />
          Cerrar sesión
        </button>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label="Abrir menú"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((value) => !value)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className={styles.kicker}>{greetingFor()}, {adminName}</p>
              <h1>{VIEW_TITLE[currentView]}</h1>
              <p className={styles.viewHint}>{VIEW_HINT[currentView]}</p>
            </div>
          </div>
          <div className={styles.topbarActions}>
            {currentView === 'companies' ? (
              <button type="button" className={styles.primaryButton} onClick={() => setCreateSignal((value) => value + 1)}>
                <IconPlus />
                Nuevo restaurante
              </button>
            ) : null}
            <button type="button" className={styles.iconButton} onClick={refresh}>
              <IconRefresh />
              Actualizar
            </button>
          </div>
        </header>

        <main className={styles.main}>
          {success ? <div className={styles.success}>{success}</div> : null}
          {opsError && currentView !== 'companies' ? <div className={styles.errorBanner}>{opsError}</div> : null}

          {currentView === 'home' ? (
            <AdminHomeBoard
              key={homeKey}
              onOpenCompany={openCompany}
              onNavigate={(view) => go(view)}
            />
          ) : null}

          {currentView === 'companies' ? (
            <AdminTabs
              label="Restaurantes"
              tabs={[
                {
                  id: 'list',
                  label: 'Fichas',
                  render: () => (
                    <AdminCompaniesWorkspace
                      companies={companies}
                      isLoading={isLoading}
                      isSaving={isSaving}
                      error={error}
                      createSignal={createSignal}
                      focusCompanyId={focusCompanyId}
                      onSubmit={handleCompanySubmit}
                      onRequestDelete={setCompanyToDelete}
                      onCompanyChanged={() => void loadCompanies()}
                    />
                  ),
                },
                {
                  id: 'quality',
                  label: 'Calidad y destacados',
                  render: () => (
                    <AdminDiscoveryBoard
                      companies={companies}
                      isSaving={isSaving}
                      onOpenCompany={openCompany}
                      onToggleFeatured={handleToggleFeatured}
                    />
                  ),
                },
              ]}
            />
          ) : null}

          {currentView === 'plans' ? (
            <AdminTabs
              label="Planes y cobro"
              intro="Los precios y lo que incluye cada plan se guardan en la base de datos: al cambiarlos aquí, la web, la página de planes y los límites del panel de empresa se actualizan solos."
              tabs={[
                {
                  id: 'subscriptions',
                  label: 'Suscripciones',
                  render: () => (
                    <AdminPlansBoard companies={companies} isSaving={isSaving} onOpenCompany={openCompany} onMarkPaid={handleMarkPaid} />
                  ),
                },
                { id: 'catalog', label: 'Precios y límites', render: () => <CatalogPlans /> },
                { id: 'billing', label: 'Cobro con Lemon', render: () => <CatalogBilling /> },
              ]}
            />
          ) : null}

          {currentView === 'customers' ? (
            <AdminCustomersBoard
              customers={customers}
              totalCount={customersTotal}
              isLoading={opsLoading}
              isSaving={isSaving}
              error={opsError}
              onOpen={setOpenCustomerId}
              onSearchEmail={async (email) => {
                const id = await findCustomerIdByEmail(email)
                if (id) setOpenCustomerId(id)
                return Boolean(id)
              }}
              onToggleBlocked={async (customer) => {
                setIsSaving(true)
                try {
                  await adminApi.blockCustomer(customer.id, !customer.blocked)
                  setCustomers((current) => current.map((item) => (
                    item.id === customer.id ? { ...item, blocked: !customer.blocked } : item
                  )))
                } catch (err) {
                  setOpsError(err instanceof Error ? err.message : 'No se pudo cambiar el bloqueo.')
                } finally {
                  setIsSaving(false)
                }
              }}
            />
          ) : null}

          {currentView === 'game' ? (
            <AdminTabs
              label="Juego"
              intro="Todo el juego vive en la base de datos. Los cambios llegan a la web y al servidor en unos minutos, sin publicar nada."
              tabs={[
                {
                  id: 'missions',
                  label: 'Misiones',
                  render: () => (
                    <AdminPlayBoard
                      missions={missions}
                      customers={topPlayers}
                      isLoading={opsLoading}
                      isSaving={isSaving}
                      error={opsError}
                      onSaveMission={async (mission) => {
                        setIsSaving(true)
                        try {
                          await saveAdminMission(mission)
                          void adminApi.logChange('mission.save', mission.id, { name: mission.name })
                          setMissions((current) => current.map((item) => (item.id === mission.id ? mission : item)))
                          setSuccess(`Misión «${mission.name}» guardada.`)
                        } finally {
                          setIsSaving(false)
                        }
                      }}
                    />
                  ),
                },
                { id: 'levels', label: 'Niveles y XP', render: () => <CatalogCustomerGame /> },
                { id: 'items', label: 'Objetos', render: () => <CatalogItems /> },
                { id: 'rewards', label: 'Recompensas', render: () => <CatalogRewards /> },
                { id: 'penalties', label: 'Penalizaciones', render: () => <CatalogPenalties /> },
                { id: 'companies', label: 'Juego de restaurantes', render: () => <CatalogCompanyGame /> },
              ]}
            />
          ) : null}

          {currentView === 'notify' ? <AdminBroadcastBoard companies={companies} /> : null}

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
                  void adminApi.logChange('review.delete', review.id, { name: review.companyName })
                  setReviews((current) => current.filter((item) => item.id !== review.id))
                } finally {
                  setIsSaving(false)
                }
              }}
            />
          ) : null}

          {currentView === 'security' ? (
            <div className={styles.stack}>
              <AdminIncidentsBoard events={events} locks={locks} isLoading={opsLoading} error={opsError} />
              <AdminAuditBoard />
            </div>
          ) : null}
        </main>
      </div>

      {navOpen ? <button type="button" className={styles.navScrim} aria-label="Cerrar menú" onClick={() => setNavOpen(false)} /> : null}

      {openCustomerId ? (
        <AdminCustomerDrawer
          customerId={openCustomerId}
          companyNames={companyNames}
          onClose={() => setOpenCustomerId(null)}
          onChanged={(patch) => setCustomers((current) => current.map((item) => (
            item.id === patch.id
              ? {
                  ...item,
                  ...(patch.blocked !== undefined ? { blocked: patch.blocked } : {}),
                  ...(patch.xp !== undefined ? { xp: patch.xp } : {}),
                  ...(patch.adelinas !== undefined ? { adelinas: patch.adelinas } : {}),
                }
              : item
          )))}
        />
      ) : null}

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
        title="Eliminar restaurante"
        message={
          companyToDelete
            ? `¿Eliminar «${companyToDelete.name}»? Se borran su acceso, mesas y reservas. Si solo quieres ocultarlo, usa «Desactivar local» en su ficha.`
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
