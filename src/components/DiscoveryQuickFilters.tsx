import type { QuickFilterId } from '../utils/discoveryQuickFilters'
import styles from './DiscoveryQuickFilters.module.css'

export interface QuickFilterOption {
  id: QuickFilterId
  label: string
  /** Pista para la misión: se resalta para que se note que sirve a una misión. */
  highlight?: boolean
}

interface DiscoveryQuickFiltersProps {
  options: QuickFilterOption[]
  active: ReadonlySet<QuickFilterId>
  onToggle: (id: QuickFilterId) => void
}

function DiscoveryQuickFilters({ options, active, onToggle }: DiscoveryQuickFiltersProps) {
  return (
    <div className={styles.row} role="group" aria-label="Filtros rápidos">
      {options.map((option) => {
        const isOn = active.has(option.id)
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isOn}
            className={`${styles.chip} ${isOn ? styles.chipOn : ''} ${option.highlight ? styles.chipMission : ''}`}
            onClick={() => onToggle(option.id)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default DiscoveryQuickFilters
