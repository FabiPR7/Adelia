import { useState } from 'react'
import styles from './AdminCatalog.module.css'
import CatalogBilling from './catalog/CatalogBilling'
import { CatalogCompanyGame, CatalogCustomerGame } from './catalog/CatalogGame'
import CatalogItems from './catalog/CatalogItems'
import CatalogPlans from './catalog/CatalogPlans'
import { CatalogPenalties, CatalogRewards } from './catalog/CatalogRewards'

type CatalogTab = 'plans' | 'items' | 'rewards' | 'penalties' | 'customers' | 'companies' | 'billing'

const TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'plans', label: 'Planes y precios' },
  { id: 'items', label: 'Ítems' },
  { id: 'rewards', label: 'Recompensas' },
  { id: 'penalties', label: 'Penalizaciones' },
  { id: 'customers', label: 'Niveles de comensales' },
  { id: 'companies', label: 'Gamificación de locales' },
  { id: 'billing', label: 'Cobro' },
]

/**
 * Todo lo que antes estaba escrito en el código y ahora vive en Firestore. Cada
 * pestaña edita un bloque, valida antes de guardar y avisa si hay cambios sin
 * guardar. Web, app y servidor leen estos mismos datos.
 */
function AdminCatalogBoard() {
  const [tab, setTab] = useState<CatalogTab>('plans')

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        Aquí se cambian los datos del negocio sin tocar código: precios, límites de cada plan, ítems,
        recompensas, penalizaciones y niveles. Los cambios llegan a la web y al servidor en menos de
        5 minutos. Las misiones de comensales se editan en Juego → Misiones.
      </p>

      <div className={styles.tabs} role="tablist" aria-label="Catálogo">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`${styles.tab} ${tab === entry.id ? styles.tabOn : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'plans' ? <CatalogPlans /> : null}
      {tab === 'items' ? <CatalogItems /> : null}
      {tab === 'rewards' ? <CatalogRewards /> : null}
      {tab === 'penalties' ? <CatalogPenalties /> : null}
      {tab === 'customers' ? <CatalogCustomerGame /> : null}
      {tab === 'companies' ? <CatalogCompanyGame /> : null}
      {tab === 'billing' ? <CatalogBilling /> : null}
    </div>
  )
}

export default AdminCatalogBoard
