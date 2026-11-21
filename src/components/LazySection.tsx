import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Monta su contenido solo cuando el usuario se acerca deslizando (unos 600 px
 * antes). Así las secciones de abajo no piden nada al servidor si nadie llega a
 * verlas. Mientras, reserva un hueco para que la página no salte.
 */
function LazySection({
  children,
  minHeight = 240,
  rootMargin = '600px 0px',
}: {
  children: ReactNode
  /** Alto aproximado de la sección antes de cargarla. */
  minHeight?: number
  rootMargin?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible, rootMargin])

  if (visible) return <>{children}</>
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" />
}

export default LazySection
