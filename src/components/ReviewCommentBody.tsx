import { Link } from 'react-router-dom'
import type { ReviewTaggedProduct, ReviewTaggedPromotion } from '../types/review'
import { buildReviewProductHref, buildReviewPromotionHref } from '../utils/reviewLinks'
import { parseReviewCommentSegments } from '../utils/reviewCommentTags'
import styles from './ReviewCommentBody.module.css'

interface ReviewCommentBodyProps {
  comment: string
  slug: string
  taggedProducts?: ReviewTaggedProduct[]
  taggedPromotions?: ReviewTaggedPromotion[]
  className?: string
}

function ReviewCommentBody({
  comment,
  slug,
  taggedProducts = [],
  taggedPromotions = [],
  className,
}: ReviewCommentBodyProps) {
  const segments = parseReviewCommentSegments(comment, taggedProducts, taggedPromotions)

  return (
    <p className={className ? `${styles.body} ${className}` : styles.body}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`}>{segment.value}</span>
        }

        if (segment.type === 'product') {
          return slug ? (
            <Link
              key={`product-${index}-${segment.tag.nodeId}`}
              to={buildReviewProductHref(slug, segment.tag)}
              className={styles.inlineTag}
              target="_blank"
              rel="noopener noreferrer"
            >
              {segment.value}
            </Link>
          ) : (
            <span key={`product-${index}-${segment.tag.nodeId}`} className={styles.inlineTagStatic}>
              {segment.value}
            </span>
          )
        }

        return slug ? (
          <Link
            key={`promo-${index}-${segment.tag.promotionId}`}
            to={buildReviewPromotionHref(slug, segment.tag)}
            className={styles.inlineTag}
            target="_blank"
            rel="noopener noreferrer"
          >
            {segment.value}
          </Link>
        ) : (
          <span key={`promo-${index}-${segment.tag.promotionId}`} className={styles.inlineTagStatic}>
            {segment.value}
          </span>
        )
      })}
    </p>
  )
}

export default ReviewCommentBody
