import { useEffect, useRef, useState } from 'react'
import type { MenuNode } from '../types/company'
import type { Reservation } from '../types'
import type {
  CompanyReview,
  ReviewMediaItem,
  ReviewTaggedProduct,
  ReviewTaggedPromotion,
} from '../types/review'
import { MAX_REVIEW_RATING, MIN_REVIEW_RATING } from '../types/review'
import type { PublicPromotion } from '../services/publicPromotions'
import ReviewCommentBody from './ReviewCommentBody'
import ReviewCommentEditor, {
  captureReviewEditorCaret,
  insertProductTagInEditor,
  insertPromotionTagInEditor,
} from './ReviewCommentEditor'
import ReviewMediaUploader from './ReviewMediaUploader'
import ReviewTagSearchPanel from './ReviewTagSearchPanel'
import AdelinaRating, { AdelinaRatingInput } from './AdelinaRating'
import { extractTagsFromComment, getReviewCommentPlainLength } from '../utils/reviewCommentTags'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './CustomerReviewModal.module.css'

type ReviewModalMode = 'manage' | 'create' | 'edit'
type TagPickerMode = 'product' | 'promotion' | null

export interface CustomerReviewSubmitInput {
  reservationId: string
  companyId: string
  rating: number
  comment: string
  mediaItems: ReviewMediaItem[]
  taggedProducts: ReviewTaggedProduct[]
  taggedPromotions: ReviewTaggedPromotion[]
}

interface CustomerReviewModalProps {
  reservation: Reservation | null
  restaurantName: string
  restaurantSlug: string
  existingReview: CompanyReview | null
  menuProducts: MenuNode[]
  promotions: PublicPromotion[]
  catalogLoading?: boolean
  onClose: () => void
  onSubmit: (input: CustomerReviewSubmitInput) => Promise<void>
  onUpdate: (input: CustomerReviewSubmitInput) => Promise<void>
  onDelete: (companyId: string) => Promise<void>
}

function cloneReviewState(review: CompanyReview | null) {
  return {
    comment: review?.comment ?? '',
    rating: review?.rating ?? 5,
    mediaItems: review?.mediaItems ? [...review.mediaItems] : [],
  }
}

export default function CustomerReviewModal({
  reservation,
  restaurantName,
  restaurantSlug,
  existingReview,
  menuProducts,
  promotions,
  catalogLoading = false,
  onClose,
  onSubmit,
  onUpdate,
  onDelete,
}: CustomerReviewModalProps) {
  const [mode, setMode] = useState<ReviewModalMode>('create')
  const [comment, setComment] = useState('')
  const [rating, setRating] = useState(5)
  const [mediaItems, setMediaItems] = useState<ReviewMediaItem[]>([])
  const [tagPicker, setTagPicker] = useState<TagPickerMode>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const commentEditorRef = useRef<HTMLDivElement>(null)
  const savedCaretOffsetRef = useRef<number | null>(null)

  const captureCommentCaret = () => {
    savedCaretOffsetRef.current = captureReviewEditorCaret(commentEditorRef.current)
  }

  useEffect(() => {
    if (!reservation) {
      return
    }

    const nextState = cloneReviewState(existingReview)
    setMode(existingReview ? 'manage' : 'create')
    setComment(nextState.comment)
    setRating(nextState.rating)
    setMediaItems(nextState.mediaItems)
    setTagPicker(null)
    setError('')
  }, [reservation, existingReview])

  const buildPayload = (): CustomerReviewSubmitInput => {
    const { taggedProducts, taggedPromotions } = extractTagsFromComment(comment)

    return {
      reservationId: reservation!.id,
      companyId: reservation!.companyId,
      rating,
      comment: comment.trim(),
      mediaItems,
      taggedProducts,
      taggedPromotions,
    }
  }

  const resetToExistingReview = () => {
    const nextState = cloneReviewState(existingReview)
    setMode('manage')
    setComment(nextState.comment)
    setRating(nextState.rating)
    setMediaItems(nextState.mediaItems)
    setTagPicker(null)
    setError('')
  }

  if (!reservation) {
    return null
  }

  const handleSubmit = async () => {
    const plainLength = getReviewCommentPlainLength(comment)
    if (plainLength < 10) {
      setError('Escribe al menos 10 caracteres en tu reseña.')
      return
    }

    if (rating < MIN_REVIEW_RATING || rating > MAX_REVIEW_RATING) {
      setError('Selecciona una puntuación entre 1 y 5 Adelinas.')
      return
    }

    setSubmitting(true)
    setError('')

    const payload = buildPayload()

    try {
      if (mode === 'edit') {
        await onUpdate(payload)
      } else {
        await onSubmit(payload)
      }

      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar la reseña.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    setError('')

    try {
      await onDelete(reservation.companyId)
      onClose()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la reseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        {mode === 'manage' && existingReview ? (
          <>
            <h2 id="review-title" className={styles.title}>Tu reseña en {restaurantName}</h2>
            <p className={styles.message}>
              Solo puedes tener una reseña por restaurante. Esta es la tuya:
            </p>

            <div className={styles.existingReview}>
              <div className={styles.existingRating}>
                <AdelinaRating value={existingReview.rating} size="sm" showValue />
                <span className={styles.existingRatingLabel}>Adelinas de reseña</span>
              </div>

              <ReviewCommentBody
                comment={existingReview.comment}
                slug={restaurantSlug}
                taggedProducts={existingReview.taggedProducts}
                taggedPromotions={existingReview.taggedPromotions}
                className={styles.existingComment}
              />

              {existingReview.mediaItems.length > 0 ? (
                <ul className={styles.existingMediaGrid}>
                  {existingReview.mediaItems.map((item, index) => (
                    <li key={`${item.url}-${index}`}>
                      {item.type === 'image' ? (
                        <img
                          src={optimizeCloudinaryUrl(item.url, CLOUDINARY_DISPLAY.photoPreview)}
                          alt=""
                          className={styles.existingMediaPreview}
                        />
                      ) : (
                        <video src={item.url} className={styles.existingMediaPreview} controls muted />
                      )}
                    </li>
                  ))}
                </ul>
              ) : existingReview.hasPhoto ? (
                <span className={styles.existingTag}>Incluye foto</span>
              ) : null}
            </div>

            <p className={styles.managePrompt}>¿Quieres editarla o eliminarla?</p>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => void handleDelete()}
                disabled={submitting}
              >
                {submitting ? 'Eliminando…' : 'Eliminar'}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setMode('edit')}
                disabled={submitting}
              >
                Editar
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="review-title" className={styles.title}>
              {mode === 'edit' ? 'Editar reseña' : 'Tu reseña'}
            </h2>
            <p className={styles.message}>
              Cuéntanos tu experiencia en <strong>{restaurantName}</strong>.
            </p>

            <div className={styles.field}>
              Adelinas de reseña
              <AdelinaRatingInput value={rating} onChange={setRating} disabled={submitting} />
            </div>

            <div className={styles.commentBlock}>
              <div className={styles.commentHeader}>
                <span>Comentario</span>
                <div className={styles.tagActions}>
                  <button
                    type="button"
                    className={styles.tagActionButton}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      captureCommentCaret()
                    }}
                    onClick={() => setTagPicker((current) => (current === 'product' ? null : 'product'))}
                    disabled={submitting || catalogLoading}
                  >
                    Etiquetar producto
                  </button>
                  <button
                    type="button"
                    className={styles.tagActionButton}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      captureCommentCaret()
                    }}
                    onClick={() => setTagPicker((current) => (current === 'promotion' ? null : 'promotion'))}
                    disabled={submitting || catalogLoading}
                  >
                    Etiquetar promo
                  </button>
                </div>
              </div>

              {catalogLoading ? (
                <p className={styles.catalogHint}>Cargando carta y promos…</p>
              ) : null}

              {tagPicker ? (
                <ReviewTagSearchPanel
                  mode={tagPicker}
                  menuProducts={menuProducts}
                  promotions={promotions}
                  onSelectProduct={(tag) => {
                    savedCaretOffsetRef.current = insertProductTagInEditor(
                      commentEditorRef.current,
                      tag,
                      setComment,
                      savedCaretOffsetRef.current,
                    )
                    setTagPicker(null)
                    setError('')
                  }}
                  onSelectPromotion={(tag) => {
                    savedCaretOffsetRef.current = insertPromotionTagInEditor(
                      commentEditorRef.current,
                      tag,
                      setComment,
                      savedCaretOffsetRef.current,
                    )
                    setTagPicker(null)
                    setError('')
                  }}
                  onClose={() => setTagPicker(null)}
                />
              ) : null}

              <ReviewCommentEditor
                editorRef={commentEditorRef}
                value={comment}
                onChange={(nextComment) => {
                  setComment(nextComment)
                  setError('')
                }}
                onCaretCapture={(offset) => {
                  savedCaretOffsetRef.current = offset
                }}
                disabled={submitting}
              />
            </div>

            <ReviewMediaUploader
              value={mediaItems}
              onChange={setMediaItems}
              disabled={submitting}
            />

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  if (mode === 'edit' && existingReview) {
                    resetToExistingReview()
                    return
                  }

                  onClose()
                }}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting
                  ? 'Guardando…'
                  : mode === 'edit'
                    ? 'Guardar cambios'
                    : 'Publicar reseña'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
