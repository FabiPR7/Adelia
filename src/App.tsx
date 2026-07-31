import { Routes, Route, Navigate } from 'react-router-dom'
import RoleRoute from './components/RoleRoute'
import MustChangePasswordRoute from './components/MustChangePasswordRoute'
import { useAuth } from './context/AuthContext'
import AdminDashboard from './pages/AdminDashboard'
import ChangePasswordPage from './pages/ChangePasswordPage'
import CompanyDashboard from './pages/CompanyDashboard'
import LoginPage from './pages/LoginPage'
import { getPostLoginPath } from './utils/authProfile'

function AppRoutes() {
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
        path="/"
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
            to={user && profile ? getPostLoginPath(profile) : '/login'}
            replace
          />
        }
      />
    </Routes>
  )
}

function App() {
  return <AppRoutes />
}

export default App
