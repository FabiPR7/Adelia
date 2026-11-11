import { useState, type ReactNode } from 'react'
import styles from './AdminCatalog.module.css'

export interface AdminTab {
  id: string
  label: string
  render: () => ReactNode
}

/** Pestañas sencillas para agrupar varias pantallas dentro de una sección. */
function AdminTabs({ tabs, label, intro }: { tabs: AdminTab[]; label: string; intro?: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]

  return (
    <div className={styles.wrap}>
      {intro ? <p className={styles.intro}>{intro}</p> : null}
      <div className={styles.tabs} role="tablist" aria-label={label}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={current?.id === tab.id}
            className={`${styles.tab} ${current?.id === tab.id ? styles.tabOn : ''}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current?.render()}
    </div>
  )
}

export default AdminTabs
