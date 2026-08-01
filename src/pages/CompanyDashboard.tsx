import { Suspense, lazy, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/auth'
import {
  isSettingsTab,
  SETTINGS_SECTIONS,
  type CompanyTab,
  type SettingsSection,
} from '../types'
import CompanyReservations from './company/CompanyReservations'
import styles from './CompanyDashboard.module.css'

const CompanySettings = lazy(() => import('./company/CompanySettings'))

function settingsSectionLabel(tab: CompanyTab): string {
  if (tab === 'reservations') {
    return 'Reservas'
  }

  return SETTINGS_SECTIONS.find((section) => section.id === tab)?.label ?? 'Mi restaurante'
}

function CompanyDashboard() {
  const { company } = useAuth()
  const [activeTab, setActiveTab] = useState<CompanyTab>('reservations')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
  }

  const navigateTo = (tab: CompanyTab) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  const openSettingsSection = (section: SettingsSection) => {
    navigateTo(section)
  }

  if (!company) {
    return (
      <div className={styles.pageLoading}>
        <p>Cargando datos de la empresa…</p>
      </div>
    )
  }

  const logoSrc = company.logoUrl || '/adelia-logo.png'
  const inSettings = isSettingsTab(activeTab)

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
            onClick={() => navigateTo('reservations')}
          >
            <span className={styles.navLabel}>Reservas</span>
            <span className={styles.navHint}>Calendario y listado del día</span>
          </button>

          <div className={styles.navGroup}>
            <div className={`${styles.navGroupTitle} ${inSettings ? styles.navGroupTitleActive : ''}`}>
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
                  onClick={() => openSettingsSection(section.id)}
                >
                  <span className={styles.navSubLabel}>{section.label}</span>
                  <span className={styles.navHint}>{section.hint}</span>
                </button>
              ))}
            </div>
          </div>
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
          {activeTab !== 'reservations' && (
            <Suspense
              fallback={
                <div className={styles.pageLoading}>
                  <p>Cargando ajustes…</p>
                </div>
              }
            >
              <CompanySettings activeSection={activeTab} />
            </Suspense>
          )}
        </main>
      </div>

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
