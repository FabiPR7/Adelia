import { Link } from 'react-router-dom'
import type { CustomerVerifiedConsumption } from '../types/verifiedConsumption'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  consumptionAmountLabel,
  consumptionProductSummary,
  consumptionSourceLabel,
} from '../utils/customerConsumption'
import styles from './CustomerConsumptionCard.module.css'

interface CustomerConsumptionCardProps {
  consumption: CustomerVerifiedConsumption
}

function CustomerConsumptionCard({ consumption }: CustomerConsumptionCardProps) {
  const visitDate = new Date(consumption.visitAt || consumption.verifiedAt)
  const photoUrl = consumption.photoUrl
    ? optimizeCloudinaryUrl(consumption.photoUrl, CLOUDINARY_DISPLAY.photoGallery)
    : ''
  const dateLabel = visitDate.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const timeLabel = visitDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const productSummary = consumptionProductSummary(consumption.lineItems)
  const amountLabel = consumptionAmountLabel(consumption.totalCents, consumption.mode)
  const restaurantHref = consumption.companySlug
    ? `/reservar/${consumption.companySlug}`
    : null

  return (
    <article className={styles.card}>
      <div className={styles.layout}>
        <div className={styles.media}>
          {photoUrl ? (
            <img src={photoUrl} alt="" />
          ) : (
            <div className={styles.mediaFallback} aria-hidden="true">🍽️</div>
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.topRow}>
            <h3>{consumption.companyName}</h3>
            <span className={styles.source}>{consumptionSourceLabel(consumption.source)}</span>
          </div>
          <div className={styles.datetime}>
            <span className={styles.date}>{dateLabel}</span>
            <span className={styles.time}>{timeLabel}</span>
          </div>
          <p className={styles.amount}>{amountLabel}</p>
          {consumption.promotionTitle ? (
            <p className={styles.promo}>Promo: {consumption.promotionTitle}</p>
          ) : null}
          {productSummary ? (
            <p className={styles.products}>{productSummary}</p>
          ) : null}
          {restaurantHref ? (
            <Link to={restaurantHref} className={styles.action}>
              Ver restaurante
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default CustomerConsumptionCard
