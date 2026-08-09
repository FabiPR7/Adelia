import { useCallback, useEffect, useMemo, useState } from 'react'
import DiscoverySearchBar from '../../components/DiscoverySearchBar'
import DiscoverySkeleton from '../../components/DiscoverySkeleton'
import RestaurantInfiniteCarousel from '../../components/RestaurantInfiniteCarousel'
import RestaurantPreviewSheet from '../../components/RestaurantPreviewSheet'
import RotatingRestaurantSpotlight from '../../components/RotatingRestaurantSpotlight'
import { fetchPublicDiscoveryRestaurants } from '../../services/publicDiscovery'
import type { CitySuggestion } from '../../services/citySearch'
import { haversineDistanceKm, type GeoCoordinates } from '../../utils/geo'
import {
  collectPopularCharacteristics,
  filterDiscoveryRestaurants,
  restaurantHasMapPin,
  sortRestaurantsByDistance,
  sortRestaurantsByMockRating,
  sortRestaurantsByMockReservations,
  splitRestaurantsForCarousels,
  type PublicDiscoveryRestaurant,
} from '../../utils/publicDiscovery'
import { getLocationErrorMessage, requestUserLocation } from '../../utils/requestUserLocation'
import styles from './CustomerExploreTab.module.css'

type NearbyState = 'idle' | 'locating' | 'geocoding' | 'ready' | 'error'

function CustomerExploreTab() {
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewRestaurant, setPreviewRestaurant] = useState<PublicDiscoveryRestaurant | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null)
  const [activeTrait, setActiveTrait] = useState('')
  const [nearbyActive, setNearbyActive] = useState(false)
  const [nearbyState, setNearbyState] = useState<NearbyState>('idle')
  const [nearbyMessage, setNearbyMessage] = useState<string | null>(null)
  const [userCoords, setUserCoords] = useState<GeoCoordinates | null>(null)

  useEffect(() => {
    let cancelled = false

    void fetchPublicDiscoveryRestaurants()
      .then((data) => {
        if (!cancelled) {
          setRestaurants(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los restaurantes.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const traitOptions = useMemo(
    () => collectPopularCharacteristics(restaurants),
    [restaurants],
  )

  const effectiveQuery = activeTrait || appliedSearch

  const distancesKm = useMemo(() => {
    if (!userCoords) {
      return {}
    }

    const next: Record<string, number> = {}

    for (const restaurant of restaurants) {
      if (!restaurantHasMapPin(restaurant)) {
        continue
      }

      next[restaurant.slug] = haversineDistanceKm(userCoords, {
        lat: restaurant.latitude as number,
        lng: restaurant.longitude as number,
      })
    }

    return next
  }, [restaurants, userCoords])

  const filteredRestaurants = useMemo(() => {
    const results = filterDiscoveryRestaurants(restaurants, effectiveQuery, selectedCity?.name ?? '')

    if (nearbyActive && userCoords) {
      return sortRestaurantsByDistance(results, distancesKm)
    }

    return results
  }, [restaurants, effectiveQuery, selectedCity, nearbyActive, userCoords, distancesKm])

  const { primary, secondary } = useMemo(
    () => splitRestaurantsForCarousels(filteredRestaurants),
    [filteredRestaurants],
  )

  const mostReserved = useMemo(
    () => sortRestaurantsByMockReservations(filteredRestaurants).slice(0, 8),
    [filteredRestaurants],
  )

  const topRated = useMemo(
    () => sortRestaurantsByMockRating(filteredRestaurants).slice(0, 8),
    [filteredRestaurants],
  )

  const handleSearch = () => {
    setAppliedSearch(searchDraft.trim())
    setActiveTrait('')
  }

  const handleTraitChange = (trait: string) => {
    setActiveTrait(trait)
    setSearchDraft('')
    setAppliedSearch('')
  }

  const disableNearby = useCallback(() => {
    setNearbyActive(false)
    setNearbyState('idle')
    setNearbyMessage(null)
    setUserCoords(null)
  }, [])

  const enableNearby = useCallback((coords: GeoCoordinates, readyMessage: string) => {
    setUserCoords(coords)
    setNearbyActive(true)
    setNearbyState('ready')

    const mappableCount = restaurants.filter(restaurantHasMapPin).length

    if (mappableCount === 0) {
      setNearbyMessage(
        'Hay locales visibles, pero ninguno tiene ubicación en mapa todavía.',
      )
      return
    }

    setNearbyMessage(readyMessage)
  }, [restaurants])

  const handleUseLocation = () => {
    if (nearbyActive) {
      disableNearby()
      return
    }

    setNearbyState('locating')
    setNearbyMessage('Obteniendo ubicación…')

    const cityLabel = selectedCity?.label ?? selectedCity?.name ?? ''

    void requestUserLocation(cityLabel)
      .then((result) => {
        const readyMessage =
          result.source === 'gps'
            ? 'Ordenados por distancia a tu ubicación.'
            : `Ordenados por distancia a ${result.cityLabel ?? 'tu ciudad'}.`

        enableNearby(result.coords, readyMessage)
      })
      .catch((locationError) => {
        setNearbyState('error')
        setNearbyMessage(getLocationErrorMessage(locationError, Boolean(cityLabel)))
      })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Descubre</p>
        <h1>Buscar restaurante</h1>
        <p className={styles.lead}>Busca, filtra y reserva tu próxima mesa.</p>
      </header>

      <DiscoverySearchBar
        searchDraft={searchDraft}
        onSearchDraftChange={setSearchDraft}
        selectedCity={selectedCity}
        onSelectedCityChange={setSelectedCity}
        activeTrait={activeTrait}
        onTraitChange={handleTraitChange}
        traitOptions={traitOptions}
        onSearch={handleSearch}
        nearbyActive={nearbyActive}
        nearbyState={nearbyState}
        nearbyMessage={nearbyMessage}
        onUseLocation={handleUseLocation}
      />

      <main className={styles.main}>
        {loading && <DiscoverySkeleton />}

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {!loading && !error && filteredRestaurants.length === 0 && (
          <div className={styles.stateBox}>
            {restaurants.length === 0
              ? 'Aún no hay restaurantes publicados. Vuelve pronto para descubrir nuevos locales.'
              : 'No encontramos restaurantes con esa búsqueda. Prueba otra ciudad o quita filtros.'}
          </div>
        )}

        {!loading && !error && filteredRestaurants.length > 0 && (
          <>
            <section className={styles.carouselSection}>
              <div className={styles.carouselHeader}>
                <h2>{nearbyActive ? 'Cerca de ti' : 'Para ti hoy'}</h2>
                <span>{filteredRestaurants.length} locales</span>
              </div>
              <RestaurantInfiniteCarousel
                restaurants={primary}
                direction="right"
                distancesKm={nearbyActive ? distancesKm : undefined}
                onOpenRestaurant={setPreviewRestaurant}
              />
            </section>

            <section className={styles.spotlightSection}>
              <RotatingRestaurantSpotlight
                title="Trending"
                subtitle="Los más reservados"
                restaurants={mostReserved}
                metric="reservations"
                onOpenRestaurant={setPreviewRestaurant}
              />
              <RotatingRestaurantSpotlight
                title="Top valorados"
                subtitle="Mayor puntuación"
                restaurants={topRated}
                metric="rating"
                onOpenRestaurant={setPreviewRestaurant}
              />
            </section>

            <section className={styles.carouselSection}>
              <div className={styles.carouselHeader}>
                <h2>Descubre más</h2>
                <span>{nearbyActive ? 'Por distancia' : 'Desliza y reserva'}</span>
              </div>
              <RestaurantInfiniteCarousel
                restaurants={secondary}
                direction="left"
                distancesKm={nearbyActive ? distancesKm : undefined}
                onOpenRestaurant={setPreviewRestaurant}
              />
            </section>
          </>
        )}
      </main>

      <RestaurantPreviewSheet
        restaurant={previewRestaurant}
        distanceKm={
          previewRestaurant && nearbyActive ? distancesKm[previewRestaurant.slug] : undefined
        }
        onClose={() => setPreviewRestaurant(null)}
      />
    </div>
  )
}

export default CustomerExploreTab
