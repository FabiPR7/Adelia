import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TransitionEvent,
} from 'react'
import { paginateByWidths } from '../../utils/paginateByWidths'
import styles from './SlidingFitRow.module.css'

const HOLD_MS = 3200

interface SlidingFitRowProps {
  children: ReactNode
  ariaLabel: string
  className?: string
  holdMs?: number
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function SlidingFitRow({
  children,
  ariaLabel,
  className = '',
  holdMs = HOLD_MS,
}: SlidingFitRowProps) {
  const childArray = Children.toArray(children)
  const childSignature = childArray
    .map((child) => (isValidElement(child) ? String(child.key ?? '') : ''))
    .join('|')
  const viewportRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLUListElement>(null)
  const pausedRef = useRef(false)
  const pagesSignatureRef = useRef('')
  const [pages, setPages] = useState<number[][]>([])
  const [slideIndex, setSlideIndex] = useState(0)
  const [instant, setInstant] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)

  const itemCount = childArray.length

  const recompute = useCallback(() => {
    const viewport = viewportRef.current
    const measure = measureRef.current

    if (!viewport || !measure || itemCount === 0) {
      return
    }

    const childrenNodes = [...measure.children] as HTMLElement[]
    if (childrenNodes.length === 0) {
      return
    }

    const gap = Number.parseFloat(getComputedStyle(measure).columnGap || getComputedStyle(measure).gap || '0') || 0
    const widths = childrenNodes.map((node) => node.getBoundingClientRect().width)
    const nextPages = paginateByWidths(widths, viewport.clientWidth, gap)
    const signature = nextPages.map((page) => page.join(',')).join('|')

    if (signature === pagesSignatureRef.current) {
      return
    }

    pagesSignatureRef.current = signature
    setPages(nextPages)
    setSlideIndex(0)
    setInstant(true)
  }, [itemCount, childSignature])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useLayoutEffect(() => {
    pagesSignatureRef.current = ''
    recompute()

    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(() => recompute())
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [recompute, itemCount, childSignature])

  useLayoutEffect(() => {
    if (!instant) {
      return
    }

    const frame = window.requestAnimationFrame(() => setInstant(false))
    return () => window.cancelAnimationFrame(frame)
  }, [instant])

  const pageCount = pages.length
  const shouldRotate = pageCount > 1 && !reducedMotion
  const slides = shouldRotate && pages[0] ? [...pages, pages[0]] : pages

  useEffect(() => {
    if (!shouldRotate) {
      return undefined
    }

    const timer = window.setInterval(() => {
      if (pausedRef.current || document.hidden) {
        return
      }

      setSlideIndex((current) => current + 1)
    }, holdMs)

    return () => window.clearInterval(timer)
  }, [shouldRotate, holdMs, pageCount])

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return
    }

    if (slideIndex < pageCount) {
      return
    }

    setInstant(true)
    setSlideIndex(0)
  }

  const renderChild = (itemIndex: number, key: string) => {
    const child = childArray[itemIndex]
    if (!isValidElement(child)) {
      return <Fragment key={key}>{child}</Fragment>
    }

    return <Fragment key={key}>{cloneElement(child)}</Fragment>
  }

  if (itemCount === 0) {
    return null
  }

  return (
    <div
      className={`${styles.wrap} ${className}`.trim()}
      role="region"
      aria-label={ariaLabel}
      onPointerEnter={() => {
        pausedRef.current = true
      }}
      onPointerLeave={() => {
        pausedRef.current = false
      }}
      onFocusCapture={() => {
        pausedRef.current = true
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          pausedRef.current = false
        }
      }}
    >
      <ul ref={measureRef} className={styles.measure} aria-hidden="true" inert>
        {childArray.map((_, index) => renderChild(index, `measure-${index}`))}
      </ul>

      <div ref={viewportRef} className={styles.viewport}>
        {shouldRotate ? (
          <div
            className={`${styles.track} ${instant ? styles.trackInstant : ''}`}
            style={{
              transform: `translate3d(-${slideIndex * 100}%, 0, 0)`,
            } as CSSProperties}
            onTransitionEnd={handleTransitionEnd}
          >
            {slides.map((page, slide) => (
              <ul
                key={`slide-${slide}`}
                className={styles.page}
                aria-hidden={slide !== slideIndex && !(slideIndex === pageCount && slide === 0)}
              >
                {page.map((itemIndex) => renderChild(itemIndex, `s${slide}-i${itemIndex}`))}
              </ul>
            ))}
          </div>
        ) : (
          <ul className={`${styles.page} ${styles.staticPage}`}>
            {childArray.map((_, index) => renderChild(index, `static-${index}`))}
          </ul>
        )}
      </div>
    </div>
  )
}
