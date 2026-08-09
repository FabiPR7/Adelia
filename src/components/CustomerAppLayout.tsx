import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CustomerGamificationProvider } from '../context/CustomerGamificationContext'
import CustomerBottomNav from './CustomerBottomNav'
import styles from './CustomerAppLayout.module.css'

function CustomerAppLayout() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return <div className={styles.loading}>Cargando…</div>
  }

  return (
    <CustomerGamificationProvider>
      <div className={styles.layout}>
        <div className={styles.content}>
          <Outlet />
        </div>
        <CustomerBottomNav />
      </div>
    </CustomerGamificationProvider>
  )
}

export default CustomerAppLayout
