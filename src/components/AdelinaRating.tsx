import AdelinaCoin from './AdelinaCoin'
import { ADELINA_RATING_SLOTS, getAdelinaSlotStates, MAX_REVIEW_RATING, MIN_REVIEW_RATING } from '../types/review'
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
  max = ADELINA_RATING_SLOTS,
  size = 'md',
  showValue = false,
  interactive = false,
  onChange,
  className = '',
}: AdelinaRatingProps) {
  const clamped = Math.max(0, Math.min(max, value))
  const slotStates = getAdelinaSlotStates(clamped, clamped > 0 ? 1 : 0)

  return (
    <div
      className={`${styles.row} ${className}`.trim()}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Valoración de ${Math.round(clamped)} Adelinas de reseña sobre ${max}`}
    >
      {slotStates.map((state, index) => {
        const coinValue = index + 1

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
                className={state === 'full' ? styles.active : styles.inactive}
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
            className={state === 'full' ? styles.active : styles.inactive}
            alt=""
          />
        )
      })}

      {showValue && (
        <span className={styles.label}>{Math.round(clamped)}</span>
      )}
    </div>
  )
}

interface AdelinaRatingInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function AdelinaRatingInput({ value, onChange, disabled = false }: AdelinaRatingInputProps) {
  const normalizedValue = Math.min(MAX_REVIEW_RATING, Math.max(MIN_REVIEW_RATING, Math.round(value)))
  const slotStates = getAdelinaSlotStates(normalizedValue, 1)

  return (
    <div className={styles.inputWrap}>
      <div className={styles.inputCoins} role="radiogroup" aria-label="Puntuación con Adelinas de reseña">
        {Array.from({ length: ADELINA_RATING_SLOTS }, (_, index) => {
          const coinValue = index + 1
          const state = slotStates[index]

          return (
            <button
              key={coinValue}
              type="button"
              className={`${styles.coinButton} ${styles.coinButtonInteractive}`}
              disabled={disabled}
              aria-label={`${coinValue} Adelinas de reseña`}
              aria-pressed={normalizedValue === coinValue}
              onClick={() => onChange(coinValue)}
            >
              <AdelinaCoin
                size="lg"
                variant="review"
                className={state === 'full' ? styles.active : styles.inactive}
                alt=""
              />
            </button>
          )
        })}
      </div>
      <p className={styles.inputValue}>
        <strong>{normalizedValue}</strong>
        <span> Adelinas</span>
      </p>
    </div>
  )
}

export default AdelinaRating

export { AdelinaRating }
