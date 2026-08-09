import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import {
  getPromotionCollageCountLabel,
  getPromotionProductPhotos,
  PROMOTION_COLLAGE_MAX_VISIBLE,
} from '../../utils/promotionOffer'
import type { PromotionProductRef } from '../../types/company'
import styles from './PromotionPhotoCollage.module.css'

interface PromotionPhotoCollageProps {
  productRefs: PromotionProductRef[]
  fallbackPhotoUrl?: string
  size?: 'thumb' | 'card' | 'preview'
  alt?: string
  className?: string
}

function CollageImage({
  photoUrl,
  alt,
  className,
}: {
  photoUrl: string
  alt: string
  className?: string
}) {
  return (
    <img
      src={optimizeCloudinaryUrl(photoUrl, CLOUDINARY_DISPLAY.photoThumb)}
      alt={alt}
      className={className}
    />
  )
}

export default function PromotionPhotoCollage({
  productRefs,
  fallbackPhotoUrl = '',
  size = 'thumb',
  alt = '',
  className = '',
}: PromotionPhotoCollageProps) {
  const photos = getPromotionProductPhotos(productRefs)
  const visiblePhotos = photos.slice(0, PROMOTION_COLLAGE_MAX_VISIBLE)
  const countLabel = getPromotionCollageCountLabel(productRefs.length)
  const rootClass = `${styles.collage} ${
    size === 'card'
      ? styles.collageCard
      : size === 'preview'
        ? styles.collagePreview
        : styles.collageThumb
  } ${className}`.trim()

  if (visiblePhotos.length === 0) {
    if (fallbackPhotoUrl.trim()) {
      return (
        <div className={rootClass}>
          <CollageImage photoUrl={fallbackPhotoUrl} alt={alt} className={styles.singleImage} />
        </div>
      )
    }

    return (
      <div className={`${rootClass} ${styles.collageEmpty}`}>
        <span>Sin foto</span>
      </div>
    )
  }

  if (visiblePhotos.length === 1) {
    return (
      <div className={rootClass}>
        <CollageImage
          photoUrl={visiblePhotos[0].photoUrl}
          alt={visiblePhotos[0].name || alt}
          className={styles.singleImage}
        />
      </div>
    )
  }

  const layoutClass = visiblePhotos.length === 2
    ? styles.layoutTwo
    : visiblePhotos.length === 3
      ? styles.layoutThree
      : styles.layoutFour

  return (
    <div className={`${rootClass} ${layoutClass}`}>
      {visiblePhotos.map((ref) => (
        <CollageImage
          key={ref.nodeId}
          photoUrl={ref.photoUrl}
          alt={ref.name || alt}
          className={styles.tileImage}
        />
      ))}
      {countLabel ? (
        <span className={styles.countBadge}>{countLabel}</span>
      ) : null}
    </div>
  )
}
