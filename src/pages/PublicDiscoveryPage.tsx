import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import CityAutocomplete from '../components/CityAutocomplete'
import DiscoveryGamificationBanner from '../components/DiscoveryGamificationBanner'
import DiscoveryReviewsCallout from '../components/DiscoveryReviewsCallout'
import DiscoveryPromotionsSection from '../components/DiscoveryPromotionsSection'
import DiscoverySkeleton from '../components/DiscoverySkeleton'
import DiscoveryTraitsFilter from '../components/DiscoveryTraitsFilter'
import RestaurantInfiniteCarousel from '../components/RestaurantInfiniteCarousel'
import RestaurantPreviewSheet from '../components/RestaurantPreviewSheet'
import { useAuth } from '../context/AuthContext'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { useCustomerGamification } from '../hooks/useCustomerGamification'
import { useFavoriteRestaurants } from '../hooks/useFavoriteRestaurants'
import { getCustomerReservations } from '../services/firestore'
import { fetchPublicDiscoveryRestaurants } from '../services/publicDiscovery'
import { fetchPublicPromotions } from '../services/publicPromotions'
import type { CitySuggestion } from '../services/citySearch'
import type { Reservation } from '../types'
import { getPostLoginPath } from '../utils/authProfile'
import { haversineDistanceKm, type GeoCoordinates } from '../utils/geo'
import { getMockAdelinaReviewCount, getMockReviewRating } from '../utils/mockReviewRating'
import {
  collectPopularCharacteristics,
  filterDiscoveryRestaurants,
  restaurantHasMapPin,
  sortRestaurantsByDistance,
  splitRestaurantsForCarousels,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { getLocationErrorMessage, requestUserLocation } from '../utils/requestUserLocation'
import styles from './PublicDiscoveryPage.module.css'

type NearbyState = 'idle' | 'locating' | 'geocoding' | 'ready' | 'error'

interface PublicDiscoveryPageProps {
  appMode?: boolean
}

function PublicDiscoveryPage({ appMode = false }: PublicDiscoveryPageProps) {
  const { user, profile, isLoading: authLoading } = useAuth()
  const { favoriteSlugs } = useFavoriteRestaurants()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null)
  const [activeTrait, setActiveTrait] = useState('')
  const [previewRestaurant, setPreviewRestaurant] = useState<PublicDiscoveryRestaurant | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [promotionCompanyIds, setPromotionCompanyIds] = useState<Set<string>>(new Set())
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

  useEffect(() => {
    if (!profile || profile.role !== 'customer') {
      setReservations([])
      return
    }

    let cancelled = false

    void getCustomerReservations(profile.email)
      .then((data) => {
        if (!cancelled) {
          setReservations(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReservations([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile])

  useEffect(() => {
    let cancelled = false

    void fetchPublicPromotions()
      .then((promotions) => {
        if (!cancelled) {
          setPromotionCompanyIds(new Set(promotions.map((promotion) => promotion.companyId)))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPromotionCompanyIds(new Set())
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const isCustomer = profile?.role === 'customer'

  const gamification = useCustomerGamification({
    reservations,
    favoriteSlugs,
    restaurants,
    promotionCompanyIds,
    enabled: isCustomer,
  })

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

  const reviewSpotlight = useMemo(() => {
    const pick = restaurants[0]

    if (!pick) {
      return null
    }

    return {
      name: pick.name,
      reviewRating: getMockReviewRating(pick.slug),
      adelinaCount: getMockAdelinaReviewCount(pick.slug),
      isFavorite: false,
    }
  }, [restaurants])

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
      setNearbyMessage('Hay locales visibles, pero ninguno tiene ubicación en mapa todavía. El restaurante debe guardar su pin en Ajustes.')
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
        const readyMessage = result.source === 'gps'
          ? 'Ordenados por distancia a tu ubicación.'
          : `Ordenados por distancia a ${result.cityLabel ?? 'tu ciudad'}.`

        enableNearby(result.coords, readyMessage)
      })
      .catch((locationError) => {
        setNearbyState('error')
        setNearbyMessage(getLocationErrorMessage(locationError, Boolean(cityLabel)))
      })
  }

  const locationButtonClassName = nearbyActive
    ? styles.locationActive
    : styles.locationButton

  const locationButtonLabel = nearbyState === 'locating'
    ? 'Ubicando…'
    : nearbyActive
      ? '📍 Cerca ✓'
      : '📍 Cerca'

  if (!authLoading && user && profile && profile.role !== 'customer') {
    return <Navigate to={getPostLoginPath(profile, user)} replace />
  }

  if (!authLoading && user && profile?.role === 'customer' && !appMode && profile.onboardingCompleted) {
    return <Navigate to="/app/explorar" replace />
  }

  return (
    <div className={`${styles.page} ${appMode ? styles.pageAppMode : ''}`}>
      {!appMode ? (
      <header className={styles.header}>
        <div className={styles.authLinks}>
          {isCustomer ? (
            <Link to="/app/perfil" className={`${styles.authLink} ${styles.authLinkPrimary}`}>
              Mi cuenta
            </Link>
          ) : (
            <>
              <Link to="/cuenta/entrar" className={styles.authLink}>
                Iniciar
              </Link>
              <Link to="/cuenta/registro" className={`${styles.authLink} ${styles.authLinkPrimary}`}>
                Registrarse
              </Link>
            </>
          )}
          <Link to="/empresa" className={styles.headerBusinessLink}>
            ¿Eres empresa?
          </Link>
        </div>

        <Link to="/" className={styles.brand} aria-label="Adelia inicio">
          <span className={styles.brandName}>Adelia</span>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
        </Link>
      </header>
      ) : (
        <header className={styles.appHeader}>
          <h1 className={styles.appHeaderTitle}>Explorar</h1>
          <p className={styles.appHeaderText}>Encuentra tu mesa ideal</p>
        </header>
      )}

      <main className={styles.main}>
        {!appMode ? (
        <section className={styles.hero}>
          <p className={styles.heroEyebrow}>Reserva · Opina · Domina</p>
          <h1 className={styles.heroTitle}>Encuentra tu mesa ideal</h1>
          <p className={styles.heroText}>
            Descubre restaurantes y desbloquea promociones exclusivas.
          </p>
        </section>
        ) : null}

        <section className={styles.searchSection}>
          <div className={styles.searchRow}>
            <label className={styles.searchField}>
              <span className={styles.srOnly}>Nombre del restaurante</span>
              <input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSearch()
                  }
                }}
                placeholder="Nombre…"
                className={styles.searchInput}
              />
            </label>

            <CityAutocomplete
              value={selectedCity}
              onChange={setSelectedCity}
              placeholder="Ciudad"
              label="Ciudad"
              compact
            />

            <div className={styles.searchActions}>
              <button
                type="button"
                className={styles.searchButton}
                onClick={handleSearch}
              >
                Buscar
              </button>

              <div className={styles.filterSlot}>
                <DiscoveryTraitsFilter
                  options={traitOptions}
                  value={activeTrait}
                  onChange={handleTraitChange}
                />
              </div>

              <button
                type="button"
                className={locationButtonClassName}
                onClick={handleUseLocation}
                disabled={nearbyState === 'locating'}
              >
                {locationButtonLabel}
              </button>
            </div>
          </div>

          {nearbyMessage && (
            <p
              className={
                nearbyState === 'error'
                  ? styles.locationMessageError
                  : styles.locationMessage
              }
              role="status"
            >
              {nearbyMessage}
            </p>
          )}
        </section>

        {loading && <DiscoverySkeleton />}

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {!loading && !error && filteredRestaurants.length === 0 && (
          <div className={styles.stateBox}>
            {restaurants.length === 0
              ? 'Aún no hay restaurantes publicados en Adelia. Cuando un local complete su perfil y marque su ubicación en el mapa, aparecerá aquí.'
              : 'No encontramos restaurantes con esa búsqueda. Prueba otra ciudad, quita filtros o explora todos.'}
          </div>
        )}

        {!loading && !error && filteredRestaurants.length > 0 && (
          <>
            <section className={`${styles.carouselSection} ${styles.carouselBleed}`}>
              <div className={styles.carouselHeader}>
                <div className={styles.sectionHeader}>
                  <h2>{nearbyActive ? 'Cerca de ti' : 'Para ti hoy'}</h2>
                  <span>{filteredRestaurants.length} restaurantes</span>
                </div>
              </div>
              <RestaurantInfiniteCarousel
                restaurants={primary}
                direction="right"
                distancesKm={nearbyActive ? distancesKm : undefined}
                onOpenRestaurant={setPreviewRestaurant}
              />
            </section>

            <section className={`${styles.carouselSection} ${styles.carouselBleed}`}>
              <div className={styles.carouselHeader}>
                <div className={styles.sectionHeader}>
                  <h2>Descubre más</h2>
                  <span>{nearbyActive ? 'Por distancia' : 'Desliza y elige'}</span>
                </div>
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

        <section className={styles.experienceFlow}>
          <div className={styles.experienceInner}>
            <DiscoveryPromotionsSection />
            <DiscoveryReviewsCallout isCustomer={isCustomer} spotlight={reviewSpotlight} />
            <DiscoveryGamificationBanner
              gamification={gamification}
              isCustomer={isCustomer}
              userName={profile?.displayName}
              userId={user?.uid}
            />
          </div>
        </section>
      </main>

      <RestaurantPreviewSheet
        restaurant={previewRestaurant}
        distanceKm={
          previewRestaurant && nearbyActive
            ? distancesKm[previewRestaurant.slug]
            : undefined
        }
        onClose={() => setPreviewRestaurant(null)}
      />
    </div>
  )
}

export default PublicDiscoveryPage
