import type { VerifiedSalesSummary } from '../../utils/verifiedProductSales'
import { formatCentsAsEuros } from '../../utils/minimumSpendVerification'
import styles from './VerifiedConsumptionSummary.module.css'

interface VerifiedConsumptionSummaryProps {
  summary: VerifiedSalesSummary
}

export default function VerifiedConsumptionSummary({ summary }: VerifiedConsumptionSummaryProps) {
  if (summary.verificationCount === 0) {
    return null
  }

  const maxQuantity = summary.topProducts[0]?.quantity ?? 1

  return (
    <section className={styles.panel} aria-label="Consumo verificado del día">
      <header className={styles.header}>
        <div>
          <h3>Consumo verificado</h3>
          <p>Productos registrados cuando los clientes muestran su cuenta en la app.</p>
        </div>
        <div className={styles.stats}>
          <div>
            <strong>{formatCentsAsEuros(summary.totalCents)}</strong>
            <span>Total verificado</span>
          </div>
          <div>
            <strong>{summary.unitsSold}</strong>
            <span>Unidades</span>
          </div>
          <div>
            <strong>{summary.verificationCount}</strong>
            <span>Reservas</span>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.block}>
          <h4>Lo más vendido hoy</h4>
          {summary.topProducts.length === 0 ? (
            <p className={styles.empty}>
              Hoy solo hay verificaciones por importe total, sin detalle de productos.
            </p>
          ) : (
            <ul className={styles.productList}>
              {summary.topProducts.slice(0, 8).map((product) => (
                <li key={product.nodeId} className={styles.productRow}>
                  <div className={styles.productMeta}>
                    <strong>{product.name}</strong>
                    <span>{product.quantity} uds · {formatCentsAsEuros(product.totalCents)}</span>
                  </div>
                  <div className={styles.barTrack} aria-hidden="true">
                    <span
                      className={styles.barFill}
                      style={{ width: `${Math.max(8, (product.quantity / maxQuantity) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.block}>
          <h4>Por hora de reserva</h4>
          {summary.byHour.length === 0 ? (
            <p className={styles.empty}>Sin datos por hora.</p>
          ) : (
            <ul className={styles.hourList}>
              {summary.byHour.map((entry) => (
                <li key={entry.hour} className={styles.hourRow}>
                  <span className={styles.hourLabel}>{entry.hour}</span>
                  <span className={styles.hourMeta}>
                    {formatCentsAsEuros(entry.totalCents)}
                    {entry.unitsSold > 0 ? ` · ${entry.unitsSold} uds` : ''}
                    {' · '}
                    {entry.reservationCount} reserva{entry.reservationCount === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
