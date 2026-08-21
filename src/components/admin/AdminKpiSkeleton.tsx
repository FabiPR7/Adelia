import styles from './AdminKpiSkeleton.module.css'

function AdminKpiSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.header}>
        <div className={styles.iconPlaceholder} />
        <div className={styles.titlePlaceholder} />
      </div>
      <div className={styles.valuePlaceholder} />
      <div className={styles.trendPlaceholder} />
    </div>
  )
}

export default AdminKpiSkeleton
