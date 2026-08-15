import { Suspense, lazy, useRef, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import UnsavedChangesDialog from '../components/UnsavedChangesDialog'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/auth'
import {
  CLIENTS_SECTIONS,
  isClientsTab,
  isReportsTab,
  isSettingsTab,
  REPORTS_SECTIONS,
  SETTINGS_SECTIONS,
  type CompanyTab,
  type CompanySettingsSection,
} from '../types'
import type { CompanySettingsHandle } from './company/CompanySettings'
import CompanyReservations from './company/CompanyReservations'
import CompanyClients from './company/CompanyClients'
import CompanyReportsReservations from './company/CompanyReportsReservations'
import CompanyReportsClients from './company/CompanyReportsClients'
import CompanyReportsProducts from './company/CompanyReportsProducts'
import CompanyPromotions from './company/CompanyPromotions'
import CompanyReviews from './company/CompanyReviews'
import CompanyEmailTemplate from './company/CompanyEmailTemplate'
import CompanyHelp from './company/CompanyHelp'
import CompanyMenu from './company/CompanyMenu'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './CompanyDashboard.module.css'

const CompanySettings = lazy(() => import('./company/CompanySettings'))

function settingsSectionLabel(tab: CompanyTab): string {
  if (tab === 'reservations') {
    return 'Reservas'
  }

  if (isClientsTab(tab)) {
    return CLIENTS_SECTIONS.find((section) => section.id === tab)?.label ?? 'Clientes'
  }

  if (isReportsTab(tab)) {
    return REPORTS_SECTIONS.find((section) => section.id === tab)?.label ?? 'Informes'
  }

  if (tab === 'help') {
    return 'Ayuda'
  }

  return SETTINGS_SECTIONS.find((section) => section.id === tab)?.label ?? 'Mi restaurante'
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
  const settingsRef = useRef<CompanySettingsHandle>(null)

  useEffect(() => {
    const tab = searchParams.get('tab')

    if (tab === 'reservation-settings') {
      setActiveTab('reservation-settings')
      setLastSettingsSection('reservation-settings')
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
    if (isSettingsTab(tab) && tab !== 'menu') {
      setLastSettingsSection(tab)
    }

    setActiveTab(tab)
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

    if (
      activeTab !== 'menu'
      && isSettingsTab(activeTab)
      && settingsRef.current?.isSectionDirty(activeTab)
    ) {
      setPendingTab(tab)
      setUnsavedSection(activeTab)
      setUnsavedDialogOpen(true)
      return
    }

    completeNavigation(tab)
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
  const inSettingsEditor = isSettingsTab(activeTab) && activeTab !== 'menu'
  const inClients = isClientsTab(activeTab)
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

          <div className={styles.navGroup}>
            <div className={`${styles.navGroupTitle} ${inClients ? styles.navGroupTitleActive : ''}`}>
              <span className={styles.navLabel}>Clientes</span>
            </div>

            <div className={styles.navSubmenu}>
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
            </div>
          </div>

          <div className={styles.navGroup}>
            <div className={`${styles.navGroupTitle} ${inReports ? styles.navGroupTitleActive : ''}`}>
              <span className={styles.navLabel}>Informes</span>
            </div>

            <div className={styles.navSubmenu}>
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
            </div>
          </div>

          <div className={styles.navGroup}>
            <div className={`${styles.navGroupTitle} ${inSettingsEditor || inMenu ? styles.navGroupTitleActive : ''}`}>
              <span className={styles.navLabel}>Mi restaurante</span>
            </div>

            <div className={styles.navSubmenu}>
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
            </div>
          </div>

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
        </header>

        <main className={styles.main}>
          <div className={activeTab === 'reservations' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyReservations companyId={company.id} />
          </div>
          <div className={activeTab === 'clients-reservations' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyClients companyId={company.id} />
          </div>
          <div className={activeTab === 'clients-promotions' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyPromotions companyId={company.id} />
          </div>
          <div className={activeTab === 'clients-reviews' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyReviews companyId={company.id} />
          </div>
          <div className={activeTab === 'clients-email-received' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyEmailTemplate kind="received" />
          </div>
          <div className={activeTab === 'clients-email-confirmation' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyEmailTemplate kind="confirmation" />
          </div>
          <div className={activeTab === 'reports-reservations' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyReportsReservations companyId={company.id} />
          </div>
          <div className={activeTab === 'reports-clients' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyReportsClients companyId={company.id} />
          </div>
          <div className={activeTab === 'reports-products' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyReportsProducts companyId={company.id} />
          </div>
          <div className={activeTab === 'help' ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyHelp />
          </div>
          <div className={inMenu ? styles.tabPanelActive : styles.tabPanelHidden}>
            <CompanyMenu companyId={company.id} />
          </div>
          <div className={inSettingsEditor ? styles.tabPanelActive : styles.tabPanelHidden}>
            <Suspense
              fallback={
                <div className={styles.pageLoading}>
                  <p>Cargando ajustes…</p>
                </div>
              }
            >
              <CompanySettings ref={settingsRef} activeSection={settingsSection} />
            </Suspense>
          </div>
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
