import { useCallback, useEffect, useMemo, useState } from 'react'
import { browseListFrom, nearestBrowseList } from '../../utils/restaurantBrowse'
import { useNavigate } from 'react-router-dom'
import DiscoverySearchBar from '../../components/DiscoverySearchBar'
import MissionNudgeCard from '../../components/MissionNudgeCard'
import { useMissionNudge } from '../../hooks/useMissionNudge'
import { applyQuickFilters, type QuickFilterId } from '../../utils/discoveryQuickFilters'
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
import { usePromotionCounts } from '../../hooks/usePromotionCounts'
import { fetchPublicDiscoveryPage, fetchPublicDiscoveryRestaurants, mergeDiscoveryRestaurants } from '../../services/publicDiscovery'
import type { CitySuggestion } from '../../services/citySearch'
import { haversineDistanceKm, type GeoCoordinates } from '../../utils/geo'
import { toGeoCoordinates } from '../../utils/mapCoordinates'
import {
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
import MonthPodium from '../../components/discovery/MonthPodium'
import CollectionProgress from '../../components/discovery/CollectionProgress'
import VisitRows from '../../components/discovery/VisitRows'
import TopPromotionsSection from '../../components/discovery/TopPromotionsSection'
import FriendsVisitedRow from '../../components/discovery/FriendsVisitedRow'
import FoodCategoryButtons from '../../components/discovery/FoodCategoryButtons'
import LazySection from '../../components/LazySection'
import { findFoodCategory, MAIN_FOOD_CATEGORIES, restaurantMatchesFoodCategory } from '../../data/foodCategories'
import styles from './CustomerExploreTab.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

type NearbyState = 'idle' | 'locating' | 'geocoding' | 'ready' | 'error'

/** Radio que cuenta como «tu zona» cuando no hay ciudad elegida. */
const LOCAL_RADIUS_KM = 25

function normalizePlace(value: string | undefined | null): string {
  return (value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function CustomerExploreTab() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { favoriteSlugs } = useFavoriteRestaurants()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Siguiente página del listado general (el servidor manda 80 cada vez).
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  // Ciudad escrita a mano sin elegir sugerencia: filtra al pulsar Buscar.
  const [cityDraft, setCityDraft] = useState('')
  const [appliedCity, setAppliedCity] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null)
  const [activeTrait, setActiveTrait] = useState('')
  const [venueKind, setVenueKind] = useState<DiscoveryVenueKind | ''>('')
  const [nearbyActive, setNearbyActive] = useState(false)
  const [nearbyState, setNearbyState] = useState<NearbyState>('idle')
  const [nearbyMessage, setNearbyMessage] = useState<string | null>(null)
  const [userCoords, setUserCoords] = useState<GeoCoordinates | null>(null)
  const [favoritesActive, setFavoritesActive] = useState(false)
  const promoCounts = usePromotionCounts()
  const [quickFilters, setQuickFilters] = useState<ReadonlySet<QuickFilterId>>(new Set())
  const nudge = useMissionNudge()

  useEffect(() => {
    let cancelled = false

    void fetchPublicDiscoveryPage()
      .then((page) => {
        if (!cancelled) {
          setRestaurants((previous) => mergeDiscoveryRestaurants(page.restaurants, previous))
          setNextCursor(page.nextCursor)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(friendlyErrorMessage(err, 'No se pudieron cargar los restaurantes.'))
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

  // Filtro del buscador: los tipos de comida principales.
  const traitOptions = useMemo(() => MAIN_FOOD_CATEGORIES.map((category) => category.label), [])
  const activeFoodCategory = useMemo(() => findFoodCategory(activeTrait), [activeTrait])

  const effectiveQuery = activeFoodCategory ? appliedSearch : activeTrait || appliedSearch

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
    let results = filterDiscoveryRestaurants(restaurants, effectiveQuery, selectedCity?.name ?? appliedCity)
      .filter((restaurant) => restaurantMatchesVenueKind(restaurant, venueKind))
      .filter((restaurant) => !activeFoodCategory || restaurantMatchesFoodCategory(restaurant, activeFoodCategory))

    if (favoritesActive) {
      results = results.filter((restaurant) =>
        favoriteSlugs.includes(restaurant.slug.trim().toLowerCase()),
      )
    }

    results = applyQuickFilters(
      results,
      quickFilters,
      { promoCounts, visitedCompanyIds: nudge.visitedCompanyIds, mission: nudge.closest },
      { keepOrder: nearbyActive && Boolean(userCoords) },
    )

    if (nearbyActive && userCoords) {
      return sortRestaurantsByDistance(results, distancesKm)
    }

    return results
  }, [restaurants, effectiveQuery, activeFoodCategory, selectedCity, appliedCity, venueKind, favoritesActive, favoriteSlugs, nearbyActive, userCoords, distancesKm, quickFilters, promoCounts, nudge.visitedCompanyIds, nudge.closest])

  const homeCoords = useMemo(
    () => toGeoCoordinates(profile?.homeLatitude, profile?.homeLongitude),
    [profile?.homeLatitude, profile?.homeLongitude],
  )

  const feedOrigin = userCoords ?? homeCoords

  // El listado general trae los más valorados; los de tu zona o ciudad se piden
  // aparte para que salgan aunque haya miles de restaurantes.
  const selectedCityName = selectedCity?.name ?? ''
  useEffect(() => {
    const options = selectedCityName
      ? { city: selectedCityName }
      : feedOrigin
        ? { near: feedOrigin }
        : null
    if (!options) {
      return
    }
    let cancelled = false
    void fetchPublicDiscoveryRestaurants(options)
      .then((items) => {
        if (!cancelled && items.length > 0) {
          setRestaurants((previous) => mergeDiscoveryRestaurants(previous, items))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [feedOrigin, selectedCityName])

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

  // Primero lo de tu zona (tu ubicación, tu casa o tu ciudad del perfil); si no
  // hay nada cerca, el orden del servidor: los mejores de Adelia.
  const homeCityName = profile?.homeMunicipality || profile?.homeCity || ''
  const local = useMemo(() => {
    if (nearbyActive && userCoords) {
      return { list: filteredRestaurants, count: filteredRestaurants.length }
    }
    if (selectedCity || appliedCity) {
      return { list: filteredRestaurants, count: filteredRestaurants.length }
    }
    const city = normalizePlace(homeCityName)
    const isLocal = (restaurant: PublicDiscoveryRestaurant) => {
      const distance = feedDistancesKm[restaurant.slug]
      if (typeof distance === 'number' && distance <= LOCAL_RADIUS_KM) return true
      return Boolean(city) && normalizePlace(restaurant.municipality) === city
    }
    const near = filteredRestaurants.filter(isLocal)
    const sortedNear = feedOrigin ? sortRestaurantsByDistance(near, feedDistancesKm) : near
    const rest = filteredRestaurants.filter((restaurant) => !isLocal(restaurant))
    return { list: [...sortedNear, ...rest], count: near.length }
  }, [filteredRestaurants, nearbyActive, userCoords, selectedCity, appliedCity, homeCityName, feedDistancesKm, feedOrigin])

  const { primary, secondary } = useMemo(
    () => splitRestaurantsForCarousels(local.list),
    [local.list],
  )

  // Con al menos 3 locales cerca, los destacados también son de tu zona.
  const spotlightPool = useMemo(
    () => (local.count >= 3 ? local.list.slice(0, local.count) : local.list),
    [local],
  )
  const mostReserved = useMemo(
    () => sortRestaurantsByReviewAdelinas(spotlightPool).slice(0, 8),
    [spotlightPool],
  )

  const topRated = useMemo(
    () => sortRestaurantsByReviewRating(spotlightPool).slice(0, 8),
    [spotlightPool],
  )

  const placeName = nearbyActive ? '' : selectedCity?.name || appliedCity || homeCityName
  const mainTitle = nearbyActive
    ? 'Cerca de ti'
    : selectedCity || appliedCity
      ? `En ${placeName}`
      : local.count > 0
        ? (placeName ? `Cerca de ti · ${placeName}` : 'Cerca de ti')
        : 'Los mejores de Adelia'


  // «Ver todos»: quita búsqueda, ciudad y filtros de una vez.
  const [cityResetKey, setCityResetKey] = useState(0)
  const resetSearch = () => {
    setSearchDraft('')
    setAppliedSearch('')
    setActiveTrait('')
    setSelectedCity(null)
    setCityDraft('')
    setAppliedCity('')
    setVenueKind('')
    setQuickFilters(new Set())
    setFavoritesActive(false)
    setCityResetKey((value) => value + 1)
  }

  const handleSearch = () => {
    setAppliedSearch(searchDraft.trim())
    setAppliedCity(cityDraft.trim())
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

  // Al llegar al final de «Todos los restaurantes» se pide la página siguiente.
  const loadMoreRestaurants = useCallback(() => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    void fetchPublicDiscoveryPage({ cursor: nextCursor })
      .then((page) => {
        setRestaurants((previous) => mergeDiscoveryRestaurants(previous, page.restaurants))
        setNextCursor(page.nextCursor)
      })
      .catch(() => setNextCursor(null))
      .finally(() => setLoadingMore(false))
  }, [nextCursor, loadingMore])

  const openRestaurant = useCallback(
    (restaurant: PublicDiscoveryRestaurant, browse?: string[]) => {
      navigate(`/reservar/${restaurant.slug}`, browse ? { state: { browse } } : undefined)
    },
    [navigate],
  )
  // Cada sección pasa su lista para poder deslizar a la ficha siguiente o anterior.
  const openFrom = (list: readonly PublicDiscoveryRestaurant[]) => (restaurant: PublicDiscoveryRestaurant) =>
    openRestaurant(restaurant, browseListFrom(list, restaurant.slug))
  // En el mapa, el siguiente es el más cercano al que se ha tocado.
  const openNearestIn = (list: readonly PublicDiscoveryRestaurant[]) => (restaurant: PublicDiscoveryRestaurant) =>
    openRestaurant(restaurant, nearestBrowseList(list, restaurant))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Descubre</p>
        <h1>Buscar restaurante</h1>
        <p className={styles.lead}>Busca, filtra y reserva tu próxima mesa.</p>
      </header>

      <div className={styles.nudge}>
        <MissionNudgeCard />
      </div>

      <DiscoverySearchBar
        key={cityResetKey}
        searchDraft={searchDraft}
        onSearchDraftChange={setSearchDraft}
        selectedCity={selectedCity}
        onSelectedCityChange={setSelectedCity}
        nearLat={feedOrigin?.lat}
        nearLng={feedOrigin?.lng}
        onPickAddress={(address) => enableNearby({ lat: address.lat, lng: address.lng }, `Ordenados por distancia a ${address.line}.`)}
        onCityTextChange={setCityDraft}
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
                : quickFilters.size > 0
                  ? 'Ningún restaurante cumple todos los filtros rápidos. Quita alguno para ver más.'
                  : 'No encontramos restaurantes con esa búsqueda. Prueba otra ciudad o quita filtros.'}
            {restaurants.length > 0 ? (
              <button type="button" className={styles.stateAction} onClick={resetSearch}>
                Ver todos los restaurantes
              </button>
            ) : null}
          </div>
        )}


        {!loading && !error && filteredRestaurants.length > 0 && (
          <>
            <section className={styles.carouselSection} data-tour="tour-carousel">
              <div className={styles.carouselHeader}>
                <h2>{mainTitle}</h2>
                <DiscoveryVenueKindFilter value={venueKind} onChange={setVenueKind} compact />
                <span>{filteredRestaurants.length} locales</span>
              </div>
              <RestaurantInfiniteCarousel
                key={"primary-" + (venueKind || "all")}
                restaurants={primary}
                direction="right"
                distancesKm={nearbyActive ? distancesKm : undefined}
                onOpenRestaurant={openFrom(primary)}
              />
            </section>

            <section className={styles.spotlightSection} aria-label="Trending y top valorados">
              <div className={styles.spotlightEnd}>
                <RotatingRestaurantSpotlight
                  title="Lo más pedido"
                  restaurants={mostReserved}
                  onOpenRestaurant={openFrom(mostReserved)}
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
                  title="Mejor valorados"
                  restaurants={topRated}
                  onOpenRestaurant={openFrom(topRated)}
                />
              </div>
            </section>

            {secondary.length > 0 ? (
              <section className={styles.carouselSection}>
                <div className={styles.carouselHeader}>
                  <h2>Más para descubrir</h2>
                  <span>{nearbyActive ? 'Un poco más lejos' : 'Otros que te pueden gustar'}</span>
                </div>
                <RestaurantInfiniteCarousel
                  restaurants={secondary}
                  direction="left"
                  distancesKm={nearbyActive ? distancesKm : undefined}
                  onOpenRestaurant={openFrom(secondary)}
                />
              </section>
            ) : null}

            {/* De aquí para abajo, cada sección pide sus datos al llegar a ella. */}
            <LazySection minHeight={160}>
              <FriendsVisitedRow />
            </LazySection>
          </>
        )}

        {!loading && !error && filteredRestaurants.length > 0 && (
          <>
            <LazySection minHeight={420}>
              <NearbyRestaurantsMap
                restaurants={filteredRestaurants}
                userCoords={userCoords}
                homeCoords={homeCoords}
                locating={nearbyState === 'locating'}
                locationError={nearbyState === 'error' ? nearbyMessage : null}
                promoCounts={promoCounts}
                onRequestGps={requestGpsLocation}
                onOpenRestaurant={openNearestIn(filteredRestaurants)}
              />
            </LazySection>
            <LazySection minHeight={280}>
              <CollectionProgress
                city={selectedCity?.name || profile?.homeMunicipality || profile?.homeCity || ''}
                restaurants={restaurants}
                onOpenRestaurant={openFrom(restaurants)}
              />
            </LazySection>
            <LazySection minHeight={480}>
              <MonthPodium city={selectedCity?.name || profile?.homeMunicipality || profile?.homeCity || ''} />
            </LazySection>
            <LazySection minHeight={300}>
              <VisitRows restaurants={local.list} />
            </LazySection>
            <LazySection minHeight={220}>
              <FeaturedReviewHighlight
                restaurants={filteredRestaurants}
                onOpenRestaurant={openFrom(filteredRestaurants)}
              />
            </LazySection>
            <LazySection minHeight={320}>
              <TopPromotionsSection />
            </LazySection>
            <FoodCategoryButtons restaurants={restaurants} />
            <NearbyRestaurantFeed
              restaurants={local.list}
              origin={feedOrigin}
              distancesKm={feedDistancesKm}
              locating={nearbyState === 'locating'}
              onRequestLocation={requestGpsLocation}
              onOpenRestaurant={openFrom(local.list)}
              hasMoreRemote={Boolean(nextCursor)}
              loadingMoreRemote={loadingMore}
              onLoadMoreRemote={loadMoreRestaurants}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default CustomerExploreTab

