import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { FavoriteRestaurantsProvider } from './context/FavoriteRestaurantsContext'
import { CustomerGamificationProvider } from './context/CustomerGamificationContext'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FavoriteRestaurantsProvider>
          <CustomerGamificationProvider>
            <App />
          </CustomerGamificationProvider>
        </FavoriteRestaurantsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
