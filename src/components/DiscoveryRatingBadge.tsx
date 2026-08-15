import AdelinaCoin from './AdelinaCoin'
import styles from './DiscoveryRatingBadge.module.css'

interface DiscoveryRatingBadgeProps {
  rating: string
  className?: string
  size?: 'sm' | 'md'
}

function DiscoveryRatingBadge({ rating, className = '', size = 'sm' }: DiscoveryRatingBadgeProps) {
  return (
    <span
      className={className ? `${styles.badge} ${className}` : styles.badge}
      aria-label={`Puntuación ${rating}`}
    >
      <AdelinaCoin size={size} variant="review" alt="" />
      <span>{rating}</span>
    </span>
  )
}

export default DiscoveryRatingBadge
