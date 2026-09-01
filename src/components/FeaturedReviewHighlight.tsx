import { useEffect, useMemo, useState } from 'react'
import AdelinaCoin from './AdelinaCoin'
import {
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import {
  fetchPublicReviews,
  type PublicCompanyReview,
} from '../services/publicApi'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import { getAdelinaSlotStates } from '../types/review'
import { getReviewCommentPlainText } from '../utils/reviewCommentTags'
import {
  pickFeaturedReviewCandidates,
  pickHighestRatedReview,
  pickNextRandomIndex,
} from '../utils/featuredReviewHighlight'
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
    // restaurantKey fija la identidad de la lista; usamos restaurants del mismo render.
    const source = restaurants
    const candidates = pickFeaturedReviewCandidates(source)

    if (candidates.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    setItems([])
    setIndex(0)
    setLoading(true)

    void Promise.all(
      candidates.map(async (restaurant) => {
        try {
          const payload = await fetchPublicReviews(restaurant.slug)
          const review = pickHighestRatedReview(payload.reviews ?? [])
          if (!review) {
            return null
          }
          return { restaurant, review }
        } catch {
          return null
        }
      }),
    ).then((rows) => {
      if (cancelled) {
        return
      }
      const next = rows.filter((row): row is FeaturedReviewItem => row !== null)
      setItems(next)
      setIndex(0)
      setLoading(false)
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
