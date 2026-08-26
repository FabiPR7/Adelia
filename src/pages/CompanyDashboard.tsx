import { Suspense, lazy, useRef, useState, useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import LegalLinks from '../components/LegalLinks'
import { syncCompanyGamification } from '../services/companyGamification'
import styles from './CompanyDashboard.module.css'

const CompanyReservations = lazy(() => import('./company/CompanyReservations'))
const CompanyClients = lazy(() => import('./company/CompanyClients'))
const CompanyReportsReservations = lazy(() => import('./company/CompanyReportsReservations'))
const CompanyReportsClients = lazy(() => import('./company/CompanyReportsClients'))
const CompanyReportsProducts = lazy(() => import('./company/CompanyReportsProducts'))
const CompanyReportsReviews = lazy(() => import('./company/CompanyReportsReviews'))
const CompanyCompiteNotifications = lazy(() => import('./company/CompanyCompiteNotifications'))
const CompanyCompiteMissions = lazy(() => import('./company/CompanyCompiteMissions'))
const CompanyCompiteRanking = lazy(() => import('./company/CompanyCompiteRanking'))
const CompanyPromotions = lazy(() => import('./company/CompanyPromotions'))
const CompanyReviews = lazy(() => import('./company/CompanyReviews'))
const CompanyEmailTemplate = lazy(() => import('./company/CompanyEmailTemplate'))
const CompanyHelp = lazy(() => import('./company/CompanyHelp'))
const CompanyMenu = lazy(() => import('./company/CompanyMenu'))
const CompanySettings = lazy(() => import('./company/CompanySettings'))
const CompanyPlan = lazy(() => import('./company/CompanyPlan'))

function settingsSectionLabel(tab: CompanyTab): string {
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

function CompanyDashboard() {
  const { company } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<CompanyTab>('reservations')
  const [lastSettingsSection, setLastSettingsSection] = useState<CompanySettingsSection>('contact')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [pendingTab, setPendingTab] = useState<CompanyTab | null>(null)
  const [unsavedSection, setUnsavedSection] = useState<CompanySettingsSection | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)
  const [isSavingUnsaved, setIsSavingUnsaved] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<SidebarGroupId, boolean>>(CLOSED_GROUPS)
  const settingsRef = useRef<CompanySettingsHandle>(null)

  useEffect(() => {
    if (!company?.id || !isCompiteTab(activeTab)) {
      return
    }
    void syncCompanyGamification().catch(() => undefined)
  }, [activeTab, company?.id])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const knownTabs = new Set<string>([
      'reservation-settings',
      'plan',
      ...CLIENTS_SECTIONS.map((section) => section.id),
      ...COMPITE_SECTIONS.map((section) => section.id),
      ...REPORTS_SECTIONS.map((section) => section.id),
      ...SETTINGS_SECTIONS.map((section) => section.id),
    ])

    if (tab && knownTabs.has(tab)) {
      const nextTab = tab as CompanyTab
      setActiveTab(nextTab)
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
  }, [searchParams, setSearchParams])

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

    if (isSettingsEditorTab(activeTab) && settingsRef.current?.isSectionDirty(activeTab)) {
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
  const inMenu = activeTab === 'menu'
  const inPlan = activeTab === 'plan'
  const inSettingsEditor = isSettingsEditorTab(activeTab)
  const inClients = isClientsTab(activeTab)
  const inCompite = isCompiteTab(activeTab)
  const inReports = isReportsTab(activeTab)
  const settingsSection = inSettingsEditor ? activeTab : lastSettingsSection
  const unsavedSectionLabel =
    SETTINGS_SECTIONS.find((section) => section.id === unsavedSection)?.label ?? 'Ajustes'

  return (
    <div className={styles.page}>
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
          <CompanyNotificationsBell onOpen={() => attemptNavigate('compite-notifications')} />
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
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'reservations' ? styles.navItemActive : ''}`}
            onClick={() => attemptNavigate('reservations')}
          >
            <span className={styles.navLabel}>Reservas</span>
            <span className={styles.navHint}>Calendario y listado del día</span>
          </button>

          <SidebarNavGroup
            label="Clientes"
            hint="Reservas, promos y reseñas"
            open={openGroups.clients}
            active={inClients}
            onToggle={() => toggleGroup('clients')}
          >
            {CLIENTS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`${styles.navSubItem} ${
                  activeTab === section.id ? styles.navSubItemActive : ''
                }`}
                onClick={() => attemptNavigate(section.id)}
              >
                <span className={styles.navSubLabel}>{section.label}</span>
                <span className={styles.navHint}>{section.hint}</span>
              </button>
            ))}
          </SidebarNavGroup>

          <SidebarNavGroup
            label="Informes"
            hint="Reservas, clientes, productos y reseñas"
            open={openGroups.reports}
            active={inReports}
            onToggle={() => toggleGroup('reports')}
          >
            {REPORTS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`${styles.navSubItem} ${
                  activeTab === section.id ? styles.navSubItemActive : ''
                }`}
                onClick={() => attemptNavigate(section.id)}
              >
                <span className={styles.navSubLabel}>{section.label}</span>
                <span className={styles.navHint}>{section.hint}</span>
              </button>
            ))}
          </SidebarNavGroup>

          <SidebarNavGroup
            label="Mi restaurante"
            hint="Perfil, mesas, carta y plan"
            open={openGroups.settings}
            active={inSettingsEditor || inMenu || inPlan}
            onToggle={() => toggleGroup('settings')}
          >
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`${styles.navSubItem} ${
                  activeTab === section.id ? styles.navSubItemActive : ''
                }`}
                onClick={() => attemptNavigate(section.id)}
              >
                <span className={styles.navSubLabel}>{section.label}</span>
                <span className={styles.navHint}>{section.hint}</span>
              </button>
            ))}
          </SidebarNavGroup>

          <SidebarNavGroup
            label="Compite"
            hint="Misiones, ranking y avisos"
            open={openGroups.compite}
            active={inCompite}
            onToggle={() => toggleGroup('compite')}
          >
            {COMPITE_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`${styles.navSubItem} ${
                  activeTab === section.id ? styles.navSubItemActive : ''
                }`}
                onClick={() => attemptNavigate(section.id)}
              >
                <span className={styles.navSubLabel}>{section.label}</span>
                <span className={styles.navHint}>{section.hint}</span>
              </button>
            ))}
          </SidebarNavGroup>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'help' ? styles.navItemActive : ''}`}
            onClick={() => attemptNavigate('help')}
          >
            <span className={styles.navLabel}>Ayuda</span>
            <span className={styles.navHint}>Tutoriales y preguntas frecuentes</span>
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <LegalLinks variant="sidebar" from="/panel" />
          <div className={styles.meta}>
            <span>{company.phone || '—'}</span>
            <span>{company.contactEmail || company.website || '—'}</span>
          </div>
          <button type="button" className={styles.logoutButton} onClick={() => setLogoutConfirmOpen(true)}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className={styles.contentArea}>
        <header className={styles.mobileHeader}>
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
          <div className={styles.mobileBrand}>
            <img src={logoSrc} alt="" className={styles.mobileLogo} />
            <div>
              <strong>{company.name}</strong>
              <span>{settingsSectionLabel(activeTab)}</span>
            </div>
          </div>
          <CompanyNotificationsBell onOpen={() => attemptNavigate('compite-notifications')} />
        </header>

        <main className={styles.main}>
          <Suspense
            fallback={
              <div className={styles.pageLoading}>
                <p>Cargando…</p>
              </div>
            }
          >
            {activeTab === 'reservations' ? <CompanyReservations companyId={company.id} /> : null}
            {activeTab === 'clients-reservations' ? <CompanyClients companyId={company.id} /> : null}
            {activeTab === 'clients-promotions' ? <CompanyPromotions companyId={company.id} /> : null}
            {activeTab === 'clients-reviews' ? <CompanyReviews companyId={company.id} /> : null}
            {activeTab === 'clients-email-received' ? <CompanyEmailTemplate kind="received" /> : null}
            {activeTab === 'clients-email-confirmation' ? <CompanyEmailTemplate kind="confirmation" /> : null}
            {activeTab === 'reports-reservations' ? <CompanyReportsReservations companyId={company.id} /> : null}
            {activeTab === 'reports-clients' ? <CompanyReportsClients companyId={company.id} /> : null}
            {activeTab === 'reports-products' ? <CompanyReportsProducts companyId={company.id} /> : null}
            {activeTab === 'reports-reviews' ? <CompanyReportsReviews companyId={company.id} /> : null}
            {activeTab === 'compite-notifications' ? (
              <CompanyCompiteNotifications onOpenTab={attemptNavigate} />
            ) : null}
            {activeTab === 'compite-missions' ? <CompanyCompiteMissions /> : null}
            {activeTab === 'compite-ranking' ? <CompanyCompiteRanking /> : null}
            {activeTab === 'help' ? <CompanyHelp /> : null}
            {inMenu ? <CompanyMenu companyId={company.id} /> : null}
            {inPlan ? <CompanyPlan /> : null}
            {inSettingsEditor ? (
              <CompanySettings ref={settingsRef} activeSection={settingsSection} />
            ) : null}
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

      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Cerrar sesión"
        message="¿Estás seguro de que quieres cerrar sesión?"
        confirmLabel="Cerrar sesión"
        onConfirm={() => void handleLogout()}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  )
}

export default CompanyDashboard
