import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Al cambiar de página, vuelve arriba. Sin esto, el navegador conserva el
 * scroll de la página anterior (p. ej. desde el pie de la home se llegaba a
 * /empresa a mitad o al final de la página).
 * No actúa al ir atrás/adelante (POP) ni con enlaces a un ancla (#).
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    if (navigationType === 'POP' || hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash, navigationType])

  return null
}
