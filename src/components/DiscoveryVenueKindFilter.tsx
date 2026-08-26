import type { DiscoveryVenueKind } from '../data/companyProfileFacilities'
import styles from './DiscoveryVenueKindFilter.module.css'

interface DiscoveryVenueKindFilterProps {
  value: DiscoveryVenueKind | ''
  onChange: (value: DiscoveryVenueKind | '') => void
}

const OPTIONS: Array<{ id: DiscoveryVenueKind; label: string }> = [
  { id: 'bar', label: 'Bares' },
  { id: 'restaurant', label: 'Restaurantes' },
]

function DiscoveryVenueKindFilter({ value, onChange }: DiscoveryVenueKindFilterProps) {
  return (
    <div className={styles.row} role="group" aria-label="Filtrar por tipo de local">
      {OPTIONS.map((option) => {
        const selected = value === option.id

        return (
          <button
            key={option.id}
            type="button"
            className={selected ? styles.buttonActive : styles.button}
            aria-pressed={selected}
            onClick={() => onChange(selected ? '' : option.id)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default DiscoveryVenueKindFilter
