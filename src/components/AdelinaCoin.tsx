import { adelinaCoinUrl } from '../constants/adelina'
import styles from './AdelinaCoin.module.css'

type AdelinaCoinSize = 'sm' | 'md' | 'lg' | 'xl'

interface AdelinaCoinProps {
  size?: AdelinaCoinSize
  variant?: 'coin' | 'review'
  className?: string
  alt?: string
}

function AdelinaCoin({
  size = 'md',
  variant = 'coin',
  className = '',
  alt = 'Adelina',
}: AdelinaCoinProps) {
  return (
    <img
      src={adelinaCoinUrl}
      alt={alt}
      className={`${styles.coin} ${styles[size]} ${variant === 'review' ? styles.review : ''} ${styles.inline} ${className}`.trim()}
      draggable={false}
    />
  )
}

export default AdelinaCoin
