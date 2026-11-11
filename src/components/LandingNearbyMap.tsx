import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LocateFixed, MapPin, Search, X } from 'lucide-react'
import { usePromotionCounts } from '../hooks/usePromotionCounts'
import { geocodePlace, suggestAddresses, type AddressSuggestion } from '../services/geocoding'
import { fetchPublicDiscoveryRestaurants, mergeDiscoveryRestaurants } from '../services/publicDiscovery'
import type { GeoCoordinates } from '../utils/geo'
import { restaurantHasMapPin, type PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { getLocationErrorMessage, requestUserLocation } from '../utils/requestUserLocation'
import NearbyRestaurantsMap from './NearbyRestaurantsMap'
import styles from './LandingNearbyMap.module.css'

type SearchStatus = 'idle' | 'searching' | 'locating'

/** Espera tras la última tecla antes de pedir sugerencias. */
const SUGGEST_DELAY_MS = 250
const SUGGESTIONS_ID = 'landing-zone-suggestions'

interface Origin {
  coords: GeoCoordinates
  source: 'gps' | 'zone'
  label: string
}

interface LandingNearbyMapProps {
  restaurants: PublicDiscoveryRestaurant[]
  onOpenRestaurant: (restaurant: PublicDiscoveryRestaurant) => void
}

function LandingNearbyMap({ restaurants, onOpenRestaurant }: LandingNearbyMapProps) {
  const [zoneDraft, setZoneDraft] = useState('')
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const skipNextSuggestRef = useRef(false)
  const promoCounts = usePromotionCounts()
  // Restaurantes de la zona elegida, pedidos al servidor: así salen los cercanos
  // aunque no estén entre los que trajo la portada.
  const [zoneRestaurants, setZoneRestaurants] = useState<PublicDiscoveryRestaurant[]>([])

  useEffect(() => {
    if (!origin) {
      setZoneRestaurants([])
      return
    }
    let cancelled = false
    void fetchPublicDiscoveryRestaurants({ near: { lat: origin.coords.lat, lng: origin.coords.lng } })
      .then((items) => {
        if (!cancelled) setZoneRestaurants(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [origin])

  const mapRestaurants = useMemo(
    () => mergeDiscoveryRestaurants(zoneRestaurants, restaurants),
    [zoneRestaurants, restaurants],
  )

  // Las sugerencias priorizan la zona donde están los restaurantes de Adelia.
  const restaurantsCenter = useMemo<GeoCoordinates | null>(() => {
    const pins = restaurants.filter(restaurantHasMapPin)
    if (pins.length === 0) {
      return null
    }

    return {
      lat: pins.reduce((sum, item) => sum + (item.latitude as number), 0) / pins.length,
      lng: pins.reduce((sum, item) => sum + (item.longitude as number), 0) / pins.length,
    }
  }, [restaurants])

  useEffect(() => {
    // Al elegir una sugerencia el texto cambia, pero no hay que volver a buscar.
    if (skipNextSuggestRef.current) {
      skipNextSuggestRef.current = false
      return
    }

    const query = zoneDraft.trim()
    if (query.length < 3) {
      setSuggestions([])
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void suggestAddresses(query, restaurantsCenter, controller.signal)
        .then((items) => {
          setSuggestions(items)
          setActiveIndex(-1)
          setSuggestionsOpen(true)
        })
        .catch(() => {
          // Cancelada por otra tecla o sin red: el botón Buscar sigue funcionando.
        })
    }, SUGGEST_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [zoneDraft, restaurantsCenter])

  const chooseSuggestion = (suggestion: AddressSuggestion) => {
    skipNextSuggestRef.current = true
    setZoneDraft(suggestion.title)
    setSuggestions([])
    setSuggestionsOpen(false)
    setActiveIndex(-1)
    setErrorMessage(null)
    setOrigin({ coords: { lat: suggestion.lat, lng: suggestion.lng }, source: 'zone', label: suggestion.title })
  }

  const handleZoneSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const zone = zoneDraft.trim()

    if (zone.length < 2) {
      setErrorMessage('Escribe un barrio, una calle o una ciudad.')
      return
    }

    // Si hay sugerencias, Buscar usa la marcada o, si no, la primera.
    const picked = suggestions[activeIndex] ?? suggestions[0]
    if (picked) {
      chooseSuggestion(picked)
      return
    }

    setStatus('searching')
    setErrorMessage(null)
    setSuggestionsOpen(false)

    void geocodePlace(zone)
      .then((coords) => {
        if (!coords) {
          setErrorMessage('No encontramos esa zona. Prueba añadiendo la ciudad.')
          return
        }
        setOrigin({ coords, source: 'zone', label: zone })
      })
      .catch(() => {
        setErrorMessage('No pudimos buscar esa zona. Inténtalo otra vez.')
      })
      .finally(() => setStatus('idle'))
  }

  const handleZoneKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen || suggestions.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
    } else if (event.key === 'Escape') {
      setSuggestionsOpen(false)
      setActiveIndex(-1)
    }
  }

  const handleUseLocation = () => {
    setStatus('locating')
    setErrorMessage(null)
    setSuggestionsOpen(false)

    void requestUserLocation()
      .then((result) => {
        setOrigin({ coords: result.coords, source: 'gps', label: 'Tu ubicación' })
      })
      .catch((locationError) => {
        setErrorMessage(getLocationErrorMessage(locationError, false))
      })
      .finally(() => setStatus('idle'))
  }

  const clearOrigin = () => {
    setOrigin(null)
    setZoneDraft('')
    setSuggestions([])
    setErrorMessage(null)
  }

  const showSuggestions = suggestionsOpen && suggestions.length > 0

  return (
    <section className={styles.section} aria-labelledby="landing-map-title">
      <div className={styles.panel}>
        <p className={styles.eyebrow}>Cerca de ti</p>
        <h2 id="landing-map-title">¿Qué hay para comer por aquí?</h2>
        <p className={styles.lead}>
          Escribe tu zona o usa tu ubicación y te enseñamos los restaurantes más cercanos.
        </p>

        <form className={styles.zoneForm} onSubmit={handleZoneSubmit}>
          <div className={styles.zoneCombo}>
            <label className={styles.zoneField}>
              <MapPin size={18} aria-hidden="true" />
              <span className={styles.srOnly}>Tu zona</span>
              <input
                type="text"
                value={zoneDraft}
                onChange={(event) => setZoneDraft(event.target.value)}
                onKeyDown={handleZoneKeyDown}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setSuggestionsOpen(false)}
                placeholder="Barrio, calle o ciudad"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestions}
                aria-controls={SUGGESTIONS_ID}
                aria-activedescendant={activeIndex >= 0 ? `${SUGGESTIONS_ID}-${activeIndex}` : undefined}
              />
            </label>

            {showSuggestions ? (
              <ul id={SUGGESTIONS_ID} className={styles.suggestions} role="listbox">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.id}
                    id={`${SUGGESTIONS_ID}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? styles.suggestionActive : styles.suggestion}
                    // Antes del blur del input, para que el clic llegue a la opción.
                    onMouseDown={(event) => {
                      event.preventDefault()
                      chooseSuggestion(suggestion)
                    }}
                  >
                    <MapPin size={16} aria-hidden="true" />
                    <span>
                      <strong>{suggestion.title}</strong>
                      {suggestion.subtitle ? <small>{suggestion.subtitle}</small> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button type="submit" className={styles.zoneButton} disabled={status !== 'idle'}>
            <Search size={18} aria-hidden="true" />
            <span>{status === 'searching' ? 'Buscando…' : 'Buscar'}</span>
          </button>
        </form>

        <button
          type="button"
          className={styles.gpsButton}
          onClick={handleUseLocation}
          disabled={status !== 'idle'}
        >
          <LocateFixed size={18} aria-hidden="true" />
          {status === 'locating' ? 'Ubicando…' : 'Usar mi ubicación'}
        </button>

        {errorMessage ? (
          <p className={styles.error} role="alert">{errorMessage}</p>
        ) : null}

        {origin ? (
          <p className={styles.originChip}>
            <span>{origin.source === 'gps' ? 'Tu ubicación' : origin.label}</span>
            <button type="button" onClick={clearOrigin} aria-label="Quitar zona">
              <X size={14} aria-hidden="true" />
            </button>
          </p>
        ) : null}
      </div>

      <div className={styles.mapSlot}>
        <NearbyRestaurantsMap
          bare
          restaurants={mapRestaurants}
          userCoords={origin?.source === 'gps' ? origin.coords : null}
          homeCoords={origin?.source === 'zone' ? origin.coords : null}
          locating={status === 'locating'}
          locationError={null}
          promoCounts={promoCounts}
          onRequestGps={handleUseLocation}
          onOpenRestaurant={onOpenRestaurant}
        />
      </div>
    </section>
  )
}

export default LandingNearbyMap
