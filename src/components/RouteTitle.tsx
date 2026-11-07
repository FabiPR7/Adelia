import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_NAME = 'Adelia Reservas'
const DEFAULT_TITLE = `${SITE_NAME} — Descubre y reserva restaurantes`

const TITLE_BY_PATH: [RegExp, string][] = [
  [/^\/empresa\/planes/, 'Planes para restaurantes'],
  [/^\/empresa\/alta/, 'Alta de restaurante'],
  [/^\/empresa/, 'Para restaurantes'],
  [/^\/legal\/aviso-legal/, 'Aviso legal'],
  [/^\/legal\/privacidad/, 'Privacidad'],
  [/^\/legal\/terminos/, 'Términos'],
  [/^\/legal\/cookies/, 'Cookies'],
  [/^\/legal\/encargo/, 'Encargo de tratamiento'],
  [/^\/reservar\/[^/]+\/carta/, 'Carta'],
  [/^\/reservar\/[^/]+\/promo/, 'Promociones'],
  [/^\/reservar\/[^/]+\/cancelar/, 'Cancelar reserva'],
  [/^\/reservar\//, 'Reservar mesa'],
  [/^\/cuenta\/entrar/, 'Iniciar sesión'],
  [/^\/cuenta\/registro/, 'Crear cuenta'],
  [/^\/login/, 'Acceso restaurantes'],
  [/^\/panel/, 'Panel del restaurante'],
  [/^\/admin/, 'Administración'],
  [/^\/app\/promociones/, 'Promociones'],
  [/^\/app\/reservas/, 'Mis reservas'],
  [/^\/app\/misiones/, 'Misiones'],
  [/^\/app\/notificaciones/, 'Notificaciones'],
  [/^\/app\/perfil/, 'Mi perfil'],
  [/^\/app/, 'Explorar'],
]

/** Cada página con su título: antes todas compartían el del `index.html`. */
function RouteTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const match = TITLE_BY_PATH.find(([pattern]) => pattern.test(pathname))
    document.title = match ? `${match[1]} · ${SITE_NAME}` : DEFAULT_TITLE
  }, [pathname])

  return null
}

export default RouteTitle
