import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { fetchPublicPromotions, type PublicPromotion } from '../../services/publicPromotions'
import { getPromotionHeroUrl, promotionTypeLabel } from '../promotions/promoAppDisplay'
import styles from './TopPromotionsSection.module.css'
import { formatNumber } from '../../utils/formatNumber'

const MAX = 6

/** Las promos que más gente ha reclamado, de más a menos. */
function TopPromotionsSection() {
  const [promotions, setPromotions] = useState<PublicPromotion[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPublicPromotions()
      .then((rows) => {
        if (!cancelled) setPromotions(rows)
      })
      .catch(() => {
        if (!cancelled) setPromotions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!promotions) return null
  const top = [...promotions]
    .filter((promotion) => promotion.currentRedemptions > 0)
    .sort((a, b) => b.currentRedemptions - a.currentRedemptions)
    .slice(0, MAX)
  if (top.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="top-promos-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}><Flame size={14} aria-hidden="true" /> Lo que más se lleva</span>
          <h2 id="top-promos-title">Las promos más reclamadas</h2>
        </div>
        <span className={styles.hint}>Las que más clientes han canjeado</span>
      </div>
      <ol className={styles.grid}>
        {top.map((promotion, index) => {
          const photo = getPromotionHeroUrl(promotion)
          const full = promotion.maxRedemptions != null && promotion.currentRedemptions >= promotion.maxRedemptions
          return (
            <li key={promotion.id}>
              <Link
                to={`/reservar/${promotion.companySlug}/promo/${promotion.id}`}
                className={`${styles.card} ${index === 0 ? styles.cardTop : ''}`}
              >
                <span className={styles.media}>
                  {photo ? (
                    <img src={photo} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className={styles.fallback} aria-hidden="true">{promotion.companyName.charAt(0)}</span>
                  )}
                  <span className={styles.rank}>#{index + 1}</span>
                  <span className={styles.type}>{promotionTypeLabel(promotion.type)}</span>
                </span>
                <span className={styles.body}>
                  <span className={styles.restaurant}>{promotion.companyName}</span>
                  <strong className={styles.title}>{promotion.title}</strong>
                  {promotion.highlight ? <span className={styles.highlight}>{promotion.highlight}</span> : null}
                  <span className={styles.footer}>
                    <span className={styles.count}>
                      <Flame size={14} aria-hidden="true" />
                      {formatNumber(promotion.currentRedemptions)}{' '}
                      {promotion.currentRedemptions === 1 ? 'vez reclamada' : 'veces reclamada'}
                    </span>
                    <span className={full ? styles.full : styles.cta}>{full ? 'Agotada' : 'Ver promo →'}</span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default TopPromotionsSection
