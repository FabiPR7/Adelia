import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { FavoriteRestaurantsProvider } from './context/FavoriteRestaurantsContext'
import { CustomerGamificationProvider } from './context/CustomerGamificationContext'
import { CustomerProductTourProvider } from './context/CustomerProductTourContext'
import './styles/global.css'

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
