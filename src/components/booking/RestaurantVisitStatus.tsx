import { useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  loadRestaurantCollection,
  useRestaurantCollection,
  visitsForSlug,
} from '../../services/restaurantCollection'
import styles from './RestaurantVisitStatus.module.css'

/** En la ficha: «Aún no has estado aquí» o «Ya has estado · N visitas». */
function RestaurantVisitStatus({ slug }: { slug: string }) {
  const { user, profile } = useAuth()
  const isCustomer = Boolean(user && profile?.role === 'customer')
  const collection = useRestaurantCollection()

  useEffect(() => {
    if (isCustomer) void loadRestaurantCollection()
  }, [isCustomer])

  if (!isCustomer || !collection) return null
  const visits = visitsForSlug(collection, slug)

  return (
    <div className={styles.wrap}>
      {visits > 0 ? (
        <p className={`${styles.status} ${styles.visited}`}>
          ✓ Ya has estado aquí · {visits === 1 ? '1 visita' : `${visits} visitas`}
        </p>
      ) : (
        <p className={`${styles.status} ${styles.fresh}`}>
          Aún no has estado aquí · suma uno a tu mapa gastronómico
        </p>
      )}
    </div>
  )
}

export default RestaurantVisitStatus
