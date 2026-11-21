import { Suspense, lazy, useRef, useState, useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Armchair,
  Bell,
  BookOpen,
  CalendarDays,
  ChartColumn,
  Clock,
  Contact,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MailCheck,
  Medal,
  MessageSquareText,
  ShoppingBasket,
  Smartphone,
  Star,
  Store,
  Tag,
  Trophy,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/auth'
import {
  CLIENTS_SECTIONS,
  COMPITE_SECTIONS,
  isClientsTab,
  isCompiteTab,
  isReportsTab,
  isSettingsTab,
  isSettingsEditorTab,
  REPORTS_SECTIONS,
  SETTINGS_SECTIONS,
  type CompanyTab,
  type CompanySettingsSection,
} from '../types'
import type { CompanySettingsHandle } from './company/CompanySettings'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import CompanyNotificationsBell from '../components/CompanyNotificationsBell'
import { LockedControl, PlanLockedPanel } from '../components/PlanLockHint'
import LegalLinks from '../components/LegalLinks'
import { parseCompanyPlanId } from '../data/companyPlans'
import { companyAcceptsReservations } from '../data/companyReservationMode'
import {
  lockedCapabilityForTab,
  lockedTabFeatureLabel,
  planAllowsCompite,
} from '../data/companyPlanLimits'
import { syncCompanyGamification } from '../services/companyGamification'
import styles from './CompanyDashboard.module.css'

const CompanyHome = lazy(() => import('./company/CompanyHome'))
const CompanyReservations = lazy(() => import('./company/CompanyReservations'))
const CompanyClients = lazy(() => import('./company/CompanyClients'))
const CompanyReportsReservations = lazy(() => import('./company/CompanyReportsReservations'))
const CompanyReportsClients = lazy(() => import('./company/CompanyReportsClients'))
const CompanyReportsProducts = lazy(() => import('./company/CompanyReportsProducts'))
const CompanyReportsReviews = lazy(() => import('./company/CompanyReportsReviews'))
const CompanyReportsApp = lazy(() => import('./company/CompanyReportsApp'))
const CompanyCompiteNotifications = lazy(() => import('./company/CompanyCompiteNotifications'))
const CompiteArena = lazy(() => import('./company/arena/CompiteArena'))
const CompanyPromotions = lazy(() => import('./company/CompanyPromotions'))
const CompanyReviews = lazy(() => import('./company/CompanyReviews'))
const CompanyEmailTemplate = lazy(() => import('./company/CompanyEmailTemplate'))
const CompanyHelp = lazy(() => import('./company/CompanyHelp'))
const CompanyMenu = lazy(() => import('./company/CompanyMenu'))
const CompanySettings = lazy(() => import('./company/CompanySettings'))
const CompanyPlan = lazy(() => import('./company/CompanyPlan'))

function settingsSectionLabel(tab: CompanyTab): string {
  if (tab === 'home') {
    return 'Inicio'
  }

  if (tab === 'reservations') {
    return 'Reservas'
  }

  if (isClientsTab(tab)) {
    return CLIENTS_SECTIONS.find((section) => section.id === tab)?.label ?? 'Clientes'
  }

  if (isCompiteTab(tab)) {
    return COMPITE_SECTIONS.find((section) => section.id === tab)?.label ?? 'Compite'
  }

  if (isReportsTab(tab)) {
    return REPORTS_SECTIONS.find((section) => section.id === tab)?.label ?? 'Informes'
  }

  if (tab === 'help') {
    return 'Ayuda'
  }

  return SETTINGS_SECTIONS.find((section) => section.id === tab)?.label ?? 'Mi restaurante'
}

/** Grupo del menú al que pertenece la sección (se muestra encima del título). */
function groupLabelForTab(tab: CompanyTab): string {
  if (tab === 'home' || tab === 'reservations') return 'Operación'
  if (isClientsTab(tab)) return 'Clientes'
  if (isReportsTab(tab)) return 'Informes'
  if (isCompiteTab(tab)) return 'Compite'
  if (tab === 'help') return 'Soporte'
  return 'Mi restaurante'
}

const KNOWN_TABS = new Set<string>([
  'home',
  'reservations',
  'help',
  'reservation-settings',
  'plan',
  ...CLIENTS_SECTIONS.map((section) => section.id),
  ...COMPITE_SECTIONS.map((section) => section.id),
  ...REPORTS_SECTIONS.map((section) => section.id),
  ...SETTINGS_SECTIONS.map((section) => section.id),
])

/* Icono de cada sección del menú (también en Favoritos). */
const TAB_ICONS: Partial<Record<CompanyTab, LucideIcon>> = {
  home: LayoutDashboard,
  reservations: CalendarDays,
  'clients-reservations': Users,
  'clients-promotions': Tag,
  'clients-reviews': MessageSquareText,
  'clients-email-received': Inbox,
  'clients-email-confirmation': MailCheck,
  'reports-reservations': ChartColumn,
  'reports-clients': UsersRound,
  'reports-products': ShoppingBasket,
  'reports-reviews': Star,
  'reports-app': Smartphone,
  contact: Contact,
  profile: Store,
  'reservation-settings': Clock,
  tables: Armchair,
  menu: BookOpen,
  plan: CreditCard,
  'compite-notifications': Bell,
  'compite-missions': Trophy,
  'compite-ranking': Medal,
  help: LifeBuoy,
}

function NavIcon({ tab }: { tab: CompanyTab }) {
  const Icon = TAB_ICONS[tab]
  return Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden="true" className={styles.navIcon} /> : null
}

/* Favoritos del menú: se guardan en este navegador, uno por local. */
const MAX_FAVORITES = 8

function favoritesStorageKey(companyId: string, demo: boolean): string {
  return `adelia.panel.favoritos.${demo ? 'demo' : companyId}`
}

function readFavorites(key: string): CompanyTab[] {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((tab): tab is CompanyTab => typeof tab === 'string' && KNOWN_TABS.has(tab)).slice(0, MAX_FAVORITES)
      : []
  } catch {
    return []
  }
}

function writeFavorites(key: string, favorites: CompanyTab[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(favorites))
  } catch {
    // Sin almacenamiento (modo privado): los favoritos duran hasta recargar.
  }
}

type SidebarGroupId = 'clients' | 'reports' | 'settings' | 'compite'

function sidebarGroupForTab(tab: CompanyTab): SidebarGroupId | null {
  if (isClientsTab(tab)) return 'clients'
  if (isReportsTab(tab)) return 'reports'
  if (isSettingsTab(tab)) return 'settings'
  if (isCompiteTab(tab)) return 'compite'
  return null
}

const CLOSED_GROUPS: Record<SidebarGroupId, boolean> = {
  clients: false,
  reports: false,
  settings: false,
  compite: false,
}

interface SidebarNavGroupProps {
  label: string
  hint: string
  open: boolean
  active: boolean
  onToggle: () => void
  children: ReactNode
}

function SidebarNavGroup({ label, hint, open, active, onToggle, children }: SidebarNavGroupProps) {
  return (
    <div className={styles.navGroup}>
      <button
        type="button"
        className={`${styles.navGroupToggle} ${active ? styles.navGroupTitleActive : ''}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={styles.navLabel}>{label}</span>
        <span className={styles.navHint}>{hint}</span>
      </button>
      <div
        className={`${styles.navSubmenuWrap} ${open ? styles.navSubmenuWrapOpen : ''}`}
        inert={!open ? true : undefined}
      >
        <div className={styles.navSubmenuInner}>
          <div className={styles.navSubmenu}>{children}</div>
        </div>
      </div>
    </div>
  )
}

function CompanyDashboard({ demo = false }: { demo?: boolean }) {
  const { company } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<CompanyTab>('home')
  const [lastSettingsSection, setLastSettingsSection] = useState<CompanySettingsSection>('contact')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [pendingTab, setPendingTab] = useState<CompanyTab | null>(null)
  const [unsavedSection, setUnsavedSection] = useState<CompanySettingsSection | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)
  const [isSavingUnsaved, setIsSavingUnsaved] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<SidebarGroupId, boolean>>(CLOSED_GROUPS)
  const [reservationCreateSignal, setReservationCreateSignal] = useState(0)
  const settingsRef = useRef<CompanySettingsHandle>(null)
  const favoritesKey = company?.id ? favoritesStorageKey(company.id, demo) : null
  const [favorites, setFavorites] = useState<CompanyTab[]>([])

  useEffect(() => {
    setFavorites(favoritesKey ? readFavorites(favoritesKey) : [])
  }, [favoritesKey])

  const toggleFavorite = (tab: CompanyTab) => {
    setFavorites((current) => {
      const next = current.includes(tab)
        ? current.filter((item) => item !== tab)
        : [...current, tab].slice(-MAX_FAVORITES)
      if (favoritesKey) {
        writeFavorites(favoritesKey, next)
      }
      return next
    })
  }

  useEffect(() => {
    if (demo || !company?.id || !isCompiteTab(activeTab)) {
      return
    }
    void syncCompanyGamification().catch(() => undefined)
  }, [activeTab, company?.id, demo])

  useEffect(() => {
    if (demo) {
      return
    }
    const tab = searchParams.get('tab')

    if (tab && KNOWN_TABS.has(tab)) {
      const nextTab = tab as CompanyTab
      setActiveTab(nextTab)
      // En móvil, «Ver planes» desde un candado del menú lateral: cerrar el menú para ver la página.
      setSidebarOpen(false)
      if (isSettingsEditorTab(nextTab)) {
        setLastSettingsSection(nextTab)
      }
      if (isCompiteTab(nextTab) || isClientsTab(nextTab) || isReportsTab(nextTab) || isSettingsTab(nextTab)) {
        const group = sidebarGroupForTab(nextTab)
        if (group) {
          setOpenGroups((current) => ({ ...current, [group]: true }))
        }
      }
    }

    if (searchParams.get('stripe')) {
      const next = new URLSearchParams(searchParams)
      next.delete('stripe')
      setSearchParams(next, { replace: true })
    }
  }, [demo, searchParams, setSearchParams])

  const handleLogout = async () => {
    await logout()
  }

  const completeNavigation = (tab: CompanyTab) => {
    if (isSettingsEditorTab(tab)) {
      setLastSettingsSection(tab)
    }

    setActiveTab(tab)
    const group = sidebarGroupForTab(tab)
    if (group) {
      setOpenGroups((current) => ({ ...current, [group]: true }))
    }
    setSidebarOpen(false)
    setPendingTab(null)
    setUnsavedSection(null)
    setUnsavedDialogOpen(false)
    setIsSavingUnsaved(false)
  }

  const attemptNavigate = (tab: CompanyTab) => {
    if (tab === activeTab) {
      setSidebarOpen(false)
      return
    }

    if (!demo && isSettingsEditorTab(activeTab) && settingsRef.current?.isSectionDirty(activeTab)) {
      setPendingTab(tab)
      setUnsavedSection(activeTab)
      setUnsavedDialogOpen(true)
      return
    }

    completeNavigation(tab)
  }

  const toggleGroup = (group: SidebarGroupId) => {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }))
  }

  const handleStayEditing = () => {
    setPendingTab(null)
    setUnsavedSection(null)
    setUnsavedDialogOpen(false)
    setIsSavingUnsaved(false)
  }

  const handleDiscardChanges = () => {
    if (unsavedSection) {
      settingsRef.current?.discardSection(unsavedSection)
    }

    if (pendingTab) {
      completeNavigation(pendingTab)
    }
  }

  const handleSaveUnsavedChanges = async () => {
    if (!unsavedSection || !pendingTab) {
      return
    }

    setIsSavingUnsaved(true)

    const saved = await settingsRef.current?.saveSection(unsavedSection)

    if (!saved) {
      setIsSavingUnsaved(false)
      return
    }

    completeNavigation(pendingTab)
  }

  if (!company) {
    return (
      <div className={styles.pageLoading}>
        <p>Cargando datos de la empresa…</p>
      </div>
    )
  }

  const logoSrc = company.logoUrl
    ? optimizeCloudinaryUrl(company.logoUrl, CLOUDINARY_DISPLAY.logo)
    : ADELIA_LOGO_URL
  const planId = parseCompanyPlanId(company.planId)
  const goToPlan = () => attemptNavigate('plan')
  const inMenu = activeTab === 'menu'
  const inPlan = activeTab === 'plan'
  const inSettingsEditor = isSettingsEditorTab(activeTab)
  const inClients = isClientsTab(activeTab)
  const inCompite = isCompiteTab(activeTab)
  const inReports = isReportsTab(activeTab)
  const settingsSection = inSettingsEditor ? activeTab : lastSettingsSection
  const unsavedSectionLabel =
    SETTINGS_SECTIONS.find((section) => section.id === unsavedSection)?.label ?? 'Ajustes'
  const lockedTabCap = lockedCapabilityForTab(activeTab, planId)
  const compiteLocked = !planAllowsCompite(planId)

  const renderFavStar = (tab: CompanyTab, variant: 'nav' | 'top' = 'nav') => {
    const isFavorite = favorites.includes(tab)
    const label = settingsSectionLabel(tab)
    const action = isFavorite ? `Quitar «${label}» de favoritos` : `Añadir «${label}» a favoritos`
    return (
      <button
        type="button"
        className={`${variant === 'top' ? styles.favStarTop : styles.favStar} ${isFavorite ? styles.favStarOn : ''}`}
        aria-pressed={isFavorite}
        aria-label={action}
        title={action}
        onClick={(event) => {
          event.stopPropagation()
          toggleFavorite(tab)
        }}
      >
        <Star size={variant === 'top' ? 16 : 14} aria-hidden="true" />
      </button>
    )
  }

  /** Fila del menú: la opción y, a su derecha, la estrella de favoritos. */
  const navRow = (tab: CompanyTab, content: ReactNode, key: string = tab) => (
    <div key={key} className={styles.navRow}>
      {content}
      {renderFavStar(tab)}
    </div>
  )

  const renderSubNav = (section: { id: CompanyTab; label: string; hint: string }) => {
    const lockCap = lockedCapabilityForTab(section.id, planId)
    const button = (
      <button
        key={section.id}
        type="button"
        className={`${styles.navSubItem} ${activeTab === section.id ? styles.navSubItemActive : ''}`}
        onClick={() => attemptNavigate(section.id)}
      >
        <NavIcon tab={section.id} />
        <span className={styles.navSubLabel}>{section.label}</span>
        <span className={styles.navHint}>{section.hint}</span>
      </button>
    )

    if (!lockCap) {
      return navRow(section.id, button)
    }

    return (
      <LockedControl
        key={section.id}
        locked
        variant="nav"
        feature={lockedTabFeatureLabel(section.id)}
        capabilityId={lockCap}
        onUpgrade={goToPlan}
      >
        {button}
      </LockedControl>
    )
  }

  const renderCompiteBell = () =>
    compiteLocked ? (
      <LockedControl
        locked
        feature="Compite"
        capabilityId="compite"
        onUpgrade={goToPlan}
      >
        <span>
          <span style={{ pointerEvents: 'none' }}>
            <CompanyNotificationsBell onOpen={() => undefined} />
          </span>
        </span>
      </LockedControl>
    ) : (
      <CompanyNotificationsBell onOpen={() => attemptNavigate('compite-notifications')} />
    )

  return (
    <div className={`${styles.page} ${demo ? styles.pageDemo : ''}`}>
      {demo ? (
        <p className={styles.demoRibbon}>Vista de ejemplo · puedes navegar, no se guarda nada</p>
      ) : null}
      {sidebarOpen && (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarBrand}>
          <img src={logoSrc} alt={company.name} className={styles.sidebarLogo} />
          <div className={styles.sidebarBrandText}>
            <h1>{company.name}</h1>
            <p>{company.location || 'Sin dirección'}</p>
          </div>
          <button
            type="button"
            className={styles.sidebarClose}
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className={styles.nav} aria-label="Panel principal">
          <div className={styles.favorites} aria-label="Favoritos">
            <p className={styles.favoritesTitle}>
              <Star size={12} aria-hidden="true" />
              Favoritos
            </p>
            {favorites.length === 0 ? (
              <p className={styles.favoritesEmpty}>
                Pulsa la estrella de una sección para tenerla siempre aquí.
              </p>
            ) : (
              favorites.map((tab) => navRow(
                tab,
                <button
                  type="button"
                  className={`${styles.navItem} ${activeTab === tab ? styles.navItemActive : ''}`}
                  onClick={() => attemptNavigate(tab)}
                >
                  <NavIcon tab={tab} />
                  <span className={styles.navLabel}>{settingsSectionLabel(tab)}</span>
                  <span className={styles.favoriteGroup}>{groupLabelForTab(tab)}</span>
                </button>,
                `fav-${tab}`,
              ))
            )}
          </div>

          {navRow('home', (
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === 'home' ? styles.navItemActive : ''}`}
              onClick={() => attemptNavigate('home')}
            >
              <NavIcon tab="home" />
              <span className={styles.navLabel}>Inicio</span>
              <span className={styles.navHint}>Resumen del día</span>
            </button>
          ))}

          {navRow('reservations', (
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === 'reservations' ? styles.navItemActive : ''}`}
              onClick={() => attemptNavigate('reservations')}
            >
              <NavIcon tab="reservations" />
              <span className={styles.navLabel}>Reservas</span>
              <span className={styles.navHint}>Calendario y listado del día</span>
            </button>
          ))}

          <SidebarNavGroup
            label="Clientes"
            hint="Reservas, promos y reseñas"
            open={openGroups.clients}
            active={inClients}
            onToggle={() => toggleGroup('clients')}
          >
            {CLIENTS_SECTIONS.map((section) => renderSubNav(section))}
          </SidebarNavGroup>

          <SidebarNavGroup
            label="Informes"
            hint="Reservas, clientes, productos y reseñas"
            open={openGroups.reports}
            active={inReports}
            onToggle={() => toggleGroup('reports')}
          >
            {REPORTS_SECTIONS.map((section) => renderSubNav(section))}
          </SidebarNavGroup>

          <SidebarNavGroup
            label="Mi restaurante"
            hint="Perfil, mesas, carta y plan"
            open={openGroups.settings}
            active={inSettingsEditor || inMenu || inPlan}
            onToggle={() => toggleGroup('settings')}
          >
            {SETTINGS_SECTIONS.map((section) => navRow(section.id, (
              <button
                type="button"
                className={`${styles.navSubItem} ${
                  activeTab === section.id ? styles.navSubItemActive : ''
                }`}
                onClick={() => attemptNavigate(section.id)}
              >
                <NavIcon tab={section.id} />
                <span className={styles.navSubLabel}>{section.label}</span>
                <span className={styles.navHint}>{section.hint}</span>
              </button>
            )))}
          </SidebarNavGroup>

          <SidebarNavGroup
            label="Compite"
            hint="Misiones, ranking y avisos"
            open={openGroups.compite}
            active={inCompite}
            onToggle={() => toggleGroup('compite')}
          >
            {COMPITE_SECTIONS.map((section) => renderSubNav(section))}
          </SidebarNavGroup>

          {navRow('help', (
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === 'help' ? styles.navItemActive : ''}`}
              onClick={() => attemptNavigate('help')}
            >
              <NavIcon tab="help" />
              <span className={styles.navLabel}>Ayuda</span>
              <span className={styles.navHint}>Tutoriales y preguntas frecuentes</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <LegalLinks variant="sidebar" from={demo ? '/empresa/planes' : '/panel'} />
          <div className={styles.meta}>
            <span>{company.phone || '—'}</span>
            <span>{company.contactEmail || company.website || '—'}</span>
          </div>
          {demo ? null : (
            <button type="button" className={styles.logoutButton} onClick={() => setLogoutConfirmOpen(true)}>
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      <div className={styles.contentArea}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <span className={styles.menuButtonBar} aria-hidden="true" />
            <span className={styles.menuButtonBar} aria-hidden="true" />
            <span className={styles.menuButtonBar} aria-hidden="true" />
          </button>
          <div className={styles.topBarTitle}>
            <span className={styles.topBarGroup}>{groupLabelForTab(activeTab)}</span>
            <strong>{settingsSectionLabel(activeTab)}</strong>
          </div>
          {renderFavStar(activeTab, 'top')}
          <div className={styles.topBarActions}>
            {renderCompiteBell()}
            {demo || activeTab === 'reservations' || !companyAcceptsReservations(company.reservationMode) ? null : (
              <button
                type="button"
                className={styles.topBarPrimary}
                onClick={() => {
                  attemptNavigate('reservations')
                  setReservationCreateSignal((value) => value + 1)
                }}
              >
                <span aria-hidden="true">+</span>
                <span className={styles.topBarPrimaryLabel}>Nueva reserva</span>
              </button>
            )}
          </div>
        </header>

        <main
          className={`${styles.main} ${demo ? styles.demoReadOnly : ''} ${
            !lockedTabCap && (activeTab === 'compite-ranking' || activeTab === 'compite-missions') ? styles.mainArena : ''
          }`}
        >
          {company.deactivated ? (
            <div className={styles.deactivatedBanner} role="status">
              <div className={styles.deactivatedBannerText}>
                <strong>Tu restaurante está desactivado</strong>
                <span>
                  {company.deactivatedByAdmin
                    ? 'Lo ha desactivado Adelia. Escríbenos a soporte para volver a activarlo.'
                    : 'Los clientes no pueden encontrarte, ver tu carta ni reservar.'}
                </span>
              </div>
              {company.deactivatedByAdmin ? null : (
                <button
                  type="button"
                  className={styles.deactivatedBannerButton}
                  onClick={() => attemptNavigate('profile')}
                >
                  Reactivar
                </button>
              )}
            </div>
          ) : null}
          <Suspense
            fallback={
              <div className={styles.pageLoading}>
                <p>Cargando…</p>
              </div>
            }
          >
            {lockedTabCap ? (
              <PlanLockedPanel
                feature={lockedTabFeatureLabel(activeTab)}
                capabilityId={lockedTabCap}
                onUpgrade={goToPlan}
              />
            ) : (
              <>
                {activeTab === 'home' ? <CompanyHome companyId={company.id} onOpenTab={attemptNavigate} /> : null}
                {activeTab === 'reservations' ? (
                  <CompanyReservations companyId={company.id} createSignal={reservationCreateSignal} />
                ) : null}
                {activeTab === 'clients-reservations' ? <CompanyClients companyId={company.id} /> : null}
                {activeTab === 'clients-promotions' ? <CompanyPromotions companyId={company.id} /> : null}
                {activeTab === 'clients-reviews' ? <CompanyReviews companyId={company.id} /> : null}
                {activeTab === 'clients-email-received' ? <CompanyEmailTemplate kind="received" /> : null}
                {activeTab === 'clients-email-confirmation' ? <CompanyEmailTemplate kind="confirmation" /> : null}
                {activeTab === 'reports-reservations' ? <CompanyReportsReservations companyId={company.id} /> : null}
                {activeTab === 'reports-clients' ? <CompanyReportsClients companyId={company.id} /> : null}
                {activeTab === 'reports-products' ? <CompanyReportsProducts companyId={company.id} /> : null}
                {activeTab === 'reports-reviews' ? <CompanyReportsReviews companyId={company.id} /> : null}
                {activeTab === 'reports-app' ? <CompanyReportsApp companyId={company.id} /> : null}
                {activeTab === 'compite-notifications' ? (
                  <CompanyCompiteNotifications onOpenTab={attemptNavigate} />
                ) : null}
                {activeTab === 'compite-ranking' || activeTab === 'compite-missions' ? (
                  <CompiteArena
                    initialView={activeTab === 'compite-missions' ? 'challenges' : 'arena'}
                    onOpenTab={attemptNavigate}
                  />
                ) : null}
                {activeTab === 'help' ? <CompanyHelp /> : null}
                {inMenu ? <CompanyMenu companyId={company.id} /> : null}
                {inPlan ? <CompanyPlan /> : null}
                {inSettingsEditor ? (
                  <CompanySettings ref={settingsRef} activeSection={settingsSection} />
                ) : null}
              </>
            )}
          </Suspense>
        </main>
      </div>

      <UnsavedChangesDialog
        isOpen={unsavedDialogOpen}
        sectionLabel={unsavedSectionLabel}
        isSaving={isSavingUnsaved}
        onStay={handleStayEditing}
        onDiscard={handleDiscardChanges}
        onSave={() => void handleSaveUnsavedChanges()}
      />

      {demo ? null : (
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Cerrar sesión"
        message="¿Estás seguro de que quieres cerrar sesión?"
        confirmLabel="Cerrar sesión"
        onConfirm={() => void handleLogout()}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
      )}
    </div>
  )
}

export default CompanyDashboard
