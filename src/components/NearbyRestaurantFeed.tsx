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
}

function NearbyRestaurantFeed({
  restaurants,
  origin,
  distancesKm,
  locating = false,
  onRequestLocation,
  onOpenRestaurant,
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
  const hasMore = visibleCount < sorted.length

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
        setVisibleCount((current) => nextNearbyFeedCount(current, sorted.length))
      },
      { rootMargin: '160px 0px' },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasMore, visibleCount, sorted.length])

  if (sorted.length === 0) {
    return null
  }

  return (
    <section className={styles.section} aria-labelledby="nearby-feed-heading">
      <div className={styles.heading}>
        <h2 id="nearby-feed-heading">Por aquí cerca</h2>
        <span>{origin ? 'Lo que tienes a mano' : 'Sigue bajando'}</span>
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
