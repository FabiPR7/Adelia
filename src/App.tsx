import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RoleRoute from './components/RoleRoute'
import MustChangePasswordRoute from './components/MustChangePasswordRoute'
import { useAuth } from './context/AuthContext'
import AdminDashboard from './pages/AdminDashboard'
import ChangePasswordPage from './pages/ChangePasswordPage'
import CompanyDashboard from './pages/CompanyDashboard'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PublicLegalPage from './pages/PublicLegalPage'
import PublicDiscoveryPage from './pages/PublicDiscoveryPage'
import UserLoginPage from './pages/UserLoginPage'
import UserRegisterPage from './pages/UserRegisterPage'
import CustomerAccountPage from './pages/CustomerAccountPage'
import { getPostLoginPath } from './utils/authProfile'

const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage'))
const PublicRestaurantProfile = lazy(() => import('./pages/PublicRestaurantProfile'))
const PublicCancelReservation = lazy(() => import('./pages/PublicCancelReservation'))

function AuthenticatedRoutes() {
  const { user, profile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
        }}
      >
        Cargando…
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user && profile ? (
            <Navigate to={getPostLoginPath(profile)} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/cambiar-contrasena"
        element={
          <MustChangePasswordRoute>
            <ChangePasswordPage />
          </MustChangePasswordRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <RoleRoute role="admin">
            <AdminDashboard />
          </RoleRoute>
        }
      />
      <Route
        path="/panel"
        element={
          <RoleRoute role="company" requirePasswordChanged>
            <CompanyDashboard />
          </RoleRoute>
        }
      />
      <Route
        path="*"
        element={
          <Navigate
            to={user && profile ? getPostLoginPath(profile) : '/'}
            replace
          />
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <Routes>
      <Route
        path="/olvide-contrasena"
        element={<ForgotPasswordPage />}
      />
      <Route
        path="/restablecer-contrasena"
        element={<ResetPasswordPage />}
      />
      <Route
        path="/"
        element={<PublicDiscoveryPage />}
      />
      <Route
        path="/cuenta"
        element={
          <RoleRoute role="customer">
            <CustomerAccountPage />
          </RoleRoute>
        }
      />
      <Route
        path="/cuenta/entrar"
        element={<UserLoginPage />}
      />
      <Route
        path="/cuenta/registro"
        element={<UserRegisterPage />}
      />
      <Route
        path="/legal/:doc"
        element={<PublicLegalPage />}
      />
      <Route
        path="/reservar/:slug/restaurante"
        element={
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                Cargando restaurante…
              </div>
            }
          >
            <PublicRestaurantProfile />
          </Suspense>
        }
      />
      <Route
        path="/reservar/:slug/cancelar"
        element={
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                Cargando…
              </div>
            }
          >
            <PublicCancelReservation />
          </Suspense>
        }
      />
      <Route
        path="/reservar/:slug"
        element={
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                Cargando reservas…
              </div>
            }
          >
            <PublicBookingPage />
          </Suspense>
        }
      />
      <Route path="*" element={<AuthenticatedRoutes />} />
    </Routes>
  )
}

export default App
