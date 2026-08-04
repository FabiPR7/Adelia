import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import CityAutocomplete from '../components/CityAutocomplete'
import DiscoveryGamificationBanner from '../components/DiscoveryGamificationBanner'
import DiscoveryReviewsCallout from '../components/DiscoveryReviewsCallout'
import DiscoveryListView from '../components/DiscoveryListView'
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
import {
  collectPopularCharacteristics,
  filterDiscoveryRestaurants,
  splitRestaurantsForCarousels,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { getMockAdelinaReviewCount, getMockReviewRating } from '../utils/mockReviewRating'
import styles from './PublicDiscoveryPage.module.css'

type ViewMode = 'carousel' | 'list'

function PublicDiscoveryPage() {
  const { user, profile, isLoading: authLoading } = useAuth()
  const { isFavorite, toggleFavorite, favoriteSlugs } = useFavoriteRestaurants()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null)
  const [activeTrait, setActiveTrait] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('carousel')
  const [previewRestaurant, setPreviewRestaurant] = useState<PublicDiscoveryRestaurant | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [promotionCompanyIds, setPromotionCompanyIds] = useState<Set<string>>(new Set())

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

  const filteredRestaurants = useMemo(() => {
    let results = filterDiscoveryRestaurants(restaurants, effectiveQuery, selectedCity?.name ?? '')

    if (showFavoritesOnly) {
      results = results.filter((restaurant) => isFavorite(restaurant.slug))
    }

    return results
  }, [restaurants, effectiveQuery, selectedCity, showFavoritesOnly, isFavorite])

  const { primary, secondary } = useMemo(
    () => splitRestaurantsForCarousels(filteredRestaurants),
    [filteredRestaurants],
  )

  const reviewSpotlight = useMemo(() => {
    const favoriteRestaurant = restaurants.find((restaurant) => favoriteSlugs.includes(restaurant.slug))
    const pick = favoriteRestaurant ?? restaurants[0]

    if (!pick) {
      return null
    }

    return {
      name: pick.name,
      reviewRating: getMockReviewRating(pick.slug),
      adelinaCount: getMockAdelinaReviewCount(pick.slug),
      isFavorite: Boolean(favoriteRestaurant),
    }
  }, [restaurants, favoriteSlugs])

  const handleSearch = () => {
    setAppliedSearch(searchDraft.trim())
    setActiveTrait('')
  }

  const handleTraitChange = (trait: string) => {
    setActiveTrait(trait)
    setSearchDraft('')
    setAppliedSearch('')
  }

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setSearchDraft('')
        setAppliedSearch('')
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  if (!authLoading && user && profile && profile.role !== 'customer') {
    return <Navigate to={getPostLoginPath(profile)} replace />
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.authLinks}>
          {isCustomer ? (
            <Link to="/cuenta" className={`${styles.authLink} ${styles.authLinkPrimary}`}>
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
          <Link to="/login" className={styles.headerBusinessLink}>
            ¿Eres empresa?
          </Link>
        </div>

        <Link to="/" className={styles.brand} aria-label="Adelia inicio">
          <span className={styles.brandName}>Adelia</span>
          <img src={ADELIA_LOGO_URL} alt="" className={styles.logo} />
        </Link>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.heroEyebrow}>Reserva mesa en segundos</p>
          <h1 className={styles.heroTitle}>Encuentra tu mesa ideal</h1>
          <p className={styles.heroText}>
            Descubre restaurantes, guarda favoritos y desbloquea promociones exclusivas.
          </p>
          {!loading && restaurants.length > 0 && (
            <p className={styles.socialProof}>
              {restaurants.length} restaurantes activos en Adelia
            </p>
          )}
        </section>

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

              <DiscoveryTraitsFilter
                options={traitOptions}
                value={activeTrait}
                onChange={handleTraitChange}
              />
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={viewMode === 'carousel' ? styles.viewButtonActive : styles.viewButton}
                onClick={() => setViewMode('carousel')}
              >
                Carrusel
              </button>
              <button
                type="button"
                className={viewMode === 'list' ? styles.viewButtonActive : styles.viewButton}
                onClick={() => setViewMode('list')}
              >
                Lista
              </button>
            </div>

            <button type="button" className={styles.locationButton} onClick={handleUseLocation}>
              📍 Cerca
            </button>

            <button
              type="button"
              className={showFavoritesOnly ? styles.favoritesActive : styles.favoritesButton}
              onClick={() => setShowFavoritesOnly((current) => !current)}
            >
              ♥ Favoritos
            </button>
          </div>
        </section>

        {loading && <DiscoverySkeleton />}

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {!loading && !error && filteredRestaurants.length === 0 && (
          <div className={styles.stateBox}>
            No encontramos restaurantes con esa búsqueda. Prueba otra ciudad, quita filtros o explora todos.
          </div>
        )}

        {!loading && !error && filteredRestaurants.length > 0 && viewMode === 'carousel' && (
          <>
            <section className={`${styles.carouselSection} ${styles.carouselBleed}`}>
              <div className={styles.carouselHeader}>
                <div className={styles.sectionHeader}>
                  <h2>Para ti hoy</h2>
                  <span>{filteredRestaurants.length} restaurantes</span>
                </div>
              </div>
              <RestaurantInfiniteCarousel
                restaurants={primary}
                direction="right"
                onOpenRestaurant={setPreviewRestaurant}
                isFavorite={isFavorite}
                onToggleFavorite={(slug) => void toggleFavorite(slug)}
              />
            </section>

            <section className={`${styles.carouselSection} ${styles.carouselBleed}`}>
              <div className={styles.carouselHeader}>
                <div className={styles.sectionHeader}>
                  <h2>Descubre más</h2>
                  <span>Desliza y elige</span>
                </div>
              </div>
              <RestaurantInfiniteCarousel
                restaurants={secondary}
                direction="left"
                onOpenRestaurant={setPreviewRestaurant}
                isFavorite={isFavorite}
                onToggleFavorite={(slug) => void toggleFavorite(slug)}
              />
            </section>
          </>
        )}

        {!loading && !error && filteredRestaurants.length > 0 && viewMode === 'list' && (
          <section className={styles.listSection}>
            <DiscoveryListView
              restaurants={filteredRestaurants}
              onOpenRestaurant={setPreviewRestaurant}
              isFavorite={isFavorite}
              onToggleFavorite={(slug) => void toggleFavorite(slug)}
            />
          </section>
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
        isFavorite={previewRestaurant ? isFavorite(previewRestaurant.slug) : false}
        onClose={() => setPreviewRestaurant(null)}
        onToggleFavorite={() => {
          if (previewRestaurant) {
            void toggleFavorite(previewRestaurant.slug)
          }
        }}
      />
    </div>
  )
}

export default PublicDiscoveryPage
