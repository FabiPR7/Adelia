import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import RoleRoute from './components/RoleRoute'
import MustChangePasswordRoute from './components/MustChangePasswordRoute'
import { useAuth } from './context/AuthContext'
import ChangePasswordPage from './pages/ChangePasswordPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PublicLegalPage from './pages/PublicLegalPage'
import PublicDiscoveryPage from './pages/PublicDiscoveryPage'
import CompanyLandingPage from './pages/CompanyLandingPage'
import UserLoginPage from './pages/UserLoginPage'
import UserRegisterPage from './pages/UserRegisterPage'
import CustomerAppLayout from './components/CustomerAppLayout'
import CustomerGate from './components/CustomerGate'
import VerifyEmailPage from './pages/VerifyEmailPage'
import CustomerOnboardingPage from './pages/CustomerOnboardingPage'
import CookieConsentBanner from './components/CookieConsentBanner'
import { getPostLoginPath } from './utils/authProfile'

const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage'))
const PublicMenuPage = lazy(() => import('./pages/PublicMenuPage'))
const PublicMenuViewPage = lazy(() => import('./pages/PublicMenuViewPage'))
const PublicRestaurantPromotionsPage = lazy(() => import('./pages/PublicRestaurantPromotionsPage'))
const PublicCancelReservation = lazy(() => import('./pages/PublicCancelReservation'))
const CustomerExploreTab = lazy(() => import('./pages/customer/CustomerExploreTab'))
const CustomerPromotionsTab = lazy(() => import('./pages/customer/CustomerPromotionsTab'))
const CustomerMissionsTab = lazy(() => import('./pages/customer/CustomerMissionsTab'))
const CustomerProfileTab = lazy(() => import('./pages/customer/CustomerProfileTab'))
const CustomerReservationsTab = lazy(() => import('./pages/customer/CustomerReservationsTab'))
const CustomerNotificationsTab = lazy(() => import('./pages/customer/CustomerNotificationsTab'))
const CustomerChangePasswordPage = lazy(() => import('./pages/customer/CustomerChangePasswordPage'))
const CompanyDashboard = lazy(() => import('./pages/CompanyDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

function RouteFallback() {
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
            <Navigate to={getPostLoginPath(profile, user)} replace />
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
            <Suspense fallback={<RouteFallback />}>
              <AdminDashboard />
            </Suspense>
          </RoleRoute>
        }
      />
      <Route
        path="/panel"
        element={
          <RoleRoute role="company" requirePasswordChanged>
            <Suspense fallback={<RouteFallback />}>
              <CompanyDashboard />
            </Suspense>
          </RoleRoute>
        }
      />
      <Route
        path="*"
        element={
          <Navigate
            to={user && profile ? getPostLoginPath(profile, user) : '/'}
            replace
          />
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <>
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
        path="/empresa"
        element={<CompanyLandingPage />}
      />
      <Route path="/cuenta" element={<Navigate to="/app/perfil" replace />} />
      <Route path="/cuenta/verificar-email" element={<VerifyEmailPage />} />
      <Route path="/cuenta/completar-perfil" element={<CustomerOnboardingPage />} />
      <Route
        path="/app"
        element={
          <CustomerGate>
            <CustomerAppLayout />
          </CustomerGate>
        }
      >
        <Route index element={<Navigate to="/app/explorar" replace />} />
        <Route path="explorar" element={<Suspense fallback={<RouteFallback />}><CustomerExploreTab /></Suspense>} />
        <Route path="promociones" element={<Suspense fallback={<RouteFallback />}><CustomerPromotionsTab /></Suspense>} />
        <Route path="reservas" element={<Suspense fallback={<RouteFallback />}><CustomerReservationsTab /></Suspense>} />
        <Route path="misiones" element={<Suspense fallback={<RouteFallback />}><CustomerMissionsTab /></Suspense>} />
        <Route path="notificaciones" element={<Suspense fallback={<RouteFallback />}><CustomerNotificationsTab /></Suspense>} />
        <Route path="perfil" element={<Suspense fallback={<RouteFallback />}><CustomerProfileTab /></Suspense>} />
      </Route>
      <Route path="/cuenta/cambiar-contrasena" element={<Suspense fallback={<RouteFallback />}><CustomerChangePasswordPage /></Suspense>} />
      <Route path="/cuenta/entrar" element={<UserLoginPage />} />
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
        element={<Navigate to=".." replace relative="path" />}
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
        path="/reservar/:slug/promociones"
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
                Cargando promociones…
              </div>
            }
          >
            <PublicRestaurantPromotionsPage />
          </Suspense>
        }
      />
      <Route
        path="/reservar/:slug/carta/:boardId"
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
                Cargando carta…
              </div>
            }
          >
            <PublicMenuViewPage />
          </Suspense>
        }
      />
      <Route
        path="/reservar/:slug/carta"
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
                Cargando carta…
              </div>
            }
          >
            <PublicMenuPage />
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
    <CookieConsentBanner />
    </>
  )
}

export default App
