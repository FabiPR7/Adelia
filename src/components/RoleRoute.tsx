import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

interface RoleRouteProps {
  children: React.ReactNode
  role: UserRole
  requirePasswordChanged?: boolean
}

function RoleRoute({ children, role, requirePasswordChanged = false }: RoleRouteProps) {
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

  if (!user || !profile) {
    return <Navigate to="/cuenta/entrar" replace />
  }

  if (profile.role !== role) {
    if (profile.role === 'admin') {
      return <Navigate to="/admin" replace />
    }

    if (profile.role === 'customer') {
      return <Navigate to="/app/explorar" replace />
    }

    return <Navigate to="/panel" replace />
  }

  if (requirePasswordChanged && profile.mustChangePassword) {
    return <Navigate to="/cambiar-contrasena" replace />
  }

  return children
}

export default RoleRoute
