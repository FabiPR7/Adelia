import { useEffect, useRef } from 'react'
import RestaurantDiscoveryCard from './RestaurantDiscoveryCard'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { restaurantCarouselItemKey, wrapCarouselOffset } from '../utils/restaurantCarousel'
import styles from './RestaurantInfiniteCarousel.module.css'

interface RestaurantInfiniteCarouselProps {
  restaurants: PublicDiscoveryRestaurant[]
  direction: 'left' | 'right'
  distancesKm?: Record<string, number>
  onOpenRestaurant: (restaurant: PublicDiscoveryRestaurant) => void
}

const SCROLL_SPEED_PX_PER_SECOND = 28
const RESUME_DELAY_MS = 1100
const DRAG_THRESHOLD_PX = 8

function duplicateUntilMinimum(
  restaurants: PublicDiscoveryRestaurant[],
  minimum = 8,
): PublicDiscoveryRestaurant[] {
  if (restaurants.length === 0 || restaurants.length >= minimum) {
    return restaurants
  }

  const duplicated: PublicDiscoveryRestaurant[] = []

  while (duplicated.length < minimum) {
    duplicated.push(...restaurants)
  }

  return duplicated.slice(0, minimum)
}

function RestaurantInfiniteCarousel({
  restaurants,
  direction,
  distancesKm,
  onOpenRestaurant,
}: RestaurantInfiniteCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    const group = groupRef.current

    if (!viewport || !track || !group || restaurants.length === 0) {
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const periodRef = { current: 0 }
    const offsetRef = { current: 0 }
    const pausedRef = { current: prefersReducedMotion }
    const suppressClickRef = { current: false }
    const activePointers = new Set<number>()
    let frameId = 0
    let resumeTimer = 0
    let lastTimestamp = performance.now()
    let dragPointerId: number | null = null
    let dragStartX = 0
    let dragStartOffset = 0
    let dragging = false

    const measurePeriod = () => {
      const groupWidth = group.getBoundingClientRect().width
      const trackGap = Number.parseFloat(getComputedStyle(track).gap || '0') || 0
      periodRef.current = groupWidth + trackGap
    }

    const render = () => {
      const period = periodRef.current
      if (period > 0) {
        offsetRef.current = wrapCarouselOffset(offsetRef.current, period)
      }
      track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
    }

    const pauseAutoplay = (scheduleResume: boolean) => {
      pausedRef.current = true
      window.clearTimeout(resumeTimer)

      if (prefersReducedMotion || !scheduleResume) {
        return
      }

      resumeTimer = window.setTimeout(() => {
        if (activePointers.size > 0) {
          return
        }

        pausedRef.current = false
        lastTimestamp = performance.now()
      }, RESUME_DELAY_MS)
    }

    measurePeriod()
    offsetRef.current = periodRef.current
    render()

    const resizeObserver = new ResizeObserver(() => {
      const previousPeriod = periodRef.current
      const previousOffset = offsetRef.current
      measurePeriod()

      if (periodRef.current <= 0) {
        return
      }

      if (previousPeriod > 0) {
        const relative = previousOffset - previousPeriod
        offsetRef.current = periodRef.current + relative
      } else {
        offsetRef.current = periodRef.current
      }
      render()
    })

    resizeObserver.observe(group)
    resizeObserver.observe(viewport)

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) {
        return
      }
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return
      }

      activePointers.add(event.pointerId)
      pauseAutoplay(false)
      dragPointerId = event.pointerId
      dragStartX = event.clientX
      dragStartOffset = offsetRef.current
      dragging = false
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragPointerId) {
        return
      }

      const deltaX = event.clientX - dragStartX

      if (!dragging) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
          return
        }

        dragging = true
        suppressClickRef.current = true
        viewport.classList.add(styles.dragging)
        viewport.setPointerCapture(event.pointerId)
      }

      offsetRef.current = dragStartOffset - deltaX
      render()
    }

    const releasePointer = (event: PointerEvent) => {
      if (!activePointers.delete(event.pointerId) && event.pointerId !== dragPointerId) {
        return
      }

      if (event.pointerId === dragPointerId) {
        if (viewport.hasPointerCapture(event.pointerId)) {
          viewport.releasePointerCapture(event.pointerId)
        }

        dragPointerId = null
        dragging = false
        viewport.classList.remove(styles.dragging)
      }

      pauseAutoplay(activePointers.size === 0)
    }

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClickRef.current) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      suppressClickRef.current = false
    }

    const step = (timestamp: number) => {
      const elapsedSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05)
      lastTimestamp = timestamp

      if (!pausedRef.current && periodRef.current > 0) {
        const signedDelta =
          (direction === 'left' ? 1 : -1) * SCROLL_SPEED_PX_PER_SECOND * elapsedSeconds
        offsetRef.current += signedDelta
        render()
      }

      frameId = window.requestAnimationFrame(step)
    }

    viewport.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', releasePointer)
    window.addEventListener('pointercancel', releasePointer)
    viewport.addEventListener('click', onClickCapture, true)

    if (!prefersReducedMotion) {
      frameId = window.requestAnimationFrame(step)
    }

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(resumeTimer)
      resizeObserver.disconnect()
      viewport.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', releasePointer)
      window.removeEventListener('pointercancel', releasePointer)
      viewport.removeEventListener('click', onClickCapture, true)
      viewport.classList.remove(styles.dragging)
      track.style.transform = ''
    }
  }, [restaurants, direction])

  if (restaurants.length === 0) {
    return null
  }

  const carouselRestaurants = duplicateUntilMinimum(restaurants)

  const renderGroup = (prefix: string) =>
    carouselRestaurants.map((restaurant, index) => (
      <RestaurantDiscoveryCard
        key={restaurantCarouselItemKey(prefix, restaurant.id, index)}
        restaurant={restaurant}
        onOpen={onOpenRestaurant}
        distanceKm={distancesKm?.[restaurant.slug]}
      />
    ))

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      aria-label="Carrusel de restaurantes"
    >
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
