import { useCallback, useEffect, useMemo, useState } from 'react'
import { browseListFrom, nearestBrowseList } from '../utils/restaurantBrowse'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import CityAutocomplete from '../components/CityAutocomplete'
import DiscoverySkeleton from '../components/DiscoverySkeleton'
import DiscoveryTraitsFilter from '../components/DiscoveryTraitsFilter'
import DiscoveryVenueKindFilter from '../components/DiscoveryVenueKindFilter'
import { usePromotionCounts } from '../hooks/usePromotionCounts'
import { applyQuickFilters, type QuickFilterId } from '../utils/discoveryQuickFilters'
import LandingBusinessBand from '../components/LandingBusinessBand'
import LandingFaq from '../components/LandingFaq'
import LandingFriends from '../components/LandingFriends'
import LandingNearbyMap from '../components/LandingNearbyMap'
import LandingRewards from '../components/LandingRewards'
import FavoriteRestaurantsRow from '../components/FavoriteRestaurantsRow'
import RestaurantInfiniteCarousel from '../components/RestaurantInfiniteCarousel'
import LegalLinks from '../components/LegalLinks'
import { useAuth } from '../context/AuthContext'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { PROMO_HERO_IMAGE } from '../data/featuredPromotions'
import { LEGAL_CONTACT_EMAIL } from '../content/publicLegal'
import { useFavoriteRestaurants } from '../hooks/useFavoriteRestaurants'
import { fetchPublicDiscoveryRestaurants, mergeDiscoveryRestaurants } from '../services/publicDiscovery'
import type { CitySuggestion } from '../services/citySearch'
import { haversineDistanceKm, type GeoCoordinates } from '../utils/geo'
import { getPostLoginPath } from '../utils/authProfile'
import {
  collectPopularCharacteristics,
  filterDiscoveryRestaurants,
  restaurantHasMapPin,
  restaurantMatchesVenueKind,
  sortRestaurantsByDistance,
  restaurantsForCarouselRows,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { getLocationErrorMessage, requestUserLocation } from '../utils/requestUserLocation'
import type { DiscoveryVenueKind } from '../data/companyProfileFacilities'
import styles from './PublicDiscoveryPage.module.css'
import { friendlyErrorMessage } from '../utils/friendlyError'
import EatNowButton from '../components/EatNowButton'

type NearbyState = 'idle' | 'locating' | 'geocoding' | 'ready' | 'error'

interface PublicDiscoveryPageProps {
  appMode?: boolean
}

function PublicDiscoveryPage({ appMode = false }: PublicDiscoveryPageProps) {
  const navigate = useNavigate()
  const { user, profile, isLoading: authLoading } = useAuth()
  const { favoriteSlugs } = useFavoriteRestaurants()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const promoCounts = usePromotionCounts()
  const [quickFilters, setQuickFilters] = useState<ReadonlySet<QuickFilterId>>(new Set())

  // La portada trae los más valorados; los de tu zona o tu ciudad se piden aparte
  // para que salgan aunque haya miles de restaurantes en Adelia.
  const selectedCityName = selectedCity?.name ?? ''
  useEffect(() => {
    const options = nearbyActive && userCoords
      ? { near: userCoords }
      : selectedCityName
        ? { city: selectedCityName }
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
  }, [nearbyActive, userCoords, selectedCityName])

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

  const isCustomer = profile?.role === 'customer'
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
    const results = applyQuickFilters(
      filterDiscoveryRestaurants(restaurants, effectiveQuery, selectedCity?.name ?? appliedCity)
        .filter((restaurant) => restaurantMatchesVenueKind(restaurant, venueKind)),
      quickFilters,
      { promoCounts },
      { keepOrder: nearbyActive && Boolean(userCoords) },
    )

    if (nearbyActive && userCoords) {
      return sortRestaurantsByDistance(results, distancesKm)
    }

    return results
  }, [restaurants, effectiveQuery, selectedCity, appliedCity, venueKind, nearbyActive, userCoords, distancesKm, quickFilters, promoCounts])

  const { primary, secondary } = useMemo(
    () => restaurantsForCarouselRows(filteredRestaurants),
    [filteredRestaurants],
  )

  const favoriteRestaurants = useMemo(
    () =>
      restaurants
        .filter((restaurant) => favoriteSlugs.includes(restaurant.slug.trim().toLowerCase()))
        .filter((restaurant) => restaurantMatchesVenueKind(restaurant, venueKind)),
    [restaurants, favoriteSlugs, venueKind],
  )

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
        <Link to="/" className={styles.brand} aria-label="Adelia inicio">
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
          <span className={styles.brandName}>Adelia</span>
        </Link>

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
          <Link to="/empresa" className={styles.headerBusinessLink} aria-label="¿Eres empresa?">
            <span className={styles.businessLabelLong}>¿Eres empresa?</span>
            <span className={styles.businessLabelShort} aria-hidden="true">Empresa</span>
          </Link>
        </div>
      </header>
      ) : (
        <header className={styles.appHeader}>
          <h1 className={styles.appHeaderTitle}>Explorar</h1>
          <p className={styles.appHeaderText}>Encuentra tu mesa ideal</p>
        </header>
      )}

      <main className={styles.main}>
        <section className={styles.heroBlock}>
          <img src={PROMO_HERO_IMAGE} alt="" className={styles.heroImage} />
          <div className={styles.heroShade} aria-hidden="true" />
          <div className={styles.heroInner}>
        {!appMode ? (
        <div className={styles.hero}>
          <p className={styles.heroEyebrow}>Reserva · Premios · Compite</p>
          <h1 className={styles.heroTitle}>Tu mesa, con premio</h1>
          <p className={styles.heroText}>
            Reserva sin llamar, consigue descuentos y regalos de cada local y compite con tus amigos.
          </p>
        </div>
        ) : null}

        {/* Para cuando hay prisa: mesa libre para ya mismo. */}
        <EatNowButton className={styles.eatNow} />

        <div className={styles.searchSection}>
          <DiscoveryVenueKindFilter value={venueKind} onChange={setVenueKind} />

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
              key={cityResetKey}
              value={selectedCity}
              onChange={setSelectedCity}
              onTextChange={setCityDraft}
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
        </div>
          </div>
        </section>

        {loading && <DiscoverySkeleton />}

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {!loading && !error && (
          <FavoriteRestaurantsRow
            restaurants={favoriteRestaurants}
            distancesKm={nearbyActive ? distancesKm : undefined}
            onOpenRestaurant={openFrom(favoriteRestaurants)}
          />
        )}

        {!loading && !error && filteredRestaurants.length === 0 && (
          <div className={styles.stateBox} role="status">
            {restaurants.length === 0
              ? 'Aún no hay restaurantes publicados en Adelia. Cuando un local complete su perfil y marque su ubicación en el mapa, aparecerá aquí.'
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
            <section className={`${styles.carouselSection} ${styles.carouselBleed}`}>
              <div className={styles.carouselHeader}>
                <div className={styles.sectionHeader}>
                  <h2>{nearbyActive ? 'Cerca de ti' : 'Restaurantes en Adelia'}</h2>
                  <span>
                    {filteredRestaurants.length}{' '}
                    {filteredRestaurants.length === 1 ? 'restaurante' : 'restaurantes'}
                  </span>
                </div>
              </div>
              <RestaurantInfiniteCarousel
                key={"primary-" + (venueKind || "all")}
                restaurants={primary}
                direction="right"
                distancesKm={nearbyActive ? distancesKm : undefined}
                onOpenRestaurant={openFrom(primary)}
              />
            </section>

            {secondary.length > 0 ? (
              <section className={`${styles.carouselSection} ${styles.carouselBleed}`}>
                <div className={styles.carouselHeader}>
                  <div className={styles.sectionHeader}>
                    <h2>Descubre más</h2>
                    <span>{nearbyActive ? 'A un paso' : 'Desliza y elige'}</span>
                  </div>
                </div>
                <RestaurantInfiniteCarousel
                  restaurants={secondary}
                  direction="left"
                  distancesKm={nearbyActive ? distancesKm : undefined}
                  onOpenRestaurant={openFrom(secondary)}
                />
              </section>
            ) : null}
          </>
        )}

        {!loading && !error ? (
          <LandingNearbyMap restaurants={restaurants} onOpenRestaurant={openNearestIn(restaurants)} />
        ) : null}

        <LandingRewards />

        <section className={styles.experienceFlow}>
          <div className={styles.experienceInner}>
            <LandingFriends isCustomer={isCustomer} />
          </div>
        </section>

        <LandingFaq />

        <LandingBusinessBand />
      </main>

      {!appMode ? (
        <footer className={styles.siteFooter}>
          <div className={styles.footerInner}>
            <div className={styles.footerBrand}>
              <span className={styles.footerLogo}>
                <img src={ADELIA_LOGO_URL} alt="" />
                Adelia
              </span>
              <p>Reserva en restaurantes, consigue premios y compite con tus amigos.</p>
            </div>
            <nav className={styles.footerColumn} aria-label="Adelia">
              <h2>Adelia</h2>
              <Link to="/cuenta/registro">Crear cuenta</Link>
              <Link to="/cuenta/entrar">Iniciar sesión</Link>
            </nav>
            <nav className={styles.footerColumn} aria-label="Restaurantes">
              <h2>Restaurantes</h2>
              <Link to="/empresa">Adelia para restaurantes</Link>
              <Link to="/empresa/planes">Planes y precios</Link>
              <Link to="/empresa/alta">Dar de alta mi local</Link>
            </nav>
            <div className={styles.footerColumn}>
              <h2>Legal</h2>
              <LegalLinks from="/" variant="sidebar" />
            </div>
            <div className={styles.footerColumn}>
              <h2>Contacto</h2>
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
            </div>
          </div>
          <p className={styles.footerCopy}>© {new Date().getFullYear()} Adelia</p>
        </footer>
      ) : null}
    </div>
  )
}

export default PublicDiscoveryPage
