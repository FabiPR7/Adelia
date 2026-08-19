import { Link } from 'react-router-dom'
import type {
  ReviewTaggedProduct,
  ReviewTaggedPromotion,
} from '../types/review'
import { buildReviewProductHref, buildReviewPromotionHref } from '../utils/reviewLinks'
import styles from './ReviewTaggedLinks.module.css'

interface ReviewTaggedLinksProps {
  slug: string
  taggedProducts?: ReviewTaggedProduct[]
  taggedPromotions?: ReviewTaggedPromotion[]
  editable?: boolean
  onRemoveProduct?: (nodeId: string) => void
  onRemovePromotion?: (promotionId: string) => void
}

function ReviewTaggedLinks({
  slug,
  taggedProducts = [],
  taggedPromotions = [],
  editable = false,
  onRemoveProduct,
  onRemovePromotion,
}: ReviewTaggedLinksProps) {
  if (taggedProducts.length === 0 && taggedPromotions.length === 0) {
    return null
  }

  return (
    <div className={styles.wrapper}>
      {taggedProducts.map((tag) => (
        <span key={`product-${tag.nodeId}`} className={styles.tag}>
          {editable ? (
            <>
              <span className={styles.tagLabel}>{tag.name}</span>
              <button
                type="button"
                className={styles.removeTag}
                onClick={() => onRemoveProduct?.(tag.nodeId)}
                aria-label={`Quitar ${tag.name}`}
              >
                ×
              </button>
            </>
          ) : (
            <Link
              to={buildReviewProductHref(slug, tag)}
              className={styles.tagLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tag.name}
            </Link>
          )}
        </span>
      ))}

      {taggedPromotions.map((tag) => (
        <span key={`promo-${tag.promotionId}`} className={styles.tag}>
          {editable ? (
            <>
              <span className={styles.tagLabel}>{tag.name}</span>
              <button
                type="button"
                className={styles.removeTag}
                onClick={() => onRemovePromotion?.(tag.promotionId)}
                aria-label={`Quitar ${tag.name}`}
              >
                ×
              </button>
            </>
          ) : (
            <Link
              to={buildReviewPromotionHref(slug, tag)}
              className={styles.tagLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tag.name}
            </Link>
          )}
        </span>
      ))}
    </div>
  )
}

export default ReviewTaggedLinks
