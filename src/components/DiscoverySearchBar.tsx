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
  favoritesActive?: boolean
  onToggleFavorites?: () => void
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
  favoritesActive = false,
  onToggleFavorites,
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

          <button
            type="button"
            className={locationButtonClassName}
            onClick={onUseLocation}
            disabled={nearbyState === 'locating'}
          >
            {locationButtonLabel}
          </button>

          {onToggleFavorites ? (
            <button
              type="button"
              className={favoritesActive ? styles.favoritesActive : styles.favoritesButton}
              onClick={onToggleFavorites}
              aria-pressed={favoritesActive}
            >
              <svg className={styles.favoritesIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12.1 21.35 10.6 20C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.6 11.54z"
                />
              </svg>
              {favoritesActive ? 'Favoritos ✓' : 'Favoritos'}
            </button>
          ) : null}

          <div className={styles.filterSlot}>
            <DiscoveryTraitsFilter
              options={traitOptions}
              value={activeTrait}
              onChange={onTraitChange}
            />
          </div>
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
