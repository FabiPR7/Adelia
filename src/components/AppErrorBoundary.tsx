import { Component, type ErrorInfo, type ReactNode } from 'react'
import SomethingWentWrongPage from './SomethingWentWrongPage'
import { installClientErrorReporter, reportClientError } from '../utils/clientErrorReporter'

// Fallos fuera de React (promesas sin capturar, scripts) también se informan.
installClientErrorReporter()

type AppErrorBoundaryProps = {
  children: ReactNode
  /**
   * Si true, «Intentar de nuevo» hace `window.location.reload()`.
   * Úsalo en el boundary exterior (providers). En el interior, deja false
   * para resetear solo el árbol de React.
   */
  hardReload?: boolean
}

type AppErrorBoundaryState = {
  hasError: boolean
}

/**
 * Captura errores de render y muestra una página amistosa en lugar de
 * una pantalla en blanco.
 */
export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Una pantalla abierta antes de publicar pide archivos que ya no existen:
    // se recarga una vez para traer la versión nueva en vez de mostrar el error.
    if (/dynamically imported module|Importing a module script failed|error loading dynamically|Expected a JavaScript/i.test(error.message)) {
      try {
        const last = Number(sessionStorage.getItem('adelia:chunk-reload-at') ?? 0)
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem('adelia:chunk-reload-at', String(Date.now()))
          window.location.reload()
          return
        }
      } catch {
        // Sin almacenamiento se muestra la pantalla de error normal.
      }
    }
    console.error('AppErrorBoundary:', error, info.componentStack)
    reportClientError(error, 'react')
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <SomethingWentWrongPage
        hardReload={this.props.hardReload === true}
        onRetry={this.handleRetry}
      />
    )
  }
}
