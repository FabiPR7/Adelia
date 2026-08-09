import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { needsEmailVerification } from '../utils/customerRouting'

interface CustomerGateProps {
  children: React.ReactNode
  allowIncomplete?: boolean
}

function CustomerGate({ children, allowIncomplete = false }: CustomerGateProps) {
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

  if (!user || !profile || profile.role !== 'customer') {
    return <Navigate to="/cuenta/entrar" replace />
  }

  if (needsEmailVerification(user, profile)) {
    return <Navigate to="/cuenta/verificar-email" replace />
  }

  if (!allowIncomplete && !profile.onboardingCompleted) {
    return <Navigate to="/cuenta/completar-perfil" replace />
  }

  return children
}

export default CustomerGate
