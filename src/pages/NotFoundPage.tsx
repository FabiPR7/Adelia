import StatusScreen from '../components/StatusScreen'

export default function NotFoundPage() {
  return (
    <StatusScreen
      code="404"
      title="Esta página no existe"
      message="El enlace que has seguido está roto o la página se ha movido. Revisa la dirección o vuelve al inicio."
      actions={[
        { label: 'Volver al inicio', to: '/' },
        { label: 'Ir atrás', variant: 'ghost', onClick: () => window.history.back() },
      ]}
    />
  )
}
