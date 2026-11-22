import { useCallback, useEffect, useState } from 'react'
import {
  fetchCompanyStripeStatus,
  openCompanyStripeDashboard,
  startCompanyStripeConnect,
  type CompanyStripeStatus,
} from '../../services/companyStripe'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import InfoHint from '../../components/company/InfoHint'
import styles from './CompanyStripeConnectPanel.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

interface CompanyStripeConnectPanelProps {
  companyId: string
  autoRefresh?: boolean
  onStatusChange?: (status: CompanyStripeStatus | null, loading: boolean) => void
}

function statusLabel(status: CompanyStripeStatus | null): string {
  if (!status) {
    return 'Estado no disponible'
  }

  if (!status.configured) {
    return 'Stripe no configurado en el servidor'
  }

  if (status.accountUnavailable) {
    return 'Hay que volver a conectar la cuenta'
  }

  if (!status.stripeAccountId) {
    return 'Sin cuenta conectada'
  }

  if (status.readyForDeposits) {
    return 'Lista para cobrar fianzas'
  }

  if (status.stripeDetailsSubmitted) {
    return 'Cuenta conectada · revisión pendiente'
  }

  return 'Configuración incompleta'
}

export default function CompanyStripeConnectPanel({
  companyId,
  autoRefresh = false,
  onStatusChange,
}: CompanyStripeConnectPanelProps) {
  const demo = useCompanyDemo()
  const [status, setStatus] = useState<CompanyStripeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const next = await fetchCompanyStripeStatus(companyId)
      setStatus(next)
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo consultar Stripe.'))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    onStatusChange?.(status, loading)
  }, [status, loading, onStatusChange])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus, autoRefresh])

  const handleConnect = async () => {
    setActionLoading(true)
    setError(null)

    try {
      const result = await startCompanyStripeConnect(companyId)
      window.location.assign(result.url)
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo abrir Stripe Connect.'))
      setActionLoading(false)
    }
  }

  const handleDashboard = async () => {
    setActionLoading(true)
    setError(null)

    try {
      const result = await openCompanyStripeDashboard(companyId)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(friendlyErrorMessage(err, 'No se pudo abrir el panel de Stripe.'))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h4>
            Conexión con Stripe
            <InfoHint label="Sobre la conexión con Stripe">
              Conecta y completa la cuenta del restaurante. Las fianzas se autorizan al reservar y
              solo se cobran si la reserva se cancela o no se confirma la asistencia.
            </InfoHint>
          </h4>
        </div>
        <span
          className={`${styles.badge} ${
            status?.readyForDeposits
              ? styles.badgeReady
              : status?.stripeAccountId
                ? styles.badgePending
                : styles.badgeIdle
          }`}
        >
          {loading ? 'Consultando…' : statusLabel(status)}
        </span>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {demo ? null : (
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void handleConnect()}
          disabled={actionLoading || loading || status?.configured === false}
        >
          {status?.stripeAccountId && !status.accountUnavailable
            ? 'Continuar configuración Stripe'
            : 'Conectar cuenta Stripe'}
        </button>
        {status?.stripeAccountId && !status.accountUnavailable ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void handleDashboard()}
            disabled={actionLoading || loading}
          >
            Abrir panel Stripe
          </button>
        ) : null}
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void loadStatus()}
          disabled={loading || actionLoading}
        >
          Actualizar estado
        </button>
      </div>
      )}
    </div>
  )
}
