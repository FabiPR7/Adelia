import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface MustChangePasswordRouteProps {
  children: React.ReactNode
}

function MustChangePasswordRoute({ children }: MustChangePasswordRouteProps) {
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
    return <Navigate to="/login" replace />
  }

  if (profile.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (!profile.mustChangePassword) {
    return <Navigate to="/" replace />
  }

  return children
}

export default MustChangePasswordRoute
