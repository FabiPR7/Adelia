import { Link } from 'react-router-dom'
import AdelinaCoin from './AdelinaCoin'
import styles from './DiscoveryReviewsCallout.module.css'

export interface FeaturedReviewSpotlight {
  name: string
  reviewRating: number
  adelinaCount: number
  isFavorite: boolean
}

interface DiscoveryReviewsCalloutProps {
  isCustomer: boolean
  spotlight: FeaturedReviewSpotlight | null
}

function DiscoveryReviewsCallout({ isCustomer, spotlight }: DiscoveryReviewsCalloutProps) {
  const ratingLabel = spotlight ? spotlight.reviewRating.toFixed(1) : '4.3'
  const adelinasLabel = spotlight
    ? spotlight.adelinaCount.toLocaleString('es-ES')
    : '847'

  return (
    <section className={styles.arena} aria-labelledby="reviews-callout-heading">
      <div className={styles.auroraTop} aria-hidden="true" />
      <div className={styles.auroraBottom} aria-hidden="true" />
      <div className={styles.sparkles} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className={styles.layout}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Ranking de reseñas · Adelinas</span>
          <h2 id="reviews-callout-heading">
            ¿Cuántas Adelinas tiene
            <span className={styles.headlineAccent}> tu favorito?</span>
          </h2>
          <p className={styles.lead}>
            Cada reseña empuja a tu restaurante en la comunidad. Descubre su nota, compite con
            otros foodies y conviértete en su mejor aliado.
          </p>

          {spotlight && (
            <article className={styles.spotlightCard}>
              <div className={styles.spotlightTop}>
                <span className={spotlight.isFavorite ? styles.favTag : styles.peekTag}>
                  {spotlight.isFavorite ? '♥ Tu favorito' : 'Destacado hoy'}
                </span>
                <span className={styles.rankPulse}>En vivo</span>
              </div>
              <strong className={styles.spotlightName}>{spotlight.name}</strong>
              <div className={styles.spotlightStats}>
                <span>
                  <AdelinaCoin size="sm" variant="review" alt="" />
                  {adelinasLabel} Adelinas
                </span>
                <span className={styles.ratingChip}>
                  <AdelinaCoin size="sm" variant="review" alt="" />
                  {ratingLabel}
                </span>
              </div>
              <p className={styles.spotlightHint}>
                {spotlight.isFavorite
                  ? 'Tu voto puede hacerlo subir esta semana.'
                  : 'Marca un favorito y mira cómo crece su ranking.'}
              </p>
            </article>
          )}

          <div className={styles.actions}>
            {!isCustomer ? (
              <Link to="/cuenta/registro" className={styles.ctaPrimary}>
                Unirme y defender mi favorito
              </Link>
            ) : (
              <Link to="/cuenta" className={styles.ctaPrimary}>
                Puntuar y sumar Adelinas
              </Link>
            )}
            <Link to="/" className={styles.ctaGhost}>
              Explorar restaurantes
            </Link>
          </div>
        </div>

        <div className={styles.stage} aria-hidden="true">
          <div className={styles.orbitRing} />
          <div className={styles.orbitRingInner} />
          <div className={styles.coinHalo} />
          <div className={styles.coinPedestal} />
          <AdelinaCoin size="xl" variant="review" alt="" className={styles.heroCoin} />
          <div className={styles.floatStatLeft}>
            <span className={styles.floatLabel}>Adelinas</span>
            <strong>{adelinasLabel}</strong>
          </div>
          <div className={styles.floatStatRight}>
            <span className={styles.floatLabel}>Nota media</span>
            <strong>{ratingLabel}</strong>
          </div>
          <div className={styles.vsBadge}>VS</div>
        </div>
      </div>
    </section>
  )
}

export default DiscoveryReviewsCallout
