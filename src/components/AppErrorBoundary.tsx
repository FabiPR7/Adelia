import { Component, type ErrorInfo, type ReactNode } from 'react'
import SomethingWentWrongPage from './SomethingWentWrongPage'

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
    console.error('AppErrorBoundary:', error, info.componentStack)
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
