import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CustomerBottomNav from './CustomerBottomNav'
import CustomerNotificationsBell from './CustomerNotificationsBell'
import CancellationPenaltyModal from './CancellationPenaltyModal'
import styles from './CustomerAppLayout.module.css'

function CustomerAppLayout() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return <div className={styles.loading}>Cargando…</div>
  }

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <CustomerNotificationsBell />
      </div>
      <div className={styles.content}>
        <Outlet />
      </div>
      <CustomerBottomNav />
      <CancellationPenaltyModal />
    </div>
  )
}

export default CustomerAppLayout
