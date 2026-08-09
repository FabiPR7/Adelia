import CityAutocomplete from './CityAutocomplete'
import DiscoveryTraitsFilter from './DiscoveryTraitsFilter'
import type { CitySuggestion } from '../services/citySearch'
import styles from './DiscoverySearchBar.module.css'

interface DiscoverySearchBarProps {
  searchDraft: string
  onSearchDraftChange: (value: string) => void
  selectedCity: CitySuggestion | null
  onSelectedCityChange: (city: CitySuggestion | null) => void
  activeTrait: string
  onTraitChange: (trait: string) => void
  traitOptions: string[]
  onSearch: () => void
  nearbyActive: boolean
  nearbyState: 'idle' | 'locating' | 'geocoding' | 'ready' | 'error'
  nearbyMessage: string | null
  onUseLocation: () => void
}

function DiscoverySearchBar({
  searchDraft,
  onSearchDraftChange,
  selectedCity,
  onSelectedCityChange,
  activeTrait,
  onTraitChange,
  traitOptions,
  onSearch,
  nearbyActive,
  nearbyState,
  nearbyMessage,
  onUseLocation,
}: DiscoverySearchBarProps) {
  const locationButtonClassName = nearbyActive ? styles.locationActive : styles.locationButton
  const locationButtonLabel =
    nearbyState === 'locating' ? 'Ubicando…' : nearbyActive ? '📍 Cerca ✓' : '📍 Cerca'

  return (
    <section className={styles.searchSection}>
      <div className={styles.searchRow}>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Nombre del restaurante</span>
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onSearch()
              }
            }}
            placeholder="Nombre…"
            className={styles.searchInput}
          />
        </label>

        <CityAutocomplete
          value={selectedCity}
          onChange={onSelectedCityChange}
          placeholder="Ciudad"
          label="Ciudad"
          compact
        />

        <div className={styles.searchActions}>
          <button type="button" className={styles.searchButton} onClick={onSearch}>
            Buscar
          </button>

          <div className={styles.filterSlot}>
            <DiscoveryTraitsFilter
              options={traitOptions}
              value={activeTrait}
              onChange={onTraitChange}
            />
          </div>

          <button
            type="button"
            className={locationButtonClassName}
            onClick={onUseLocation}
            disabled={nearbyState === 'locating'}
          >
            {locationButtonLabel}
          </button>
        </div>
      </div>

      {nearbyMessage && (
        <p
          className={nearbyState === 'error' ? styles.locationMessageError : styles.locationMessage}
          role="status"
        >
          {nearbyMessage}
        </p>
      )}
    </section>
  )
}

export default DiscoverySearchBar
