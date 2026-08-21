import styles from './AdminChartSkeleton.module.css'

function AdminChartSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.titlePlaceholder} />
      <div className={styles.chartArea}>
        <div className={styles.bar} style={{ height: '60%' }} />
        <div className={styles.bar} style={{ height: '80%' }} />
        <div className={styles.bar} style={{ height: '45%' }} />
        <div className={styles.bar} style={{ height: '90%' }} />
        <div className={styles.bar} style={{ height: '70%' }} />
        <div className={styles.bar} style={{ height: '55%' }} />
      </div>
    </div>
  )
}

export default AdminChartSkeleton
