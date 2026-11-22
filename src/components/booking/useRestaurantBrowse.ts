import { useCallback, useEffect, useMemo, useRef, type TouchEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { browseNeighbors, sanitizeBrowse, type BrowseNeighbors } from '../../utils/restaurantBrowse'

// Pasar a la ficha siguiente/anterior de la sección desde la que se abrió
// (carrusel, mapa, tipo de comida…), igual que en la app: deslizando en el
// móvil, con las flechas «‹ 3 de 12 ›» o con las flechas del teclado.

interface BrowseState {
  browse?: unknown
  enter?: unknown
}

export interface RestaurantBrowse {
  neighbors: BrowseNeighbors | null
  /** De qué lado ha entrado esta ficha (para la animación). */
  enter: 'next' | 'prev' | null
  goTo: (direction: 'next' | 'prev') => void
  touchHandlers: {
    onTouchStart: (event: TouchEvent<HTMLElement>) => void
    onTouchMove: (event: TouchEvent<HTMLElement>) => void
    onTouchEnd: (event: TouchEvent<HTMLElement>) => void
  }
}

const SWIPE_MIN_PX = 80

export function useRestaurantBrowse(slug: string, pageRef: React.RefObject<HTMLElement | null>): RestaurantBrowse {
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state ?? {}) as BrowseState
  const browse = useMemo(() => sanitizeBrowse(state.browse), [state.browse])
  const neighbors = useMemo(() => browseNeighbors(browse, slug), [browse, slug])
  const enter = state.enter === 'next' || state.enter === 'prev' ? state.enter : null

  const goTo = useCallback(
    (direction: 'next' | 'prev') => {
      const target = direction === 'next' ? neighbors?.next : neighbors?.prev
      if (!target || !browse) return
      navigate(`/reservar/${target}`, { replace: true, state: { browse, enter: direction } })
      window.scrollTo({ top: 0 })
    },
    [browse, navigate, neighbors],
  )

  // Teclado: ← y → (salvo escribiendo en un campo).
  useEffect(() => {
    if (!neighbors) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (event.key === 'ArrowRight') goTo('next')
      if (event.key === 'ArrowLeft') goTo('prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, neighbors])

  // Dedo: la ficha sigue el gesto en horizontal y al soltar lejos cambia.
  const start = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null)
  const setOffset = (px: number, animate: boolean) => {
    const element = pageRef.current
    if (!element) return
    element.style.transition = animate ? 'transform 200ms ease-out' : 'none'
    element.style.transform = px ? `translateX(${px}px)` : ''
  }

  const touchHandlers = {
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      if (!neighbors || event.touches.length !== 1) return
      // No robar el gesto a carruseles y listas horizontales.
      if ((event.target as HTMLElement).closest('[data-hscroll], [data-no-browse-swipe]')) return
      start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, horizontal: null }
    },
    onTouchMove: (event: TouchEvent<HTMLElement>) => {
      const s = start.current
      if (!s) return
      const dx = event.touches[0].clientX - s.x
      const dy = event.touches[0].clientY - s.y
      if (s.horizontal === null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
        s.horizontal = Math.abs(dx) > Math.abs(dy) * 2
      }
      if (!s.horizontal) return
      const blocked = (dx < 0 && !neighbors?.next) || (dx > 0 && !neighbors?.prev)
      setOffset(blocked ? dx * 0.15 : dx * 0.6, false)
    },
    onTouchEnd: (event: TouchEvent<HTMLElement>) => {
      const s = start.current
      start.current = null
      if (!s?.horizontal) return
      const dx = event.changedTouches[0].clientX - s.x
      setOffset(0, true)
      if (dx <= -SWIPE_MIN_PX && neighbors?.next) goTo('next')
      else if (dx >= SWIPE_MIN_PX && neighbors?.prev) goTo('prev')
    },
  }

  return { neighbors, enter, goTo, touchHandlers }
}
