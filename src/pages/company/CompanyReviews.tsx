import { useCallback, useEffect, useMemo, useState } from 'react'
import AdelinaCoin from '../../components/AdelinaCoin'
import ReviewCommentBody from '../../components/ReviewCommentBody'
import { useAuth } from '../../context/AuthContext'
import { getCompanyReviews, submitCompanyReviewReply } from '../../services/companyReviews'
import { getFirestoreErrorMessage } from '../../services/firestore'
import type { AdelinaSlotState, CompanyReview, CompanyReviewOwnerReply } from '../../types/review'
import { computeAverageReviewRating, getAdelinaSlotStates, ADELINA_RATING_SLOTS, MAX_REVIEW_REPLY_LENGTH } from '../../types/review'
import { getCompanyMainPhotoUrl } from '../../utils/companyPhotos'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import styles from './CompanyReviews.module.css'

interface CompanyReviewsProps {
  companyId: string
}

function formatRating(value: number): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatReviewDate(date: Date): string {
  return date.toLocaleDateString('es-ES', {
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

interface AdelinaSlotRowProps {
  slotStates: AdelinaSlotState[]
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  rowClassName?: string
  ariaLabel?: string
}

function AdelinaSlotRow({
  slotStates,
  size = 'md',
  className,
  rowClassName,
  ariaLabel,
}: AdelinaSlotRowProps) {
  return (
    <div
      className={rowClassName}
      aria-label={ariaLabel}
      role="img"
    >
      {slotStates.map((state, index) => (
        <div key={index} className={className}>
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

interface ReviewCardProps {
  review: CompanyReview
  companyId: string
  companyName: string
  companySlug?: string
  onReplySaved: (reviewId: string, reply: CompanyReviewOwnerReply) => void
}

function ReviewCard({ review, companyId, companyName, companySlug, onReplySaved }: ReviewCardProps) {
  const authorName = review.customerName.trim() || 'Cliente'
  const tagCount = review.taggedProducts.length + review.taggedPromotions.length
  const ratingSlots = getAdelinaSlotStates(review.rating, 1)
  const filledSlots = ratingSlots.filter((state) => state === 'full').length
  const hasReply = Boolean(review.ownerReply?.text)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyDraft, setReplyDraft] = useState(review.ownerReply?.text ?? '')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  useEffect(() => {
    setReplyDraft(review.ownerReply?.text ?? '')
  }, [review.ownerReply?.text])

  const handleReplySubmit = async () => {
    setReplySubmitting(true)
    setReplyError(null)

    try {
      const savedReply = await submitCompanyReviewReply(
        companyId,
        review.id,
        replyDraft,
        review.ownerReply,
      )
      onReplySaved(review.id, savedReply)
      setReplyOpen(false)
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'No se pudo guardar la respuesta.')
    } finally {
      setReplySubmitting(false)
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
            <time className={styles.reviewDate} dateTime={review.createdAt.toISOString()}>
              {formatReviewDate(review.createdAt)}
            </time>
          </div>
        </div>

        <div className={styles.ratingBadge}>
          <AdelinaSlotRow
            slotStates={ratingSlots}
            size="sm"
            className={styles.reviewCoinSlot}
            rowClassName={styles.reviewCoinRow}
            ariaLabel={`${filledSlots} de ${ADELINA_RATING_SLOTS} Adelinas de reseña`}
          />
        </div>
      </header>

      {companySlug ? (
        <ReviewCommentBody
          comment={review.comment}
          slug={companySlug}
          taggedProducts={review.taggedProducts}
          taggedPromotions={review.taggedPromotions}
          className={styles.reviewText}
        />
      ) : (
        <p className={styles.reviewText}>{review.comment}</p>
      )}

      {review.mediaItems.length > 0 ? (
        <ul className={styles.reviewMediaGrid} aria-label="Fotos y vídeos de la reseña">
          {review.mediaItems.map((item, index) => (
            <li key={`${item.url}-${index}`} className={styles.reviewMediaItem}>
              {item.type === 'image' ? (
                <img
                  src={optimizeCloudinaryUrl(item.url, CLOUDINARY_DISPLAY.photoPreview)}
                  alt=""
                  className={styles.reviewMediaPreview}
                  loading="lazy"
                />
              ) : (
                <video src={item.url} className={styles.reviewMediaPreview} controls muted preload="metadata" />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {(review.hasPhoto || tagCount > 0) && (
        <footer className={styles.reviewFooter}>
          {review.hasPhoto ? (
            <span className={styles.reviewChip}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7a2 2 0 0 1 2-2h2l1-2h6l1 2h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <circle cx="12" cy="12.5" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
              </svg>
              Con fotos
            </span>
          ) : null}
          {tagCount > 0 ? (
            <span className={styles.reviewChip}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
              </svg>
              {tagCount} {tagCount === 1 ? 'referencia' : 'referencias'}
            </span>
          ) : null}
        </footer>
      )}

      <section className={styles.replySection} aria-label="Respuesta del restaurante">
        {hasReply && !replyOpen ? (
          <div className={styles.replyPublished}>
            <div className={styles.replyPublishedHeader}>
              <strong>Respuesta de {companyName}</strong>
              {review.ownerReply?.updatedAt ? (
                <time dateTime={review.ownerReply.updatedAt.toISOString()}>
                  {formatReviewDate(review.ownerReply.updatedAt)}
                </time>
              ) : review.ownerReply?.createdAt ? (
                <time dateTime={review.ownerReply.createdAt.toISOString()}>
                  {formatReviewDate(review.ownerReply.createdAt)}
                </time>
              ) : null}
            </div>
            <p className={styles.replyText}>{review.ownerReply?.text}</p>
            <button
              type="button"
              className={styles.replyEditButton}
              onClick={() => setReplyOpen(true)}
            >
              Editar respuesta
            </button>
          </div>
        ) : null}

        {!hasReply && !replyOpen ? (
          <button
            type="button"
            className={styles.replyActionButton}
            onClick={() => setReplyOpen(true)}
          >
            Responder a esta reseña
          </button>
        ) : null}

        {replyOpen ? (
          <div className={styles.replyForm}>
            <label className={styles.replyLabel} htmlFor={`reply-${review.id}`}>
              {hasReply ? 'Editar tu respuesta' : 'Tu respuesta (solo una por reseña)'}
            </label>
            <textarea
              id={`reply-${review.id}`}
              className={styles.replyInput}
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              rows={4}
              maxLength={MAX_REVIEW_REPLY_LENGTH}
              placeholder="Agradece al cliente, aclara detalles o comparte tu punto de vista…"
              disabled={replySubmitting}
            />
            <div className={styles.replyFormFooter}>
              <span className={styles.replyCounter}>
                {replyDraft.trim().length}/{MAX_REVIEW_REPLY_LENGTH}
              </span>
              <div className={styles.replyActions}>
                <button
                  type="button"
                  className={styles.replyCancelButton}
                  onClick={() => {
                    setReplyOpen(false)
                    setReplyDraft(review.ownerReply?.text ?? '')
                    setReplyError(null)
                  }}
                  disabled={replySubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.replySubmitButton}
                  onClick={() => void handleReplySubmit()}
                  disabled={replySubmitting || replyDraft.trim().length < 3}
                >
                  {replySubmitting ? 'Guardando…' : hasReply ? 'Guardar cambios' : 'Publicar respuesta'}
                </button>
              </div>
            </div>
            {replyError ? <p className={styles.replyError}>{replyError}</p> : null}
          </div>
        ) : null}
      </section>
    </article>
  )
}

function CompanyReviews({ companyId }: CompanyReviewsProps) {
  const { company } = useAuth()
  const [reviews, setReviews] = useState<CompanyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getCompanyReviews(companyId)
      setReviews(data)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const stats = useMemo(() => {
    if (!company) {
      return { reviewCount: 0, averageRating: 0 }
    }

    const reviewCount = reviews.length > 0
      ? reviews.length
      : Math.max(0, company.reviewCount ?? 0)
    const reviewRatingSum = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0)
      : Math.max(0, company.reviewRatingSum ?? 0)

    return {
      reviewCount,
      averageRating: computeAverageReviewRating(reviewRatingSum, reviewCount),
    }
  }, [company, reviews])

  const mainPhotoUrl = useMemo(() => {
    if (!company) {
      return null
    }

    const raw = getCompanyMainPhotoUrl(company.photos, company.mainPhotoIndex)
      || company.logoUrl
      || null

    return raw ? optimizeCloudinaryUrl(raw, CLOUDINARY_DISPLAY.photoGallery) : null
  }, [company])

  const adelinaSlotStates = useMemo(
    () => getAdelinaSlotStates(stats.averageRating, stats.reviewCount),
    [stats.averageRating, stats.reviewCount],
  )

  const filledAdelinaSlots = adelinaSlotStates.filter((state) => state === 'full').length

  const handleReplySaved = useCallback((reviewId: string, reply: CompanyReviewOwnerReply) => {
    setReviews((current) => current.map((item) => (
      item.id === reviewId ? { ...item, ownerReply: reply } : item
    )))
  }, [])

  if (!company) {
    return null
  }

  return (
    <div className={styles.wrapper}>
      <section className={styles.hero} aria-label="Resumen de reseñas">
        {mainPhotoUrl ? (
          <img
            src={mainPhotoUrl}
            alt=""
            className={styles.heroImage}
          />
        ) : (
          <div className={styles.heroFallback} aria-hidden="true">
            {company.name.charAt(0)}
          </div>
        )}

        <div className={styles.heroOverlay} aria-hidden="true" />

        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Reseñas de clientes</p>
          <h2 className={styles.restaurantName}>{company.name}</h2>

          <div className={styles.headerStats}>
            <div className={styles.adelinasBlock}>
              <AdelinaSlotRow
                slotStates={adelinaSlotStates}
                size="xl"
                className={styles.adelinasCoinSlot}
                rowClassName={styles.adelinasRow}
                ariaLabel={`${filledAdelinaSlots} de ${ADELINA_RATING_SLOTS} Adelinas según la puntuación media`}
              />
              <strong className={styles.reviewCountValue}>
                {stats.reviewCount.toLocaleString('es-ES')}
              </strong>
              <span className={styles.reviewCountLabel}>
                {stats.reviewCount === 1 ? 'Reseña' : 'Reseñas'}
              </span>
            </div>

            <div className={styles.ratingBlock}>
              <strong className={styles.ratingValue}>{formatRating(stats.averageRating)}</strong>
              <span className={styles.ratingScale}>/ 5</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.reviewsPanel} aria-labelledby="company-reviews-heading">
        <div className={styles.panelHeader}>
          <div>
            <h3 id="company-reviews-heading">Opiniones recientes</h3>
            <p className={styles.panelSubtitle}>
              {stats.reviewCount > 0
                ? `${stats.reviewCount} ${stats.reviewCount === 1 ? 'cliente ha compartido' : 'clientes han compartido'} su experiencia`
                : 'Todavía no hay reseñas publicadas'}
            </p>
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadReviews()}
            disabled={loading}
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.panelBody}>
          {loading && reviews.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <AdelinaCoin size="sm" variant="review" alt="" />
              </span>
              <p>Cargando reseñas…</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <AdelinaCoin size="sm" variant="review" alt="" />
              </span>
              <strong>Sin reseñas todavía</strong>
              <p>Cuando un cliente publique una opinión tras su visita, aparecerá aquí con su puntuación y comentario.</p>
            </div>
          ) : (
            <div className={styles.reviewsGrid}>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  companyId={companyId}
                  companyName={company.name}
                  companySlug={company.slug}
                  onReplySaved={handleReplySaved}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default CompanyReviews
