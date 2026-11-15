import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownWideNarrow,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquareReply,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Search,
  Star,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react'
import AdelinaCoin from '../../components/AdelinaCoin'
import ReviewCommentBody from '../../components/ReviewCommentBody'
import { useAuth } from '../../context/AuthContext'
import { useCompanyDemo } from '../../context/CompanyDemoContext'
import { getCompanyReviews, submitCompanyReviewReply } from '../../services/companyReviews'
import { COMPANY_REVIEW_PAGE_SIZE } from '../../services/firestoreQuery'
import { cleanReviewExcerpt } from '../../utils/reviewCommentTags'
import { getFirestoreErrorMessage } from '../../services/firestore'
import type { CompanyReview, CompanyReviewOwnerReply, ReviewMediaItem } from '../../types/review'
import {
  ADELINA_RATING_SLOTS,
  computeAverageReviewRating,
  getAdelinaSlotStates,
  MAX_REVIEW_REPLY_LENGTH,
  MIN_REVIEW_REPLY_LENGTH,
} from '../../types/review'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl, optimizeCloudinaryVideoUrl } from '../../utils/cloudinaryUrl'
import styles from './CompanyReviews.module.css'

interface CompanyReviewsProps {
  companyId: string
}

type ReplyFilter = 'all' | 'pending' | 'replied'
type SortOrder = 'recent' | 'oldest' | 'best' | 'worst'

const PAGE_STEP = 12
const DAY_MS = 24 * 60 * 60 * 1000

function formatRating(value: number): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatReviewDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRelativeDate(date: Date, now = new Date()): string {
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)

  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) {
    const weeks = Math.round(days / 7)
    return weeks === 1 ? 'Hace 1 semana' : `Hace ${weeks} semanas`
  }
  return formatReviewDate(date)
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Cliente'
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'C'
  return (parts[0].charAt(0) + (parts[1]?.charAt(0) ?? '')).toUpperCase()
}

function avatarTone(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 32% 44%)`
}

function ratingTone(rating: number): 'good' | 'mid' | 'bad' {
  if (rating >= 4) return 'good'
  if (rating === 3) return 'mid'
  return 'bad'
}

/** Respuestas rápidas según la nota; el local las puede editar antes de publicar. */
function replyTemplates(review: CompanyReview, companyName: string): { label: string; text: string }[] {
  const name = firstName(review.customerName)

  if (review.rating >= 4) {
    return [
      {
        label: 'Agradecer',
        text: `¡Muchas gracias, ${name}! Nos alegra mucho que disfrutaras de tu visita. ¡Te esperamos pronto en ${companyName}!`,
      },
      {
        label: 'Invitar a volver',
        text: `Gracias por tu reseña, ${name}. Es un placer tenerte con nosotros: la próxima vez pregúntanos por las novedades de la carta. ¡Hasta pronto!`,
      },
    ]
  }

  if (review.rating === 3) {
    return [
      {
        label: 'Agradecer y mejorar',
        text: `Gracias por tu opinión, ${name}. Tomamos nota de lo que nos cuentas para seguir mejorando. Esperamos verte de nuevo y que la próxima sea de 5.`,
      },
    ]
  }

  return [
    {
      label: 'Disculparse',
      text: `Sentimos mucho que tu experiencia no fuera la que esperabas, ${name}. No es lo habitual en ${companyName} y nos gustaría compensarte: escríbenos y lo hablamos.`,
    },
    {
      label: 'Pedir detalles',
      text: `Gracias por contárnoslo, ${name}. Queremos entender qué pasó para que no se repita. ¿Nos escribes con más detalles? Nos encantaría tener otra oportunidad.`,
    },
  ]
}

function csvCell(value: string | number): string {
  const text = String(value ?? '')
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function exportReviewsCsv(reviews: CompanyReview[], companySlug: string) {
  const header = ['Fecha', 'Cliente', 'Puntuación', 'Comentario', 'Productos y promos', 'Fotos o vídeos', 'Respuesta', 'Fecha de respuesta']
  const rows = reviews.map((review) => [
    review.createdAt.toLocaleDateString('es-ES'),
    review.customerName.trim() || 'Cliente',
    review.rating,
    cleanReviewExcerpt(review.comment),
    [...review.taggedProducts.map((item) => item.name), ...review.taggedPromotions.map((item) => item.name)].join(', '),
    review.mediaItems.length,
    review.ownerReply?.text ?? '',
    review.ownerReply ? (review.ownerReply.updatedAt ?? review.ownerReply.createdAt).toLocaleDateString('es-ES') : '',
  ])
  // Punto y coma + BOM: así Excel en español lo abre con columnas y tildes bien.
  const csv = '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `resenas-${companySlug || 'restaurante'}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function RatingStars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className={styles.stars} role="img" aria-label={`${rating} de 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={size}
          aria-hidden="true"
          className={index < Math.round(rating) ? styles.starOn : styles.starOff}
        />
      ))}
    </span>
  )
}

interface ReviewCardProps {
  review: CompanyReview
  companyId: string
  companyName: string
  companyLogoUrl: string
  companySlug?: string
  customerReviewCount: number
  onReplySaved: (reviewId: string, reply: CompanyReviewOwnerReply) => void
  onOpenMedia: (items: ReviewMediaItem[], index: number) => void
}

function ReviewCard({
  review,
  companyId,
  companyName,
  companyLogoUrl,
  companySlug,
  customerReviewCount,
  onReplySaved,
  onOpenMedia,
}: ReviewCardProps) {
  const demo = useCompanyDemo()
  const authorName = review.customerName.trim() || 'Cliente'
  const hasReply = Boolean(review.ownerReply?.text)
  const tone = ratingTone(review.rating)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyDraft, setReplyDraft] = useState(review.ownerReply?.text ?? '')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setReplyDraft(review.ownerReply?.text ?? '')
  }, [review.ownerReply?.text])

  useEffect(() => {
    if (replyOpen) {
      textareaRef.current?.focus()
    }
  }, [replyOpen])

  const trimmedLength = replyDraft.trim().length
  const canSubmit = !replySubmitting && trimmedLength >= MIN_REVIEW_REPLY_LENGTH

  const handleReplySubmit = async () => {
    if (!canSubmit) {
      return
    }

    setReplySubmitting(true)
    setReplyError(null)

    try {
      const savedReply = await submitCompanyReviewReply(companyId, review.id, replyDraft, review.ownerReply)
      onReplySaved(review.id, savedReply)
      setReplyOpen(false)
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'No se pudo guardar la respuesta.')
    } finally {
      setReplySubmitting(false)
    }
  }

  const tags = [
    ...review.taggedProducts.map((item) => ({ key: `p-${item.nodeId}`, name: item.name, kind: 'Producto' })),
    ...review.taggedPromotions.map((item) => ({ key: `r-${item.promotionId}`, name: item.name, kind: 'Promoción' })),
  ]

  return (
    <article className={`${styles.reviewCard} ${!hasReply ? styles.reviewCardPending : ''}`}>
      <header className={styles.reviewHeader}>
        <span className={styles.avatar} style={{ background: avatarTone(authorName) }} aria-hidden="true">
          {initials(authorName)}
        </span>
        <div className={styles.authorMeta}>
          <div className={styles.authorLine}>
            <strong className={styles.reviewAuthor}>{authorName}</strong>
            {customerReviewCount > 1 ? (
              <span className={styles.loyalBadge} title={`${customerReviewCount} reseñas en tu local`}>
                {customerReviewCount} reseñas
              </span>
            ) : null}
          </div>
          <span className={styles.reviewMetaLine}>
            <time dateTime={review.createdAt.toISOString()} title={formatReviewDate(review.createdAt)}>
              {formatRelativeDate(review.createdAt)}
            </time>
            {review.adelinasEarned > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className={styles.adelinasEarned}>
                  <AdelinaCoin size="sm" variant="review" alt="" />
                  +{review.adelinasEarned} para el cliente
                </span>
              </>
            ) : null}
          </span>
        </div>
        <div className={styles.reviewHeaderRight}>
          <span className={`${styles.ratingPill} ${styles[`rating_${tone}`]}`}>
            <Star size={13} aria-hidden="true" />
            {review.rating}
          </span>
          <span className={`${styles.replyStatus} ${hasReply ? styles.replyStatusDone : styles.replyStatusPending}`}>
            {hasReply ? 'Respondida' : 'Sin responder'}
          </span>
        </div>
      </header>

      <div className={styles.reviewBody}>
        <RatingStars rating={review.rating} />
        {review.comment.trim() ? (
          companySlug ? (
            <ReviewCommentBody
              comment={review.comment}
              slug={companySlug}
              taggedProducts={review.taggedProducts}
              taggedPromotions={review.taggedPromotions}
              className={styles.reviewText}
            />
          ) : (
            <p className={styles.reviewText}>{cleanReviewExcerpt(review.comment)}</p>
          )
        ) : (
          <p className={`${styles.reviewText} ${styles.reviewTextEmpty}`}>El cliente puntuó sin dejar comentario.</p>
        )}

        {review.mediaItems.length > 0 ? (
          <ul className={styles.mediaStrip} aria-label="Fotos y vídeos de la reseña">
            {review.mediaItems.map((item, index) => (
              <li key={`${item.url}-${index}`}>
                <button
                  type="button"
                  className={styles.mediaThumb}
                  onClick={() => onOpenMedia(review.mediaItems, index)}
                  aria-label={`Ver ${item.type === 'image' ? 'foto' : 'vídeo'} ${index + 1} en grande`}
                >
                  {item.type === 'image' ? (
                    <img src={optimizeCloudinaryUrl(item.url, CLOUDINARY_DISPLAY.photoPreview)} alt="" loading="lazy" />
                  ) : (
                    <>
                      <video src={optimizeCloudinaryVideoUrl(item.url)} muted preload="metadata" playsInline />
                      <span className={styles.mediaPlay} aria-hidden="true">▶</span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {tags.length > 0 ? (
          <div className={styles.tagList}>
            {tags.map((tag) => (
              <span key={tag.key} className={styles.tagChip} title={tag.kind}>
                <Tag size={12} aria-hidden="true" />
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <section className={styles.replySection} aria-label="Respuesta del restaurante">
        {hasReply && !replyOpen ? (
          <div className={styles.replyPublished}>
            <span className={styles.replyAvatar} aria-hidden="true">
              {companyLogoUrl ? <img src={companyLogoUrl} alt="" /> : companyName.charAt(0)}
            </span>
            <div className={styles.replyBubble}>
              <div className={styles.replyPublishedHeader}>
                <strong>{companyName}</strong>
                <span className={styles.ownerBadge}>Propietario</span>
                {review.ownerReply ? (
                  <time dateTime={(review.ownerReply.updatedAt ?? review.ownerReply.createdAt).toISOString()}>
                    {formatRelativeDate(review.ownerReply.updatedAt ?? review.ownerReply.createdAt)}
                  </time>
                ) : null}
                {demo ? null : (
                  <button type="button" className={styles.replyEditButton} onClick={() => setReplyOpen(true)}>
                    <Pencil size={13} aria-hidden="true" />
                    Editar
                  </button>
                )}
              </div>
              <p className={styles.replyText}>{review.ownerReply?.text}</p>
            </div>
          </div>
        ) : null}

        {!demo && !hasReply && !replyOpen ? (
          <button type="button" className={styles.replyActionButton} onClick={() => setReplyOpen(true)}>
            <MessageSquareReply size={15} aria-hidden="true" />
            Responder
          </button>
        ) : null}

        {replyOpen ? (
          <div className={styles.replyForm}>
            <div className={styles.replyFormHead}>
              <label className={styles.replyLabel} htmlFor={`reply-${review.id}`}>
                {hasReply ? 'Editar tu respuesta' : `Responder a ${firstName(authorName)}`}
              </label>
              <span className={styles.replyPublicNote}>Se publica en tu ficha, debajo de la reseña</span>
            </div>
            <div className={styles.templateRow} aria-label="Respuestas rápidas">
              {replyTemplates(review, companyName).map((template) => (
                <button
                  key={template.label}
                  type="button"
                  className={styles.templateChip}
                  onClick={() => {
                    setReplyDraft(template.text)
                    textareaRef.current?.focus()
                  }}
                  disabled={replySubmitting}
                >
                  {template.label}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              id={`reply-${review.id}`}
              className={styles.replyInput}
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void handleReplySubmit()
                }
              }}
              rows={4}
              maxLength={MAX_REVIEW_REPLY_LENGTH}
              placeholder="Agradece al cliente, aclara detalles o comparte tu punto de vista…"
              disabled={replySubmitting}
            />
            <div className={styles.replyFormFooter}>
              <span className={styles.replyCounter}>
                {trimmedLength}/{MAX_REVIEW_REPLY_LENGTH}
                <span className={styles.replyShortcut}>Ctrl + Enter para publicar</span>
              </span>
              <div className={styles.replyActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
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
                  className={styles.primaryButton}
                  onClick={() => void handleReplySubmit()}
                  disabled={!canSubmit}
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
  const [query, setQuery] = useState('')
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('all')
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)
  const [mediaOnly, setMediaOnly] = useState(false)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)
  const [lightbox, setLightbox] = useState<{ items: ReviewMediaItem[]; index: number } | null>(null)

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

  useEffect(() => {
    setVisibleCount(PAGE_STEP)
  }, [query, replyFilter, ratingFilter, mediaOnly, tagFilter, sortOrder])

  useEffect(() => {
    if (!lightbox) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
      if (event.key === 'ArrowRight') {
        setLightbox((current) => current && { ...current, index: (current.index + 1) % current.items.length })
      }
      if (event.key === 'ArrowLeft') {
        setLightbox((current) => current && {
          ...current,
          index: (current.index - 1 + current.items.length) % current.items.length,
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightbox])

  // Cifras globales: los totales del local (todas las reseñas), no solo las cargadas.
  const totals = useMemo(() => {
    const reviewCount = Math.max(reviews.length, company?.reviewCount ?? 0)
    const ratingSum = (company?.reviewCount ?? 0) >= reviews.length
      ? Math.max(0, company?.reviewRatingSum ?? 0)
      : reviews.reduce((sum, review) => sum + review.rating, 0)

    return {
      reviewCount,
      averageRating: computeAverageReviewRating(ratingSum, reviewCount),
    }
  }, [company, reviews])

  const analysis = useMemo(() => {
    const now = new Date()
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((review) => review.rating === stars).length,
    }))
    const replied = reviews.filter((review) => review.ownerReply?.text).length
    const pending = reviews.length - replied
    const withMedia = reviews.filter((review) => review.mediaItems.length > 0).length
    const last30 = reviews.filter((review) => now.getTime() - review.createdAt.getTime() <= 30 * DAY_MS)
    const prev30 = reviews.filter((review) => {
      const age = now.getTime() - review.createdAt.getTime()
      return age > 30 * DAY_MS && age <= 60 * DAY_MS
    })
    const avg = (list: CompanyReview[]) =>
      list.length ? list.reduce((sum, review) => sum + review.rating, 0) / list.length : 0

    const months = Array.from({ length: 6 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1)
      const inMonth = reviews.filter((review) =>
        review.createdAt.getFullYear() === date.getFullYear() && review.createdAt.getMonth() === date.getMonth())
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
        count: inMonth.length,
        average: avg(inMonth),
      }
    })

    const mentionMap = new Map<string, { name: string; count: number; ratingSum: number }>()
    for (const review of reviews) {
      const names = new Set([
        ...review.taggedProducts.map((item) => item.name.trim()),
        ...review.taggedPromotions.map((item) => item.name.trim()),
      ].filter(Boolean))
      for (const name of names) {
        const entry = mentionMap.get(name) ?? { name, count: 0, ratingSum: 0 }
        entry.count += 1
        entry.ratingSum += review.rating
        mentionMap.set(name, entry)
      }
    }
    const mentions = [...mentionMap.values()]
      .sort((left, right) => right.count - left.count || right.ratingSum - left.ratingSum)
      .slice(0, 6)

    const customerCounts = new Map<string, number>()
    for (const review of reviews) {
      if (review.customerUid) {
        customerCounts.set(review.customerUid, (customerCounts.get(review.customerUid) ?? 0) + 1)
      }
    }

    return {
      distribution,
      replied,
      pending,
      withMedia,
      replyRate: reviews.length ? Math.round((replied / reviews.length) * 100) : 0,
      last30Count: last30.length,
      last30Average: avg(last30),
      prev30Count: prev30.length,
      months,
      maxMonthCount: Math.max(1, ...months.map((month) => month.count)),
      mentions,
      customerCounts,
    }
  }, [reviews])

  const filteredReviews = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const list = reviews.filter((review) => {
      if (replyFilter === 'pending' && review.ownerReply?.text) return false
      if (replyFilter === 'replied' && !review.ownerReply?.text) return false
      if (ratingFilter != null && review.rating !== ratingFilter) return false
      if (mediaOnly && review.mediaItems.length === 0) return false
      if (tagFilter) {
        const names = [...review.taggedProducts, ...review.taggedPromotions].map((item) => item.name.trim())
        if (!names.includes(tagFilter)) return false
      }
      if (normalized) {
        const haystack = `${review.customerName} ${cleanReviewExcerpt(review.comment)} ${review.ownerReply?.text ?? ''}`.toLowerCase()
        if (!haystack.includes(normalized)) return false
      }
      return true
    })

    return list.sort((left, right) => {
      switch (sortOrder) {
        case 'oldest':
          return left.createdAt.getTime() - right.createdAt.getTime()
        case 'best':
          return right.rating - left.rating || right.createdAt.getTime() - left.createdAt.getTime()
        case 'worst':
          return left.rating - right.rating || right.createdAt.getTime() - left.createdAt.getTime()
        default:
          return right.createdAt.getTime() - left.createdAt.getTime()
      }
    })
  }, [reviews, query, replyFilter, ratingFilter, mediaOnly, tagFilter, sortOrder])

  const hasFilters = Boolean(query.trim()) || replyFilter !== 'all' || ratingFilter != null || mediaOnly || tagFilter != null

  const clearFilters = () => {
    setQuery('')
    setReplyFilter('all')
    setRatingFilter(null)
    setMediaOnly(false)
    setTagFilter(null)
  }

  const handleReplySaved = useCallback((reviewId: string, reply: CompanyReviewOwnerReply) => {
    setReviews((current) => current.map((item) => (item.id === reviewId ? { ...item, ownerReply: reply } : item)))
  }, [])

  const openMedia = useCallback((items: ReviewMediaItem[], index: number) => {
    setLightbox({ items, index })
  }, [])

  if (!company) {
    return null
  }

  const coinStates = getAdelinaSlotStates(totals.averageRating, totals.reviewCount)
  const filledCoins = coinStates.filter((state) => state === 'full').length
  const sampleNote = reviews.length >= COMPANY_REVIEW_PAGE_SIZE
    ? `Análisis de las ${reviews.length} reseñas más recientes.`
    : null
  const trendDelta = analysis.last30Count - analysis.prev30Count
  const visibleReviews = filteredReviews.slice(0, visibleCount)
  const currentMedia = lightbox ? lightbox.items[lightbox.index] : null

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Reseñas</h2>
          <p className={styles.subtitle}>
            Lo que opinan tus clientes tras su visita. Responder rápido mejora tu valoración y da confianza a
            quien aún no te conoce.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => exportReviewsCsv(filteredReviews, company.slug)}
            disabled={filteredReviews.length === 0}
            title="Descarga las reseñas que ves ahora (con los filtros aplicados)"
          >
            <Download size={15} aria-hidden="true" />
            Exportar
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void loadReviews()}
            disabled={loading}
          >
            <RefreshCw size={15} aria-hidden="true" className={loading ? styles.spin : undefined} />
            Actualizar
          </button>
        </div>
      </header>

      {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

      <div className={styles.kpis}>
        <div className={`${styles.kpi} ${styles.kpiScore}`}>
          <span className={styles.kpiLabel}>Puntuación media</span>
          <span className={styles.kpiValue}>
            {totals.reviewCount > 0 ? formatRating(totals.averageRating) : '—'}
            <small>/ 5</small>
          </span>
          <span
            className={styles.coinRow}
            role="img"
            aria-label={`${filledCoins} de ${ADELINA_RATING_SLOTS} Adelinas`}
          >
            {coinStates.map((state, index) => (
              <AdelinaCoin
                key={index}
                size="sm"
                variant="review"
                alt=""
                className={state === 'full' ? styles.coinActive : styles.coinMuted}
              />
            ))}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Reseñas</span>
          <span className={styles.kpiValue}>{totals.reviewCount.toLocaleString('es-ES')}</span>
          <span className={styles.kpiHint}>
            {analysis.last30Count} en los últimos 30 días
            {trendDelta !== 0 ? (
              <span className={trendDelta > 0 ? styles.trendUp : styles.trendDown}>
                {trendDelta > 0 ? ` ▲ ${trendDelta}` : ` ▼ ${Math.abs(trendDelta)}`}
              </span>
            ) : null}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Respondidas</span>
          <span className={styles.kpiValue}>
            {analysis.replyRate}
            <small>%</small>
          </span>
          <span className={styles.kpiBar} aria-hidden="true">
            <span style={{ width: `${analysis.replyRate}%` }} />
          </span>
        </div>
        <button
          type="button"
          className={`${styles.kpi} ${styles.kpiButton} ${analysis.pending > 0 ? styles.kpiAlert : ''}`}
          onClick={() => {
            clearFilters()
            setReplyFilter('pending')
            setSortOrder('worst')
          }}
          disabled={analysis.pending === 0}
        >
          <span className={styles.kpiLabel}>Sin responder</span>
          <span className={styles.kpiValue}>{analysis.pending}</span>
          <span className={styles.kpiHint}>
            {analysis.pending > 0 ? 'Ver primero las peores →' : '¡Todo al día!'}
          </span>
        </button>
      </div>

      {reviews.length > 0 ? (
        <div className={styles.insights}>
          <section className={styles.insightCard} aria-labelledby="reviews-distribution-title">
            <header className={styles.insightHead}>
              <h3 id="reviews-distribution-title">Reparto de puntuaciones</h3>
              <span>Pulsa una fila para filtrar</span>
            </header>
            <ul className={styles.distribution}>
              {analysis.distribution.map((row) => {
                const percent = reviews.length ? Math.round((row.count / reviews.length) * 100) : 0
                const active = ratingFilter === row.stars
                return (
                  <li key={row.stars}>
                    <button
                      type="button"
                      className={`${styles.distributionRow} ${active ? styles.distributionRowOn : ''}`}
                      onClick={() => setRatingFilter(active ? null : row.stars)}
                      aria-pressed={active}
                      disabled={row.count === 0 && !active}
                    >
                      <span className={styles.distributionLabel}>
                        {row.stars}
                        <Star size={12} aria-hidden="true" />
                      </span>
                      <span className={styles.distributionBar}>
                        <span
                          className={styles[`bar_${ratingTone(row.stars)}`]}
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className={styles.distributionCount}>{row.count}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className={styles.insightCard} aria-labelledby="reviews-trend-title">
            <header className={styles.insightHead}>
              <h3 id="reviews-trend-title">
                <TrendingUp size={15} aria-hidden="true" />
                Últimos 6 meses
              </h3>
              <span>
                {analysis.last30Count > 0
                  ? `Media del último mes: ${formatRating(analysis.last30Average)}`
                  : 'Sin reseñas este mes'}
              </span>
            </header>
            <div className={styles.trendChart} role="img" aria-label="Reseñas por mes">
              {analysis.months.map((month) => (
                <div key={month.key} className={styles.trendColumn} title={
                  month.count
                    ? `${month.count} ${month.count === 1 ? 'reseña' : 'reseñas'} · media ${formatRating(month.average)}`
                    : 'Sin reseñas'
                }>
                  <span className={styles.trendAverage}>{month.count ? formatRating(month.average) : ''}</span>
                  <span className={styles.trendTrack}>
                    <span
                      className={`${styles.trendBar} ${month.count ? styles[`bar_${ratingTone(Math.round(month.average))}`] : ''}`}
                      style={{ height: `${Math.max(month.count ? 8 : 0, (month.count / analysis.maxMonthCount) * 100)}%` }}
                    />
                  </span>
                  <span className={styles.trendCount}>{month.count}</span>
                  <span className={styles.trendLabel}>{month.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.insightCard} aria-labelledby="reviews-mentions-title">
            <header className={styles.insightHead}>
              <h3 id="reviews-mentions-title">Lo más mencionado</h3>
              <span>Productos y promos citados</span>
            </header>
            {analysis.mentions.length === 0 ? (
              <p className={styles.insightEmpty}>
                Cuando los clientes etiqueten platos o promociones en sus reseñas, verás aquí cuáles gustan más.
              </p>
            ) : (
              <ul className={styles.mentions}>
                {analysis.mentions.map((mention) => {
                  const average = mention.ratingSum / mention.count
                  const active = tagFilter === mention.name
                  return (
                    <li key={mention.name}>
                      <button
                        type="button"
                        className={`${styles.mentionRow} ${active ? styles.mentionRowOn : ''}`}
                        onClick={() => setTagFilter(active ? null : mention.name)}
                        aria-pressed={active}
                      >
                        <span className={styles.mentionName}>{mention.name}</span>
                        <span className={styles.mentionMeta}>
                          {mention.count} {mention.count === 1 ? 'vez' : 'veces'}
                        </span>
                        <span className={`${styles.mentionScore} ${styles[`rating_${ratingTone(Math.round(average))}`]}`}>
                          <Star size={11} aria-hidden="true" />
                          {formatRating(average)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <section className={styles.listCard} aria-labelledby="company-reviews-heading">
        <h3 id="company-reviews-heading" className={styles.srOnly}>Listado de reseñas</h3>
        <div className={styles.toolbar}>
          <div className={styles.segmented} role="group" aria-label="Filtrar por respuesta">
            {([
              ['all', 'Todas', reviews.length],
              ['pending', 'Sin responder', analysis.pending],
              ['replied', 'Respondidas', analysis.replied],
            ] as [ReplyFilter, string, number][]).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                className={`${styles.segmentedButton} ${replyFilter === id ? styles.segmentedButtonOn : ''}`}
                aria-pressed={replyFilter === id}
                onClick={() => setReplyFilter(id)}
              >
                {label}
                <span className={styles.segmentedCount}>{count}</span>
              </button>
            ))}
          </div>
          <label className={styles.searchField}>
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar por cliente o texto"
            />
          </label>
          <button
            type="button"
            className={`${styles.filterToggle} ${mediaOnly ? styles.filterToggleOn : ''}`}
            onClick={() => setMediaOnly((current) => !current)}
            aria-pressed={mediaOnly}
            disabled={analysis.withMedia === 0 && !mediaOnly}
          >
            <Camera size={14} aria-hidden="true" />
            Con fotos
            <span className={styles.segmentedCount}>{analysis.withMedia}</span>
          </button>
          <label className={styles.sortField}>
            <ArrowDownWideNarrow size={15} aria-hidden="true" />
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              aria-label="Ordenar reseñas"
            >
              <option value="recent">Más recientes</option>
              <option value="oldest">Más antiguas</option>
              <option value="best">Mejor puntuadas</option>
              <option value="worst">Peor puntuadas</option>
            </select>
          </label>
        </div>

        {hasFilters ? (
          <div className={styles.activeFilters}>
            <span>
              {filteredReviews.length} {filteredReviews.length === 1 ? 'resultado' : 'resultados'}
            </span>
            {ratingFilter != null ? (
              <button type="button" className={styles.filterPill} onClick={() => setRatingFilter(null)}>
                {ratingFilter} estrellas <X size={12} aria-hidden="true" />
              </button>
            ) : null}
            {tagFilter ? (
              <button type="button" className={styles.filterPill} onClick={() => setTagFilter(null)}>
                «{tagFilter}» <X size={12} aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" className={styles.clearFilters} onClick={clearFilters}>
              Quitar filtros
            </button>
          </div>
        ) : null}

        {loading && reviews.length === 0 ? (
          <div className={styles.stateBox}>
            <span className={styles.stateSpinner} aria-hidden="true" />
            Cargando reseñas…
          </div>
        ) : reviews.length === 0 ? (
          <div className={styles.stateBox}>
            <span className={styles.stateIcon} aria-hidden="true">
              <MessageSquareText size={20} />
            </span>
            <p className={styles.stateTitle}>Sin reseñas todavía</p>
            <p>
              Cuando un cliente publique su opinión tras la visita, aparecerá aquí con su puntuación y podrás
              responderle.
            </p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className={styles.stateBox}>
            <span className={styles.stateIcon} aria-hidden="true">
              <Search size={20} />
            </span>
            <p className={styles.stateTitle}>
              {replyFilter === 'pending' && !query.trim() ? '¡Todas respondidas!' : 'Ninguna reseña con estos filtros'}
            </p>
            <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
              Quitar filtros
            </button>
          </div>
        ) : (
          <>
            <div className={styles.reviewList}>
              {visibleReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  companyId={companyId}
                  companyName={company.name}
                  companyLogoUrl={company.logoUrl ? optimizeCloudinaryUrl(company.logoUrl, CLOUDINARY_DISPLAY.photoPreview) : ''}
                  companySlug={company.slug}
                  customerReviewCount={analysis.customerCounts.get(review.customerUid) ?? 1}
                  onReplySaved={handleReplySaved}
                  onOpenMedia={openMedia}
                />
              ))}
            </div>
            <footer className={styles.listFooter}>
              <span>
                Mostrando {visibleReviews.length} de {filteredReviews.length}
                {sampleNote ? ` · ${sampleNote}` : ''}
              </span>
              {visibleReviews.length < filteredReviews.length ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setVisibleCount((current) => current + PAGE_STEP)}
                >
                  Mostrar más
                </button>
              ) : null}
            </footer>
          </>
        )}
      </section>

      {lightbox && currentMedia ? (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Foto o vídeo de la reseña"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
          >
            <X size={20} aria-hidden="true" />
          </button>
          {lightbox.items.length > 1 ? (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
              onClick={(event) => {
                event.stopPropagation()
                setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.items.length) % lightbox.items.length })
              }}
              aria-label="Anterior"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          ) : null}
          <div className={styles.lightboxMedia} onClick={(event) => event.stopPropagation()}>
            {currentMedia.type === 'image' ? (
              <img src={optimizeCloudinaryUrl(currentMedia.url, CLOUDINARY_DISPLAY.photoGallery)} alt="" />
            ) : (
              <video src={optimizeCloudinaryVideoUrl(currentMedia.url)} controls autoPlay playsInline />
            )}
          </div>
          {lightbox.items.length > 1 ? (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNext}`}
              onClick={(event) => {
                event.stopPropagation()
                setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.items.length })
              }}
              aria-label="Siguiente"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          ) : null}
          {lightbox.items.length > 1 ? (
            <span className={styles.lightboxCounter}>
              {lightbox.index + 1} / {lightbox.items.length}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default CompanyReviews
