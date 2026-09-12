import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PromotionScanLanding from '../components/promotions/PromotionScanLanding'
import landingStyles from '../components/promotions/PromotionScanLanding.module.css'
import { mergeDemoPromotions } from '../data/demoNearbyPromotions'
import { fetchPublicPromotionsBySlug, type PublicPromotion } from '../services/publicPromotions'
import { trackAppEvent } from '../utils/appEvents'
import styles from './PublicRestaurantPromotionsPage.module.css'

function PublicPromotionLandingPage() {
  const { slug = '', promotionId = '' } = useParams()
  const [promotion, setPromotion] = useState<PublicPromotion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const promotions = await fetchPublicPromotionsBySlug(slug)
        const merged = import.meta.env.DEV ? mergeDemoPromotions(promotions) : promotions
        const found = merged.find(
          (item) => item.id === promotionId && item.companySlug === slug,
        ) ?? null

        if (!cancelled) {
          setPromotion(found)
          if (found?.companyId && found.id) {
            trackAppEvent('promo_view', {
              companyId: found.companyId,
              entityId: found.id,
              entityKind: 'promotion',
              source: 'landing',
            })
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la promoción.')
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
  }, [slug, promotionId])

  if (loading) {
    return (
      <div className={landingStyles.page}>
        <div className={landingStyles.veil} aria-hidden="true" />
        <div className={landingStyles.boot}>
          <span className={landingStyles.bootGift} aria-hidden="true">🎁</span>
          <p>Abriendo premio…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.errorPage}>
        <p>{error}</p>
        <Link to={`/reservar/${slug}`}>Volver al restaurante</Link>
      </div>
    )
  }

  if (!promotion) {
    return (
      <div className={styles.errorPage}>
        <p>Esta promoción ya no está disponible.</p>
        <Link to={`/reservar/${slug}/promociones`}>Ver promociones</Link>
      </div>
    )
  }

  return <PromotionScanLanding promotion={promotion} />
}

export default PublicPromotionLandingPage
