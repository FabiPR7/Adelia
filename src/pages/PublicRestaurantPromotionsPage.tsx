import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PromotionPhotoCollage from '../components/promotions/PromotionPhotoCollage'
import { mergeDemoPromotions } from '../data/demoNearbyPromotions'
import { fetchPublicBookingPage } from '../services/publicApi'
import { fetchPublicPromotionsBySlug, type PublicPromotion } from '../services/publicPromotions'
import { buildPromotionBookingHref } from '../utils/promotionBooking'
import { resolvePromotionDetail, resolvePromotionHighlight, resolvePromotionMinimumSpend } from '../utils/promotionOffer'
import styles from './PublicRestaurantPromotionsPage.module.css'

function PublicRestaurantPromotionsPage() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const highlightPromoId = searchParams.get('promo')
  const reserveHref = `/reservar/${slug}`
  const [companyName, setCompanyName] = useState('')
  const [promotions, setPromotions] = useState<PublicPromotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [booking, promoData] = await Promise.all([
          fetchPublicBookingPage(slug),
          fetchPublicPromotionsBySlug(slug),
        ])

        if (!cancelled) {
          setCompanyName(booking.company.name)
          setPromotions(
            (import.meta.env.DEV ? mergeDemoPromotions(promoData) : promoData)
              .filter((promotion) => promotion.companySlug === slug),
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las promociones.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!highlightPromoId || loading) {
      return
    }

    const element = document.getElementById(`promo-${highlightPromoId}`)
    if (!element) {
      return
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightPromoId, loading, promotions])

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <p>Cargando promociones…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.errorPage}>
        <p>{error}</p>
        <Link to={reserveHref}>Volver</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={reserveHref} className={styles.backLink}>
          ← Volver
        </Link>
        <div className={styles.headerText}>
          <h1>{companyName || 'Restaurante'}</h1>
          <p>Promociones activas</p>
        </div>
      </header>

      <main className={styles.main}>
        {promotions.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Este restaurante no tiene promociones activas ahora mismo.</p>
            <Link to={reserveHref}>Volver a reservar</Link>
          </div>
        ) : (
          <ul className={styles.list}>
            {promotions.map((promotion, index) => {
              const productRefs = promotion.productRefs ?? []
              const hasVisual = productRefs.some((ref) => ref.photoUrl.trim())
                || Boolean(promotion.photoUrl?.trim())
                || Boolean(promotion.companyPhotoUrl?.trim())
              const minSpendLabel = resolvePromotionMinimumSpend(promotion)

              return (
                <li key={promotion.id} id={`promo-${promotion.id}`} className={highlightPromoId === promotion.id ? styles.highlightedPromo : undefined}>
                  <Link
                    to={buildPromotionBookingHref(slug, promotion.id)}
                    className={styles.cardLink}
                  >
                    <article className={styles.card}>
                      <div className={styles.visual}>
                        {hasVisual ? (
                          <PromotionPhotoCollage
                            productRefs={productRefs}
                            fallbackPhotoUrl={promotion.photoUrl || promotion.companyPhotoUrl}
                            size="card"
                            className={styles.collage}
                            alt={promotion.title}
                          />
                        ) : (
                          <div className={styles.fallback} aria-hidden="true">🎁</div>
                        )}
                        <span className={styles.highlight}>
                          {resolvePromotionHighlight(promotion, index)}
                        </span>
                      </div>
                      <div className={styles.body}>
                        <h2>{promotion.title}</h2>
                        {promotion.description ? (
                          <p className={styles.description}>{promotion.description}</p>
                        ) : null}
                        <div className={styles.metaRow}>
                          <p className={styles.detail}>{resolvePromotionDetail(promotion)}</p>
                          {minSpendLabel ? (
                            <p className={styles.minSpend}>{minSpendLabel}</p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}

export default PublicRestaurantPromotionsPage
