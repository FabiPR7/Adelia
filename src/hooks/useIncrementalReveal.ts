import { useEffect, useRef, useState } from 'react'
import { nextNearbyFeedCount } from '../utils/nearbyRestaurantFeed'

/**
 * Muestra la lista poco a poco: arranca con `pageSize` elementos y añade otros
 * `pageSize` cada vez que el usuario se acerca al final (IntersectionObserver
 * sobre un centinela). Evita renderizar y cargar imágenes de golpe.
 *
 * `resetKey` reinicia el conteo cuando cambia (p. ej. al cambiar de filtro).
 */
export function useIncrementalReveal(
  total: number,
  resetKey: unknown,
  pageSize = 10,
) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(pageSize, total))
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setVisibleCount(Math.min(pageSize, total))
  }, [resetKey, pageSize, total])

  const hasMore = visibleCount < total

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || !hasMore) {
      return
    }

    if (typeof IntersectionObserver !== 'function') {
      setVisibleCount(total)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return
        }
        observer.disconnect()
        setVisibleCount((current) => nextNearbyFeedCount(current, total, pageSize))
      },
      { rootMargin: '600px 0px' },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasMore, visibleCount, total, pageSize])

  return { visibleCount, sentinelRef, hasMore }
}
