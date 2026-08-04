import styles from './DiscoverySkeleton.module.css'

function DiscoverySkeleton() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.searchSkeleton} />
      <div className={styles.carouselSkeleton}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.cardSkeleton} />
        ))}
      </div>
    </div>
  )
}

export default DiscoverySkeleton
