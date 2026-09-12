import { Component, type ErrorInfo, type ReactNode } from 'react'
import StatusScreen from './StatusScreen'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

/**
 * Captura errores de render de toda la app y muestra una pantalla de error en
 * lugar de una página en blanco. La recuperación es siempre una recarga dura:
 * si el error viene del router o de un provider, un `<Link>` volvería a fallar.
 */
export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AppErrorBoundary:', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <StatusScreen
        code="Error"
        title="Algo ha ido mal"
        message="Ha ocurrido un problema inesperado al cargar esta parte de la aplicación. Vuelve a intentarlo; si sigue pasando, escríbenos."
        actions={[
          { label: 'Recargar la página', onClick: () => window.location.reload() },
          { label: 'Volver al inicio', variant: 'ghost', onClick: () => window.location.assign('/') },
        ]}
      />
    )
  }
}
