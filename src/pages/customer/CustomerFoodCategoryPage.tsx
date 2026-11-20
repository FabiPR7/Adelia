import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import NearbyRestaurantFeedCard from '../../components/NearbyRestaurantFeedCard'
import FoodCategoryButtons from '../../components/discovery/FoodCategoryButtons'
import DiscoverySkeleton from '../../components/DiscoverySkeleton'
import { findFoodCategory, restaurantMatchesFoodCategory } from '../../data/foodCategories'
import { fetchPublicDiscoveryRestaurants, mergeDiscoveryRestaurants } from '../../services/publicDiscovery'
import type { PublicDiscoveryRestaurant } from '../../utils/publicDiscovery'
import styles from './CustomerFoodCategoryPage.module.css'

function normalizePlace(value: string | undefined | null): string {
  return (value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/** Restaurantes de un tipo de comida (Hamburguesas, Pinchos, Woks…). */
function CustomerFoodCategoryPage() {
  const { categoryId = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const category = findFoodCategory(categoryId)
  const homeCity = profile?.homeMunicipality || profile?.homeCity || ''
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const requests = [
      fetchPublicDiscoveryRestaurants(),
      ...(homeCity ? [fetchPublicDiscoveryRestaurants({ city: homeCity }).catch(() => [])] : []),
    ]
    void Promise.all(requests)
      .then(([general, ...extra]) => {
        if (cancelled) return
        setRestaurants(extra.reduce((all, items) => mergeDiscoveryRestaurants(all, items), general))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar los restaurantes.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [homeCity])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [categoryId])

  const matching = useMemo(() => {
    if (!category) return []
    const city = normalizePlace(homeCity)
    const list = restaurants.filter((restaurant) => restaurantMatchesFoodCategory(restaurant, category))
    // Primero los de tu ciudad.
    const isHome = (restaurant: PublicDiscoveryRestaurant) =>
      Boolean(city) && normalizePlace(restaurant.municipality) === city
    return [...list.filter(isHome), ...list.filter((restaurant) => !isHome(restaurant))]
  }, [restaurants, category, homeCity])

  const openRestaurant = (restaurant: PublicDiscoveryRestaurant) => navigate(`/reservar/${restaurant.slug}`)

  if (!category) {
    return (
      <div className={styles.page}>
        <div className={styles.state} role="status">
          No conocemos ese tipo de comida.
          <Link to="/app/explorar" className={styles.stateAction}>Volver a explorar</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/app/explorar" className={styles.back} aria-label="Volver a explorar">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <span className={styles.emoji} aria-hidden="true">{category.emoji}</span>
        <div className={styles.titles}>
          <p className={styles.kicker}>¿Qué te apetece?</p>
          <h1 className={styles.title}>{category.label}</h1>
          {!loading && !error ? (
            <p className={styles.count}>
              {matching.length === 1 ? '1 restaurante' : `${matching.length} restaurantes`}
            </p>
          ) : null}
        </div>
      </header>

      <FoodCategoryButtons restaurants={restaurants} activeId={category.id} title={null} />

      <main className={styles.main}>
        {loading ? <DiscoverySkeleton /> : null}

        {error ? (
          <div className={styles.error} role="alert">{error}</div>
        ) : null}

        {!loading && !error && matching.length === 0 ? (
          <div className={styles.state} role="status">
            Aún no hay restaurantes de {category.label.toLowerCase()} en Adelia. Prueba otro tipo de comida.
            <Link to="/app/explorar" className={styles.stateAction}>Ver todos los restaurantes</Link>
          </div>
        ) : null}

        {!loading && !error && matching.length > 0 ? (
          <ul className={styles.grid}>
            {matching.map((restaurant) => (
              <li key={restaurant.slug}>
                <NearbyRestaurantFeedCard restaurant={restaurant} onOpen={openRestaurant} />
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  )
}

export default CustomerFoodCategoryPage
