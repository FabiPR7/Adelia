import { useEffect, useMemo, useState } from 'react'
import AdelinaCoin from './AdelinaCoin'
import {
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { type PublicCompanyReview } from '../services/publicApi'
import { fetchFeaturedReviews } from '../services/publicDiscovery'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import { getAdelinaSlotStates } from '../types/review'
import { getReviewCommentPlainText } from '../utils/reviewCommentTags'
import { pickNextRandomIndex, shuffleCopy } from '../utils/featuredReviewHighlight'
import styles from './FeaturedReviewHighlight.module.css'

const ROTATE_MS = 3000
const FADE_MS = 380

interface FeaturedReviewItem {
  restaurant: PublicDiscoveryRestaurant
  review: PublicCompanyReview
}

interface FeaturedReviewHighlightProps {
  restaurants: PublicDiscoveryRestaurant[]
  onOpenRestaurant: (restaurant: PublicDiscoveryRestaurant) => void
}

function FeaturedReviewHighlight({
  restaurants,
  onOpenRestaurant,
}: FeaturedReviewHighlightProps) {
  const [items, setItems] = useState<FeaturedReviewItem[]>([])
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const [loading, setLoading] = useState(true)

  const restaurantKey = useMemo(
    () => restaurants.map((restaurant) => restaurant.slug).sort().join('|'),
    [restaurants],
  )

  useEffect(() => {
    let cancelled = false
    // Una sola llamada: los 8 locales con más reseñas (el servidor elige la mejor de cada uno).
    const bySlug = new Map(restaurants.map((restaurant) => [restaurant.slug.trim().toLowerCase(), restaurant]))
    const candidates = [...restaurants]
      .filter((restaurant) => restaurant.reviewCount > 0)
      .sort((left, right) => right.reviewCount - left.reviewCount)
      .slice(0, 8)

    if (candidates.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    void fetchFeaturedReviews<PublicCompanyReview>(candidates.map((restaurant) => restaurant.slug))
      .then((entries) => {
        if (cancelled) return
        const next = entries
          .map((entry) => {
            const restaurant = bySlug.get(entry.slug.trim().toLowerCase())
            return restaurant ? { restaurant, review: entry.review } : null
          })
          .filter((row): row is FeaturedReviewItem => row !== null)
        setItems(shuffleCopy(next))
        setIndex(0)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo re-fetch si cambian los slugs
  }, [restaurantKey])

  useEffect(() => {
    if (items.length <= 1) {
      return
    }

    let fadeTimer = 0
    const timer = window.setInterval(() => {
      if (document.hidden) {
        return
      }
      setFading(true)
      fadeTimer = window.setTimeout(() => {
        setIndex((current) => pickNextRandomIndex(items.length, current))
        setFading(false)
      }, FADE_MS)
    }, ROTATE_MS)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(fadeTimer)
    }
  }, [items.length])

  if (loading && items.length === 0) {
    return (
      <section className={styles.section} aria-labelledby="featured-reviews-heading">
        <div className={styles.heading}>
          <h2 id="featured-reviews-heading">Últimas valoraciones</h2>
          <span>Lo que se habla</span>
        </div>
        <div className={styles.skeleton} />
      </section>
    )
  }

  const item = items[index] ?? items[0]
  if (!item) {
    return null
  }

  const { restaurant, review } = item
  const mediaItems = review.mediaItems ?? []
  const reviewPhoto = mediaItems.find((media) => media.type === 'image')?.url ?? ''
  const rawPhoto = reviewPhoto || restaurant.photoUrl || ''
  const photoUrl = rawPhoto
    ? optimizeCloudinaryUrl(rawPhoto, CLOUDINARY_DISPLAY.photoGallery)
    : ''
  const quote = getReviewCommentPlainText(review.comment)
  const author = review.customerName.trim() || 'Cliente'
  const ratingSlots = getAdelinaSlotStates(review.rating, 1)

  return (
    <section className={styles.section} aria-labelledby="featured-reviews-heading">
      <div className={styles.heading}>
        <h2 id="featured-reviews-heading">Últimas valoraciones</h2>
        <span>Lo que se habla</span>
      </div>
      <button
        type="button"
        className={styles.card}
        onClick={() => onOpenRestaurant(restaurant)}
        aria-label={`Ver ${restaurant.name}`}
      >
        {photoUrl ? (
          <img
            key={photoUrl}
            src={photoUrl}
            alt=""
            className={`${styles.photo} ${fading ? styles.photoOut : styles.photoIn}`}
          />
        ) : (
          <span className={styles.fallback} aria-hidden="true">
            {restaurant.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className={styles.scrim} aria-hidden="true" />

        <span className={styles.topBar}>
          <span className={styles.chip}>{restaurant.name}</span>
          <span
            className={styles.scoreChip}
            aria-label={`Valoración ${review.rating} de 5`}
          >
            {ratingSlots.map((state, slotIndex) => (
              <AdelinaCoin
                key={slotIndex}
                size="sm"
                variant="review"
                alt=""
                className={state === 'full' ? styles.coinOn : styles.coinOff}
              />
            ))}
          </span>
        </span>

        <span className={`${styles.glass} ${fading ? styles.glassOut : styles.glassIn}`}>
          <span className={styles.kicker}>Mejor reseña</span>
          <span className={styles.quote}>
            {quote || 'Una de las mejores opiniones de este local.'}
          </span>
          <span className={styles.author}>
            <span className={styles.avatar} aria-hidden="true">
              {author.charAt(0).toUpperCase()}
            </span>
            {author}
          </span>
        </span>

        {items.length > 1 ? (
          <>
            <span className={styles.dots} aria-hidden="true">
              {items.map((entry, dotIndex) => (
                <span
                  key={`${entry.restaurant.slug}-${entry.review.id}`}
                  className={dotIndex === index ? styles.dotOn : styles.dotOff}
                />
              ))}
            </span>
            <span className={styles.progress} aria-hidden="true">
              <span key={index} className={styles.progressBar} />
            </span>
          </>
        ) : null}
      </button>
    </section>
  )
}

export default FeaturedReviewHighlight
