import { Link, Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import GamificationLevelCard from '../components/GamificationLevelCard'
import MissionsHub from '../components/MissionsHub'
import { useAuth } from '../context/AuthContext'
import { useCustomerGamificationContext } from '../context/CustomerGamificationContext'
import { logout } from '../services/auth'
import { fetchPublicDiscoveryRestaurants } from '../services/publicDiscovery'
import { getCustomerReservations } from '../services/firestore'
import { ADELIA_LOGO_URL } from '../constants/brand'
import { useFavoriteRestaurants } from '../hooks/useFavoriteRestaurants'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import styles from './CustomerAccountPage.module.css'

function CustomerAccountPage() {
  const { user, profile, isLoading } = useAuth()
  const { favoriteSlugs, toggleFavorite } = useFavoriteRestaurants()
  const gamification = useCustomerGamificationContext()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [reservations, setReservations] = useState<Awaited<ReturnType<typeof getCustomerReservations>>>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!profile || profile.role !== 'customer') {
      return
    }

    let cancelled = false

    void Promise.all([
      fetchPublicDiscoveryRestaurants(),
      getCustomerReservations(profile.email),
    ])
      .then(([restaurantData, reservationData]) => {
        if (!cancelled) {
          setRestaurants(restaurantData)
          setReservations(reservationData)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingData(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile])

  const favoriteRestaurants = useMemo(
    () => restaurants.filter((restaurant) => favoriteSlugs.includes(restaurant.slug)),
    [restaurants, favoriteSlugs],
  )

  const upcomingReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) =>
          reservation.status !== 'cancelled' && reservation.startTime.getTime() >= Date.now(),
      ),
    [reservations],
  )

  if (!isLoading && (!user || !profile || profile.role !== 'customer')) {
    return <Navigate to="/cuenta/entrar" replace />
  }

  if (isLoading || loadingData) {
    return <div className={styles.loading}>Cargando tu cuenta…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>
          ← Explorar
        </Link>
        <div className={styles.brand}>
          <img src={ADELIA_LOGO_URL} alt="" />
          <span>Mi cuenta</span>
        </div>
        <button
          type="button"
          className={styles.logoutButton}
          onClick={() => void logout()}
        >
          Salir
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Hola, {profile?.displayName || 'foodie'}</p>
          <h1>Tu perfil Adelia</h1>
          <p className={styles.heroText}>
            Sube de nivel con misiones y desbloquea regalos exclusivos para tu perfil.
          </p>
        </section>

        <section className={styles.block}>
          <GamificationLevelCard
            level={gamification.level}
            xp={gamification.state.xp}
            levelProgress={gamification.levelProgress}
            xpToNext={gamification.xpToNext}
            unlockedRewards={gamification.unlockedRewards}
            epic
            celebrate={gamification.celebrations.levelJustUp || gamification.celebrations.rankJustImproved}
          />
        </section>

        <section className={styles.block}>
          <MissionsHub
            weeklyProgress={gamification.weeklyProgress}
            monthlyProgress={gamification.monthlyProgress}
            historicalProgress={gamification.historicalProgress}
            weeklyBonus={gamification.weeklyBonus}
            showExploreLink={false}
          />
        </section>

        <section className={styles.block}>
          <div className={styles.blockHeader}>
            <h2>Próximas reservas</h2>
            <span>{upcomingReservations.length}</span>
          </div>

          {upcomingReservations.length === 0 ? (
            <div className={styles.emptyBox}>
              Aún no tienes reservas próximas.{' '}
              <Link to="/">Explora restaurantes</Link>
            </div>
          ) : (
            <div className={styles.list}>
              {upcomingReservations.slice(0, 5).map((reservation) => {
                const restaurant = restaurants.find((item) => item.id === reservation.companyId)

                return (
                  <article key={reservation.id} className={styles.reservationCard}>
                    <div>
                      <h3>{restaurant?.name ?? 'Restaurante'}</h3>
                      <p>
                        {reservation.startTime.toLocaleDateString('es-ES', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        ·{' '}
                        {reservation.startTime.toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p>{reservation.pax} personas</p>
                    </div>
                    {restaurant && (
                      <Link to={`/reservar/${restaurant.slug}`} className={styles.smallButton}>
                        Ver
                      </Link>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className={styles.block}>
          <div className={styles.blockHeader}>
            <h2>Favoritos</h2>
            <span>{favoriteRestaurants.length}</span>
          </div>

          {favoriteRestaurants.length === 0 ? (
            <div className={styles.emptyBox}>
              Guarda restaurantes con el corazón en la página principal.
            </div>
          ) : (
            <div className={styles.favoritesGrid}>
              {favoriteRestaurants.map((restaurant) => (
                <article key={restaurant.id} className={styles.favoriteCard}>
                  <Link to={`/reservar/${restaurant.slug}`}>
                    <h3>{restaurant.name}</h3>
                    <p>{restaurant.municipality || restaurant.location}</p>
                  </Link>
                  <button
                    type="button"
                    className={styles.unfavoriteButton}
                    onClick={() => void toggleFavorite(restaurant.slug)}
                  >
                    Quitar
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <Link to="/" className={styles.promoCta}>
          Ver promociones y reservar
        </Link>
      </main>
    </div>
  )
}

export default CustomerAccountPage
