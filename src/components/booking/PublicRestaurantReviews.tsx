import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AdelinaCoin from '../AdelinaCoin'
import ReviewCommentBody from '../ReviewCommentBody'
import {
  fetchPublicReviewsPage, invalidatePublicReviews,
  markReviewHelpful,
  type PublicCompanyReview,
} from '../../services/publicApi'
import { useAuth } from '../../context/AuthContext'
import type { AdelinaSlotState } from '../../types/review'
import { getAdelinaSlotStates } from '../../types/review'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl, optimizeCloudinaryVideoUrl } from '../../utils/cloudinaryUrl'
import { LEGAL_CONTACT_EMAIL } from '../../content/publicLegal'
import { fetchBlockedIds } from '../../services/customerFriends'
import ReportContentModal from '../ReportContentModal'
import styles from './PublicRestaurantReviews.module.css'

function buildReportHref(companyName: string, authorName: string, createdAt: string): string {
  const subject = `Denuncia de reseña en ${companyName}`
  const body = [
    `Reseña de ${authorName} del ${createdAt} en ${companyName}.`,
    `Enlace: ${window.location.href}`,
    '',
    'Por qué es ilícita o incumple los términos:',
    '',
    'Tu nombre y correo:',
    '',
    'Declaro que actúo de buena fe y que lo que indico es correcto.',
  ].join('\n')
  return `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

interface PublicRestaurantReviewsProps {
  companySlug: string
  companyName: string
  /** Botón junto al título (p. ej. «Escribir reseña»). */
  headerAction?: ReactNode
  /** Cambia tras escribir o editar tu reseña: se vuelven a pedir. */
  refreshKey?: number
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
  onBlocked,
}: {
  review: PublicCompanyReview
  companySlug: string
  companyName: string
  onBlocked: (uid: string) => void
}) {
  const authorName = review.customerName.trim() || 'Cliente'
  const ratingSlots = getAdelinaSlotStates(review.rating, 1)
  const { user } = useAuth()
  const isOwn = Boolean(user && user.uid === review.id)
  const [helpful, setHelpful] = useState(review.helpfulCount ?? 0)
  const [voted, setVoted] = useState(false)
  const [voting, setVoting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  const vote = async () => {
    if (voted || voting || isOwn) return
    setVoting(true)
    setVoteError(null)
    // Se suma al momento y se confirma con el servidor.
    setHelpful((count) => count + 1)
    setVoted(true)
    try {
      setHelpful(await markReviewHelpful(companySlug, review.id))
    } catch (error) {
      setHelpful((count) => Math.max(0, count - 1))
      setVoted(false)
      setVoteError(error instanceof Error ? error.message : 'No se pudo marcar como útil.')
    } finally {
      setVoting(false)
    }
  }

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

      <div className={styles.reviewFooter}>
        {isOwn ? (
          helpful > 0 ? <span className={styles.helpfulOwn}>👍 {helpful} {helpful === 1 ? 'persona la ha' : 'personas la han'} marcado útil</span> : null
        ) : (
          <button
            type="button"
            className={`${styles.helpfulButton} ${voted ? styles.helpfulOn : ''}`}
            onClick={() => void vote()}
            disabled={voting || voted || !user}
            aria-pressed={voted}
            title={user ? undefined : 'Entra en tu cuenta para votar'}
          >
            <span aria-hidden="true">👍</span> Útil{helpful > 0 ? ` · ${helpful}` : ''}
          </button>
        )}
        {user && !isOwn ? (
          <button type="button" className={styles.reportLink} onClick={() => setReportOpen(true)}>
            Reportar
          </button>
        ) : !user ? (
          <a className={styles.reportLink} href={buildReportHref(companyName, authorName, review.createdAt)}>
            Denunciar
          </a>
        ) : null}
      </div>
      {reportOpen ? (
        <ReportContentModal
          target={{ targetType: 'review', companySlug, reviewId: review.id }}
          authorName={authorName}
          blockableUid={review.id}
          onClose={() => setReportOpen(false)}
          onBlocked={onBlocked}
        />
      ) : null}
      {voteError ? <p className={styles.helpfulError} role="status">{voteError}</p> : null}
    </article>
  )
}

export default function PublicRestaurantReviews({
  companySlug,
  companyName,
  headerAction,
  refreshKey = 0,
}: PublicRestaurantReviewsProps) {
  const [reviews, setReviews] = useState<PublicCompanyReview[]>([])
  const [stats, setStats] = useState({ reviewCount: 0, averageRating: 0 })
  const [ratingFilter, setRatingFilter] = useState<AdelinaRatingFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Reseñas por páginas de 10: «Ver más reseñas» pide las siguientes. El filtro
  // de Adelinas lo aplica el servidor.
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasAnyReview, setHasAnyReview] = useState(false)

  useEffect(() => {
    setRatingFilter('all')
  }, [companySlug])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        if (refreshKey > 0) invalidatePublicReviews(companySlug)
        const data = await fetchPublicReviewsPage(companySlug, {
          rating: ratingFilter === 'all' ? null : ratingFilter,
        })
        if (!cancelled) {
          setReviews(data.reviews)
          setNextBefore(data.nextBefore)
          setStats({
            reviewCount: data.stats.reviewCount,
            averageRating: data.stats.averageRating,
          })
          setHasAnyReview(data.stats.reviewCount > 0 || data.reviews.length > 0)
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

    return () => {
      cancelled = true
    }
  }, [companySlug, ratingFilter, refreshKey])

  const loadMore = async () => {
    if (!nextBefore || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchPublicReviewsPage(companySlug, {
        before: nextBefore,
        rating: ratingFilter === 'all' ? null : ratingFilter,
      })
      setReviews((current) => {
        const seen = new Set(current.map((review) => review.id))
        return [...current, ...data.reviews.filter((review) => !seen.has(review.id))]
      })
      setNextBefore(data.nextBefore)
    } catch {
      setNextBefore(null)
    } finally {
      setLoadingMore(false)
    }
  }

  const ratingBadge = useMemo(() => (
    stats.averageRating > 0
      ? stats.averageRating.toLocaleString('es-ES', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        })
      : null
  ), [stats.averageRating])

  const summarySlots = getAdelinaSlotStates(stats.averageRating, stats.reviewCount)
  // Las reseñas de quien has bloqueado no te salen.
  const { user } = useAuth()
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (!user) {
      setBlockedIds(new Set())
      return
    }
    let cancelled = false
    void fetchBlockedIds(user.uid).then((ids) => {
      if (!cancelled) setBlockedIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [user])
  const visibleReviews = useMemo(
    () => (blockedIds.size > 0 ? reviews.filter((review) => !blockedIds.has(review.id)) : reviews),
    [reviews, blockedIds],
  )

  return (
    <section className={styles.section} aria-labelledby="public-reviews-heading">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h2 id="public-reviews-heading" className={styles.title}>
            <span className={styles.titleDot} aria-hidden="true" />
            Reseñas
          </h2>
          {headerAction}
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
        <div className={styles.filters} data-no-browse-swipe role="group" aria-label="Filtrar reseñas por Adelinas">
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
        <p className={styles.verifiedNote}>Solo pueden opinar clientes con una reserva confirmada en este local.</p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <p className={styles.loading}>Cargando reseñas…</p>
      ) : !hasAnyReview ? (
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
              onBlocked={(uid) => setBlockedIds((current) => new Set([...current, uid]))}
            />
          ))}
          {nextBefore ? (
            <button type="button" className={styles.loadMore} onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Cargando…' : 'Ver más reseñas'}
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
