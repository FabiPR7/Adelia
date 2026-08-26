import { useEffect, useMemo, useState } from 'react'
import AdelinaCoin from '../AdelinaCoin'
import ReviewCommentBody from '../ReviewCommentBody'
import {
  fetchPublicReviews,
  type PublicCompanyReview,
} from '../../services/publicApi'
import type { AdelinaSlotState } from '../../types/review'
import { getAdelinaSlotStates, normalizeReviewRating } from '../../types/review'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl, optimizeCloudinaryVideoUrl } from '../../utils/cloudinaryUrl'
import styles from './PublicRestaurantReviews.module.css'

interface PublicRestaurantReviewsProps {
  companySlug: string
  companyName: string
}

const ADELINA_RATING_FILTERS = ['all', 1, 2, 3, 4, 5] as const
type AdelinaRatingFilter = (typeof ADELINA_RATING_FILTERS)[number]

function formatReviewDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getAuthorInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'C'
}

function avatarTone(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 42% 42%)`
}

function AdelinaSlotRow({
  slotStates,
  size = 'sm',
}: {
  slotStates: AdelinaSlotState[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className={styles.ratingRow} role="img" aria-hidden="true">
      {slotStates.map((state, index) => (
        <div key={index} className={styles.ratingSlot}>
          <AdelinaCoin
            size={size}
            variant="review"
            alt=""
            className={state === 'full' ? styles.coinActive : styles.coinMuted}
          />
        </div>
      ))}
    </div>
  )
}

function PublicReviewCard({
  review,
  companySlug,
  companyName,
}: {
  review: PublicCompanyReview
  companySlug: string
  companyName: string
}) {
  const authorName = review.customerName.trim() || 'Cliente'
  const ratingSlots = getAdelinaSlotStates(review.rating, 1)

  return (
    <article className={styles.reviewCard}>
      <header className={styles.reviewHeader}>
        <div className={styles.authorBlock}>
          <span
            className={styles.avatar}
            style={{ background: avatarTone(authorName) }}
            aria-hidden="true"
          >
            {getAuthorInitial(authorName)}
          </span>
          <div className={styles.authorMeta}>
            <strong className={styles.reviewAuthor}>{authorName}</strong>
            <time className={styles.reviewDate} dateTime={review.createdAt}>
              {formatReviewDate(review.createdAt)}
            </time>
          </div>
        </div>

        <AdelinaSlotRow slotStates={ratingSlots} />
      </header>

      <ReviewCommentBody
        comment={review.comment}
        slug={companySlug}
        taggedProducts={review.taggedProducts}
        taggedPromotions={review.taggedPromotions}
        className={styles.reviewText}
      />

      {review.mediaItems.length > 0 ? (
        <ul className={styles.mediaGrid} aria-label="Fotos y vídeos de la reseña">
          {review.mediaItems.map((item, index) => (
            <li key={`${item.url}-${index}`} className={styles.mediaItem}>
              {item.type === 'image' ? (
                <img
                  src={optimizeCloudinaryUrl(item.url, CLOUDINARY_DISPLAY.photoPreview)}
                  alt=""
                  className={styles.mediaPreview}
                  loading="lazy"
                />
              ) : (
                <video
                  src={optimizeCloudinaryVideoUrl(item.url)}
                  className={styles.mediaPreview}
                  controls
                  muted
                  preload="metadata"
                  playsInline
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {review.ownerReply?.text ? (
        <div className={styles.ownerReply}>
          <strong>Respuesta de {companyName}</strong>
          <p>{review.ownerReply.text}</p>
        </div>
      ) : null}
    </article>
  )
}

export default function PublicRestaurantReviews({
  companySlug,
  companyName,
}: PublicRestaurantReviewsProps) {
  const [reviews, setReviews] = useState<PublicCompanyReview[]>([])
  const [stats, setStats] = useState({ reviewCount: 0, averageRating: 0 })
  const [ratingFilter, setRatingFilter] = useState<AdelinaRatingFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchPublicReviews(companySlug)
        if (!cancelled) {
          setReviews(data.reviews)
          setStats({
            reviewCount: data.stats.reviewCount,
            averageRating: data.stats.averageRating,
          })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las reseñas.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    setRatingFilter('all')

    return () => {
      cancelled = true
    }
  }, [companySlug])

  const ratingBadge = useMemo(() => (
    stats.averageRating > 0
      ? stats.averageRating.toLocaleString('es-ES', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        })
      : null
  ), [stats.averageRating])

  const summarySlots = getAdelinaSlotStates(stats.averageRating, stats.reviewCount)
  const visibleReviews = useMemo(() => {
    if (ratingFilter === 'all') {
      return reviews
    }
    return reviews.filter((review) => normalizeReviewRating(review.rating) === ratingFilter)
  }, [ratingFilter, reviews])

  return (
    <section className={styles.section} aria-labelledby="public-reviews-heading">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h2 id="public-reviews-heading" className={styles.title}>
            <span className={styles.titleDot} aria-hidden="true" />
            Reseñas
          </h2>
          {stats.reviewCount > 0 && ratingBadge ? (
            <div
              className={styles.summary}
              aria-label={`Valoración ${ratingBadge} de 5`}
            >
              <AdelinaSlotRow slotStates={summarySlots} size="sm" />
              <span className={styles.summaryValue}>{ratingBadge}</span>
            </div>
          ) : null}
        </div>
        <div className={styles.filters} role="group" aria-label="Filtrar reseñas por Adelinas">
          {ADELINA_RATING_FILTERS.map((filter) => {
            const active = ratingFilter === filter
            const label = filter === 'all' ? 'Todas' : String(filter)
            const ariaLabel = filter === 'all'
              ? 'Todas las reseñas'
              : filter === 1
                ? 'Reseñas de 1 Adelina'
                : `Reseñas de ${filter} Adelinas`

            return (
              <button
                key={String(filter)}
                type="button"
                className={`${styles.filterButton} ${filter === 'all' ? styles.filterAll : ''} ${active ? styles.filterActive : ''}`}
                aria-pressed={active}
                aria-label={ariaLabel}
                onClick={() => setRatingFilter(filter)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <p className={styles.loading}>Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <div className={styles.empty}>
          <AdelinaCoin size="sm" variant="review" alt="" />
          <p>Sé el primero en dejar tu opinión tras visitar {companyName}.</p>
        </div>
      ) : visibleReviews.length === 0 ? (
        <div className={styles.empty}>
          <AdelinaCoin size="sm" variant="review" alt="" />
          <p>
            {ratingFilter === 1
              ? 'Nadie ha dejado aún una reseña de 1 Adelina.'
              : `Nadie ha dejado aún una reseña de ${ratingFilter} Adelinas.`}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {visibleReviews.map((review) => (
            <PublicReviewCard
              key={review.id}
              review={review}
              companySlug={companySlug}
              companyName={companyName}
            />
          ))}
        </div>
      )}
    </section>
  )
}
