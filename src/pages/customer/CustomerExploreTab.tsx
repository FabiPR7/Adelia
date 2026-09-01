import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DiscoverySearchBar from '../../components/DiscoverySearchBar'
import DiscoveryVenueKindFilter from '../../components/DiscoveryVenueKindFilter'
import DiscoverySkeleton from '../../components/DiscoverySkeleton'
import NearbyRestaurantsMap from '../../components/NearbyRestaurantsMap'
import FeaturedReviewHighlight from '../../components/FeaturedReviewHighlight'
import NearbyRestaurantFeed from '../../components/NearbyRestaurantFeed'
import RestaurantInfiniteCarousel from '../../components/RestaurantInfiniteCarousel'
import RotatingRestaurantSpotlight from '../../components/RotatingRestaurantSpotlight'
import AdelinaCoin from '../../components/AdelinaCoin'
import { useAuth } from '../../context/AuthContext'
import { useFavoriteRestaurants } from '../../hooks/useFavoriteRestaurants'
import { fetchPublicDiscoveryRestaurants } from '../../services/publicDiscovery'
import type { CitySuggestion } from '../../services/citySearch'
import { haversineDistanceKm, type GeoCoordinates } from '../../utils/geo'
import { toGeoCoordinates } from '../../utils/mapCoordinates'
import {
  collectPopularCharacteristics,
  filterDiscoveryRestaurants,
  restaurantHasMapPin,
  restaurantMatchesVenueKind,
  sortRestaurantsByDistance,
  sortRestaurantsByReviewAdelinas,
  sortRestaurantsByReviewRating,
  splitRestaurantsForCarousels,
  type PublicDiscoveryRestaurant,
} from '../../utils/publicDiscovery'
import { getLocationErrorMessage, requestUserLocation } from '../../utils/requestUserLocation'
import type { DiscoveryVenueKind } from '../../data/companyProfileFacilities'
import styles from './CustomerExploreTab.module.css'

type NearbyState = 'idle' | 'locating' | 'geocoding' | 'ready' | 'error'

function CustomerExploreTab() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { favoriteSlugs } = useFavoriteRestaurants()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null)
  const [activeTrait, setActiveTrait] = useState('')
  const [venueKind, setVenueKind] = useState<DiscoveryVenueKind | ''>('')
  const [nearbyActive, setNearbyActive] = useState(false)
  const [nearbyState, setNearbyState] = useState<NearbyState>('idle')
  const [nearbyMessage, setNearbyMessage] = useState<string | null>(null)
  const [userCoords, setUserCoords] = useState<GeoCoordinates | null>(null)
  const [favoritesActive, setFavoritesActive] = useState(false)

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
    let results = filterDiscoveryRestaurants(restaurants, effectiveQuery, selectedCity?.name ?? '')
      .filter((restaurant) => restaurantMatchesVenueKind(restaurant, venueKind))

    if (favoritesActive) {
      results = results.filter((restaurant) =>
        favoriteSlugs.includes(restaurant.slug.trim().toLowerCase()),
      )
    }

    if (nearbyActive && userCoords) {
      return sortRestaurantsByDistance(results, distancesKm)
    }

    return results
  }, [restaurants, effectiveQuery, selectedCity, venueKind, favoritesActive, favoriteSlugs, nearbyActive, userCoords, distancesKm])

  const { primary, secondary } = useMemo(
    () => splitRestaurantsForCarousels(filteredRestaurants),
    [filteredRestaurants],
  )

  const mostReserved = useMemo(
    () => sortRestaurantsByReviewAdelinas(filteredRestaurants).slice(0, 8),
    [filteredRestaurants],
  )

  const topRated = useMemo(
    () => sortRestaurantsByReviewRating(filteredRestaurants).slice(0, 8),
    [filteredRestaurants],
  )

  const homeCoords = useMemo(
    () => toGeoCoordinates(profile?.homeLatitude, profile?.homeLongitude),
    [profile?.homeLatitude, profile?.homeLongitude],
  )

  const feedOrigin = userCoords ?? homeCoords

  const feedDistancesKm = useMemo(() => {
    if (!feedOrigin) {
      return {}
    }

    const next: Record<string, number> = {}

    for (const restaurant of restaurants) {
      if (!restaurantHasMapPin(restaurant)) {
        continue
      }

      next[restaurant.slug] = haversineDistanceKm(feedOrigin, {
        lat: restaurant.latitude as number,
        lng: restaurant.longitude as number,
      })
    }

    return next
  }, [restaurants, feedOrigin])


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

  const requestGpsLocation = useCallback(() => {
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
  }, [enableNearby, selectedCity])

  const handleUseLocation = () => {
    if (nearbyActive) {
      disableNearby()
      return
    }

    requestGpsLocation()
  }

  const openRestaurant = useCallback(
    (restaurant: PublicDiscoveryRestaurant) => {
      navigate(`/reservar/${restaurant.slug}`)
    },
    [navigate],
  )

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
        favoritesActive={favoritesActive}
        onToggleFavorites={() => setFavoritesActive((current) => !current)}
      />

      <main className={styles.main}>
        {loading && <DiscoverySkeleton />}

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {!loading && !error && filteredRestaurants.length === 0 && (
          <div className={styles.stateBox} role="status">
            {favoritesActive && favoriteSlugs.length === 0
              ? 'Aún no tienes favoritos. Toca el corazón en un local para guardarlo.'
              : restaurants.length === 0
                ? 'Aún no hay restaurantes publicados. Vuelve pronto para descubrir nuevos locales.'
                : 'No encontramos restaurantes con esa búsqueda. Prueba otra ciudad o quita filtros.'}
          </div>
        )}

        {!loading && !error && filteredRestaurants.length > 0 && (
          <>
            <section className={styles.carouselSection}>
              <div className={styles.carouselHeader}>
                <h2>{nearbyActive ? 'Cerca de ti' : 'Para ti hoy'}</h2>
                <DiscoveryVenueKindFilter value={venueKind} onChange={setVenueKind} compact />
                <span>{filteredRestaurants.length} locales</span>
              </div>
              <RestaurantInfiniteCarousel
                key={"primary-" + (venueKind || "all")}
                restaurants={primary}
                direction="right"
                distancesKm={nearbyActive ? distancesKm : undefined}
                onOpenRestaurant={openRestaurant}
              />
            </section>

            <section className={styles.spotlightSection} aria-label="Trending y top valorados">
              <div className={styles.spotlightEnd}>
                <RotatingRestaurantSpotlight
                  title="Trending"
                  restaurants={mostReserved}
                  onOpenRestaurant={openRestaurant}
                />
              </div>
              <div className={styles.spotlightBridge}>
                <span className={styles.bridgeRail} aria-hidden="true" />
                <div className={styles.bridgeSeal}>
                  <span className={styles.bridgeSpark} aria-hidden="true" />
                  <AdelinaCoin size="md" variant="review" alt="" />
                  <p className={styles.bridgeKicker}>Hoy</p>
                  <p className={styles.bridgeCopy}>Se pide · Se valora</p>
                </div>
                <span className={styles.bridgeRail} aria-hidden="true" />
              </div>
              <div className={styles.spotlightEnd}>
                <RotatingRestaurantSpotlight
                  title="Top valorados"
                  restaurants={topRated}
                  onOpenRestaurant={openRestaurant}
                />
              </div>
            </section>

            {secondary.length > 0 ? (
              <section className={styles.carouselSection}>
                <div className={styles.carouselHeader}>
                  <h2>Descubre más</h2>
                  <span>{nearbyActive ? 'A un paso' : 'Desliza y reserva'}</span>
                </div>
                <RestaurantInfiniteCarousel
                  restaurants={secondary}
                  direction="left"
                  distancesKm={nearbyActive ? distancesKm : undefined}
                  onOpenRestaurant={openRestaurant}
                />
              </section>
            ) : null}
          </>
        )}

        {!loading && !error && filteredRestaurants.length > 0 && (
          <>
            <NearbyRestaurantsMap
              restaurants={filteredRestaurants}
              userCoords={userCoords}
              homeCoords={homeCoords}
              locating={nearbyState === 'locating'}
              locationError={nearbyState === 'error' ? nearbyMessage : null}
              onRequestGps={requestGpsLocation}
              onOpenRestaurant={openRestaurant}
            />
            <FeaturedReviewHighlight
              restaurants={filteredRestaurants}
              onOpenRestaurant={openRestaurant}
            />
            <NearbyRestaurantFeed
              restaurants={filteredRestaurants}
              origin={feedOrigin}
              distancesKm={feedDistancesKm}
              locating={nearbyState === 'locating'}
              onRequestLocation={requestGpsLocation}
              onOpenRestaurant={openRestaurant}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default CustomerExploreTab
