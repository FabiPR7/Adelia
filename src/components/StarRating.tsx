import styles from './StarRating.module.css'

interface StarRatingProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
}

function StarRating({ value, max = 5, size = 'md' }: StarRatingProps) {
  return (
    <span className={styles.row} aria-hidden="true">
      {Array.from({ length: max }, (_, index) => {
        const fill = Math.min(1, Math.max(0, value - index))

        return (
          <span key={index} className={`${styles.star} ${styles[size]}`}>
            <span className={styles.starEmpty}>★</span>
            <span className={styles.starFill} style={{ width: `${fill * 100}%` }}>
              ★
            </span>
          </span>
        )
      })}
    </span>
  )
}

interface StarRatingInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function StarRatingInput({ value, onChange, disabled = false }: StarRatingInputProps) {
  return (
    <div className={styles.inputWrap}>
      <div className={styles.inputStars} role="radiogroup" aria-label="Puntuación de la reseña">
        {Array.from({ length: 5 }, (_, index) => {
          const whole = index + 1
          const half = index + 0.5
          const fill = Math.min(1, Math.max(0, value - index))

          return (
            <span key={whole} className={styles.starPair}>
              <button
                type="button"
                className={styles.halfButton + ' ' + styles.halfLeft}
                disabled={disabled}
                aria-label={`${half.toLocaleString('es-ES')} estrellas`}
                onClick={() => onChange(half)}
              />
              <button
                type="button"
                className={styles.halfButton + ' ' + styles.halfRight}
                disabled={disabled}
                aria-label={`${whole.toLocaleString('es-ES')} estrellas`}
                onClick={() => onChange(whole)}
              />
              <span className={`${styles.star} ${styles.lg}`} aria-hidden="true">
                <span className={styles.starEmpty}>★</span>
                <span className={styles.starFill} style={{ width: `${fill * 100}%` }}>
                  ★
                </span>
              </span>
            </span>
          )
        })}
      </div>
      <p className={styles.inputValue}>
        <strong>{value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
        <span>/ 5</span>
      </p>
    </div>
  )
}

export default StarRating

export { StarRating }
