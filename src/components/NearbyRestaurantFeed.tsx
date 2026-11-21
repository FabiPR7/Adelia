import { useEffect, useMemo, useRef, useState } from 'react'
import NearbyRestaurantFeedCard from './NearbyRestaurantFeedCard'
import {
  sortRestaurantsByDistance,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { nextNearbyFeedCount, NEARBY_FEED_PAGE_SIZE, sliceNearbyFeed } from '../utils/nearbyRestaurantFeed'
import type { GeoCoordinates } from '../utils/geo'
import styles from './NearbyRestaurantFeed.module.css'

interface NearbyRestaurantFeedProps {
  restaurants: PublicDiscoveryRestaurant[]
  origin: GeoCoordinates | null
  distancesKm: Record<string, number>
  locating?: boolean
  onRequestLocation: () => void
  onOpenRestaurant: (restaurant: PublicDiscoveryRestaurant) => void
  /** Quedan más restaurantes en el servidor (se piden al llegar al final). */
  hasMoreRemote?: boolean
  loadingMoreRemote?: boolean
  onLoadMoreRemote?: () => void
}

function NearbyRestaurantFeed({
  restaurants,
  origin,
  distancesKm,
  locating = false,
  onRequestLocation,
  onOpenRestaurant,
  hasMoreRemote = false,
  loadingMoreRemote = false,
  onLoadMoreRemote,
}: NearbyRestaurantFeedProps) {
  const [visibleCount, setVisibleCount] = useState(NEARBY_FEED_PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const restaurantKey = useMemo(
    () => restaurants.map((restaurant) => restaurant.slug).join('|'),
    [restaurants],
  )

  const sorted = useMemo(
    () => (origin ? sortRestaurantsByDistance(restaurants, distancesKm) : restaurants),
    [restaurants, distancesKm, origin],
  )

  useEffect(() => {
    setVisibleCount(Math.min(NEARBY_FEED_PAGE_SIZE, sorted.length))
  }, [restaurantKey, origin?.lat, origin?.lng, sorted.length])

  const visible = sliceNearbyFeed(sorted, visibleCount)
  const hasMoreLocal = visibleCount < sorted.length
  const hasMore = hasMoreLocal || hasMoreRemote

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || !hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return
        }

        observer.disconnect()
        if (hasMoreLocal) {
          setVisibleCount((current) => nextNearbyFeedCount(current, sorted.length))
        } else if (!loadingMoreRemote) {
          onLoadMoreRemote?.()
        }
      },
      { rootMargin: '160px 0px' },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasMore, hasMoreLocal, loadingMoreRemote, onLoadMoreRemote, visibleCount, sorted.length])

  if (sorted.length === 0) {
    return null
  }

  return (
    <section className={styles.section} aria-labelledby="nearby-feed-heading">
      <div className={styles.heading}>
        <h2 id="nearby-feed-heading">Todos los restaurantes</h2>
        <span>{origin ? 'Del más cercano al más lejano' : 'Los mejores primero'}</span>
      </div>

      {!origin ? (
        <button
          type="button"
          className={styles.locate}
          onClick={onRequestLocation}
          disabled={locating}
        >
          {locating ? 'Buscando tu zona…' : 'Mostrar cerca de mí'}
        </button>
      ) : null}

      <ul className={styles.list}>
        {visible.map((restaurant) => (
          <li key={restaurant.slug}>
            <NearbyRestaurantFeedCard
              restaurant={restaurant}
              distanceKm={origin ? distancesKm[restaurant.slug] : undefined}
              onOpen={onOpenRestaurant}
            />
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true">
          Más sitios…
        </div>
      ) : (
        <p className={styles.end}>Eso es todo por ahora.</p>
      )}
    </section>
  )
}

export default NearbyRestaurantFeed
