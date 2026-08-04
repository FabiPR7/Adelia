import { useEffect, useRef } from 'react'
import RestaurantDiscoveryCard from './RestaurantDiscoveryCard'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { getMockReviewRating } from '../utils/mockReviewRating'
import styles from './RestaurantInfiniteCarousel.module.css'

interface RestaurantInfiniteCarouselProps {
  restaurants: PublicDiscoveryRestaurant[]
  direction: 'left' | 'right'
  distancesKm?: Record<string, number>
  onOpenRestaurant: (restaurant: PublicDiscoveryRestaurant) => void
}

const SCROLL_SPEED_PX_PER_SECOND = 72

function normalizeOffset(offset: number, period: number): number {
  if (period <= 0) {
    return 0
  }

  return ((offset % period) + period) % period
}

function expandRestaurantsForCarousel(
  restaurants: PublicDiscoveryRestaurant[],
  minimum = 8,
): PublicDiscoveryRestaurant[] {
  if (restaurants.length === 0) {
    return restaurants
  }

  if (restaurants.length >= minimum) {
    return restaurants
  }

  const expanded: PublicDiscoveryRestaurant[] = []

  while (expanded.length < minimum) {
    expanded.push(...restaurants)
  }

  return expanded.slice(0, minimum)
}

function RestaurantInfiniteCarousel({
  restaurants,
  direction,
  distancesKm,
  onOpenRestaurant,
}: RestaurantInfiniteCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const totalOffsetRef = useRef(0)
  const periodRef = useRef(0)

  useEffect(() => {
    const track = trackRef.current
    const group = groupRef.current

    if (!track || !group || restaurants.length === 0) {
      return
    }

    totalOffsetRef.current = 0
    periodRef.current = 0
    track.style.transform = 'translate3d(0, 0, 0)'

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      track.style.transform = 'none'
      return
    }

    let frameId = 0
    let lastTimestamp = performance.now()
    const directionMultiplier = direction === 'left' ? 1 : -1

    const measurePeriod = () => {
      const groupWidth = group.getBoundingClientRect().width
      const trackGap = Number.parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') || 0
      periodRef.current = groupWidth + trackGap
    }

    measurePeriod()

    const resizeObserver = new ResizeObserver(() => {
      measurePeriod()
    })

    resizeObserver.observe(group)
    resizeObserver.observe(track)

    const step = (timestamp: number) => {
      const period = periodRef.current

      if (period > 0) {
        const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05)
        lastTimestamp = timestamp

        totalOffsetRef.current += directionMultiplier * SCROLL_SPEED_PX_PER_SECOND * deltaSeconds

        const visualOffset = normalizeOffset(totalOffsetRef.current, period)
        track.style.transform = `translate3d(${-visualOffset}px, 0, 0)`
      }

      frameId = window.requestAnimationFrame(step)
    }

    frameId = window.requestAnimationFrame(step)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
    }
  }, [restaurants, direction])

  if (restaurants.length === 0) {
    return null
  }

  const carouselRestaurants = expandRestaurantsForCarousel(restaurants)

  const renderGroup = (prefix: string) =>
    carouselRestaurants.map((restaurant) => (
      <RestaurantDiscoveryCard
        key={`${prefix}-${restaurant.id}`}
        restaurant={restaurant}
        onOpen={onOpenRestaurant}
        reviewRating={getMockReviewRating(restaurant.slug)}
        distanceKm={distancesKm?.[restaurant.slug]}
      />
    ))

  return (
    <div className={styles.viewport}>
      <div className={styles.track} ref={trackRef}>
        <div className={styles.group} ref={groupRef}>
          {renderGroup('a')}
        </div>
        <div className={styles.group} aria-hidden="true">
          {renderGroup('b')}
        </div>
        <div className={styles.group} aria-hidden="true">
          {renderGroup('c')}
        </div>
      </div>
    </div>
  )
}

export default RestaurantInfiniteCarousel
