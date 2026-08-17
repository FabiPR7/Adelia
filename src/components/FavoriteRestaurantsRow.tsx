import RestaurantDiscoveryCard from './RestaurantDiscoveryCard'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import styles from './FavoriteRestaurantsRow.module.css'

interface FavoriteRestaurantsRowProps {
  restaurants: PublicDiscoveryRestaurant[]
  distancesKm?: Record<string, number>
  onOpenRestaurant: (restaurant: PublicDiscoveryRestaurant) => void
}

function FavoriteRestaurantsRow({
  restaurants,
  distancesKm,
  onOpenRestaurant,
}: FavoriteRestaurantsRowProps) {
  if (restaurants.length === 0) {
    return null
  }

  return (
    <section className={styles.section} aria-label="Tus restaurantes favoritos">
      <div className={styles.header}>
        <h2>Tus favoritos</h2>
        <span>{restaurants.length}</span>
      </div>
      <div className={styles.scroller}>
        {restaurants.map((restaurant) => (
          <RestaurantDiscoveryCard
            key={restaurant.id}
            restaurant={restaurant}
            onOpen={onOpenRestaurant}
            distanceKm={distancesKm?.[restaurant.slug]}
          />
        ))}
      </div>
    </section>
  )
}

export default FavoriteRestaurantsRow
