import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { FEATURED_PROMOTIONS, PROMO_HERO_IMAGE } from '../data/featuredPromotions'
import { fetchPublicPromotions, type PublicPromotion } from '../services/publicPromotions'
import { PROMOTION_TYPE_LABELS } from '../types/company'
import type { PromotionType } from '../types/company'
import { buildPromotionBookingHref } from '../utils/promotionBooking'
import { resolvePromotionDetail, resolvePromotionHighlight } from '../utils/promotionOffer'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './DiscoveryPromotionsSection.module.css'

const ACCENTS = ['magenta', 'gold', 'sunset', 'coral'] as const

function accentForIndex(index: number) {
  return ACCENTS[index % ACCENTS.length]
}

function mapPublicPromotion(promotion: PublicPromotion, index: number) {
  const imageUrl = promotion.photoUrl || promotion.companyPhotoUrl

  return {
    id: promotion.id,
    type: promotion.type as PromotionType,
    title: promotion.title,
    description: promotion.description,
    detail: resolvePromotionDetail(promotion),
    highlight: resolvePromotionHighlight(promotion, index),
    restaurantName: promotion.companyName,
    imageUrl: imageUrl
      ? optimizeCloudinaryUrl(imageUrl, CLOUDINARY_DISPLAY.photoGallery)
      : PROMO_HERO_IMAGE,
    accent: accentForIndex(index),
    slug: promotion.companySlug,
  }
}

function DiscoveryPromotionsSection() {
  const [items, setItems] = useState(
    FEATURED_PROMOTIONS.map((promotion, index) => ({
      ...promotion,
      slug: '',
      accent: accentForIndex(index),
    })),
  )

  useEffect(() => {
    void fetchPublicPromotions()
      .then((promotions) => {
        if (promotions.length > 0) {
          setItems(promotions.map(mapPublicPromotion))
        }
      })
      .catch(() => {
        // Keep featured fallback content.
      })
  }, [])

  return (
    <section className={styles.section} aria-labelledby="discovery-promotions-title">
      <div className={styles.hero}>
        <img src={PROMO_HERO_IMAGE} alt="" className={styles.heroImage} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>Solo en Adelia</span>
          <h2 id="discovery-promotions-title">
            Reserva.
            <br />
            <span className={styles.heroAccent}>Come mejor.</span>
            <br />
            Gana premios.
          </h2>
          <p className={styles.heroText}>
            Promos reales de restaurantes. Cuanto más reservas, más desbloqueas.
          </p>
        </div>
      </div>

      <div className={styles.cardsTrack}>
        {items.map((promotion) => (
          <article
            key={promotion.id}
            className={`${styles.card} ${styles[`accent_${promotion.accent}`]}`}
          >
            <img src={promotion.imageUrl} alt="" className={styles.cardImage} />
            <div className={styles.cardOverlay} />

            <div className={styles.cardBody}>
              <div className={styles.cardTop}>
                <span className={styles.highlight}>{promotion.highlight}</span>
                <span className={styles.typePill}>
                  {PROMOTION_TYPE_LABELS[promotion.type]}
                </span>
              </div>

              <div className={styles.cardBottom}>
                <p className={styles.restaurant}>{promotion.restaurantName}</p>
                <h3>{promotion.title}</h3>
                <p className={styles.description}>{promotion.description}</p>
                <span className={styles.detailChip}>{promotion.detail}</span>
                {'slug' in promotion && promotion.slug && (
                  <Link
                    to={buildPromotionBookingHref(promotion.slug, promotion.id)}
                    className={styles.cardLink}
                  >
                    Reservar y canjear
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.cta}>
        <div className={styles.ctaGlow} aria-hidden="true" />
        <p className={styles.ctaEyebrow}>¿Aún no tienes cuenta?</p>
        <p className={styles.ctaTitle}>
          Regístrate gratis, guarda favoritos y acumula reservas para canjear promociones.
        </p>
        <Link to="/cuenta/registro" className={styles.ctaButton}>
          Quiero mis promociones
        </Link>
        <p className={styles.ctaFinePrint}>Gratis · Sin tarjeta · En 30 segundos</p>
      </div>
    </section>
  )
}

export default DiscoveryPromotionsSection
