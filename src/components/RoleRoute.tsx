import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'
import { getPostLoginPath, unauthenticatedPathForRole } from '../utils/authProfile'

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
    return <Navigate to={unauthenticatedPathForRole(role)} replace />
  }

  if (profile.role !== role) {
    return <Navigate to={getPostLoginPath(profile, user)} replace />
  }

  if (requirePasswordChanged && profile.mustChangePassword) {
    return <Navigate to="/cambiar-contrasena" replace />
  }

  return children
}

export default RoleRoute
