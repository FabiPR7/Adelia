import AdelinaCoin from './AdelinaCoin'
import styles from './AdelinaRating.module.css'

interface AdelinaRatingProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  interactive?: boolean
  onChange?: (value: number) => void
  className?: string
}

function AdelinaRating({
  value,
  max = 5,
  size = 'md',
  showValue = false,
  interactive = false,
  onChange,
  className = '',
}: AdelinaRatingProps) {
  const clamped = Math.max(0, Math.min(max, value))

  return (
    <div
      className={`${styles.row} ${className}`.trim()}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Valoración de ${clamped} Adelinas de reseña sobre ${max}`}
    >
      {Array.from({ length: max }, (_, index) => {
        const coinValue = index + 1
        const isActive = coinValue <= Math.round(clamped)

        if (interactive && onChange) {
          return (
            <button
              key={coinValue}
              type="button"
              className={`${styles.coinButton} ${styles.coinButtonInteractive}`}
              onClick={() => onChange(coinValue)}
              aria-label={`${coinValue} Adelinas de reseña`}
            >
              <AdelinaCoin
                size={size}
                variant="review"
                className={isActive ? styles.active : styles.inactive}
                alt=""
              />
            </button>
          )
        }

        return (
          <AdelinaCoin
            key={coinValue}
            size={size}
            variant="review"
            className={isActive ? styles.active : styles.inactive}
            alt=""
          />
        )
      })}

      {showValue && (
        <span className={styles.label}>{clamped.toFixed(1)}</span>
      )}
    </div>
  )
}

export default AdelinaRating
