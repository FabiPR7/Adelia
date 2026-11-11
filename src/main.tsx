import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { FavoriteRestaurantsProvider } from './context/FavoriteRestaurantsContext'
import { CustomerGamificationProvider } from './context/CustomerGamificationContext'
import { CustomerProductTourProvider } from './context/CustomerProductTourContext'
import { loadRemoteCatalog } from './services/remoteCatalog'
import './styles/fonts.css'
import './styles/global.css'

// Si alguien tenía la web abierta antes de publicar una versión nueva, al abrir
// una sección pide archivos que ya no existen. En vez de romperse, se recarga
// una vez para traer la versión nueva (como mucho una vez por minuto).
const RELOAD_KEY = 'adelia:chunk-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  } catch {
    last = 0
  }
  if (Date.now() - last < 60_000) {
    return
  }
  event.preventDefault()
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Sin almacenamiento se recarga igualmente.
  }
  window.location.reload()
})

// Planes, ítems y reglas viven en Firestore. Se esperan unos instantes antes de
// pintar para que la primera pantalla ya use los datos reales; si la base de
// datos tarda, se arranca con el respaldo del código y no se bloquea la web.
const CATALOG_WAIT_MS = 2500

await Promise.race([
  loadRemoteCatalog(),
  new Promise<void>((resolve) => setTimeout(resolve, CATALOG_WAIT_MS)),
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Exterior: si falla un provider, solo queda recargar. */}
      <AppErrorBoundary hardReload>
        <AuthProvider>
          <FavoriteRestaurantsProvider>
            <CustomerGamificationProvider>
              <CustomerProductTourProvider>
                {/* Interior: fallos de pantalla se pueden reintentar sin recargar. */}
                <AppErrorBoundary>
                  <App />
                </AppErrorBoundary>
              </CustomerProductTourProvider>
            </CustomerGamificationProvider>
          </FavoriteRestaurantsProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
