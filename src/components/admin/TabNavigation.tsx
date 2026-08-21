import styles from './TabNavigation.module.css'

export type AdminTab = 'overview' | 'finances' | 'companies' | 'reservations' | 'users' | 'reviews'

interface TabNavigationProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

const tabs: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Vista General', icon: '📊' },
  { id: 'finances', label: 'Finanzas', icon: '💰' },
  { id: 'companies', label: 'Empresas', icon: '🏢' },
  { id: 'reservations', label: 'Reservas', icon: '📅' },
  { id: 'users', label: 'Usuarios', icon: '👥' },
  { id: 'reviews', label: 'Reviews', icon: '⭐' },
]

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className={styles.navigation}>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
            type="button"
          >
            <span className={styles.icon}>{tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
