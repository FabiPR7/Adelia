import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import CustomerReservationCard from '../../components/CustomerReservationCard'
import { useAuth } from '../../context/AuthContext'
import { getAllCompanies, getCustomerReservations } from '../../services/firestore'
import { hasRestaurantProfile } from '../../utils/publicBooking'
import { splitCustomerReservations } from '../../utils/customerReservations'
import {
  mapCompanyToDiscoveryRestaurant,
  mapCompanyToPublicBooking,
  type PublicDiscoveryRestaurant,
} from '../../utils/publicDiscovery'
import styles from './CustomerReservationsTab.module.css'

type ReservationTab = 'upcoming' | 'past'

function CustomerReservationsTab() {
  const { profile } = useAuth()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [reservations, setReservations] = useState<Awaited<ReturnType<typeof getCustomerReservations>>>([])
  const [tab, setTab] = useState<ReservationTab>('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) {
      return
    }

    let cancelled = false

    void Promise.all([
      getAllCompanies().then((companies) =>
        companies
          .filter((company) => hasRestaurantProfile(mapCompanyToPublicBooking(company)))
          .map(mapCompanyToDiscoveryRestaurant),
      ),
      getCustomerReservations(profile.email),
    ])
      .then(([restaurantData, reservationData]) => {
        if (!cancelled) {
          setRestaurants(restaurantData)
          setReservations(reservationData)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile])

  const restaurantById = useMemo(
    () => Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants],
  )

  const { upcoming, past } = useMemo(
    () => splitCustomerReservations(reservations),
    [reservations],
  )

  const visible = tab === 'upcoming' ? upcoming : past
  const nextReservation = upcoming[0]

  if (!profile || loading) {
    return <div className={styles.loading}>Cargando reservas…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.eyebrow}>Tus planes</p>
        <h1>Mis reservas</h1>
        <p className={styles.lead}>Todo lo que tienes por vivir y lo que ya disfrutaste.</p>

        <div className={styles.heroStats}>
          <div>
            <strong>{upcoming.length}</strong>
            <span>Por ir</span>
          </div>
          <div>
            <strong>{past.length}</strong>
            <span>Hechas</span>
          </div>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Tipo de reservas">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upcoming'}
          className={tab === 'upcoming' ? styles.tabActive : styles.tab}
          onClick={() => setTab('upcoming')}
        >
          Por ir
          <span>{upcoming.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'past'}
          className={tab === 'past' ? styles.tabActive : styles.tab}
          onClick={() => setTab('past')}
        >
          Hechas
          <span>{past.length}</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">
            {tab === 'upcoming' ? '🍽️' : '📅'}
          </div>
          <h2>
            {tab === 'upcoming'
              ? 'Ninguna reserva pendiente'
              : 'Tu historial está vacío'}
          </h2>
          <p>
            {tab === 'upcoming'
              ? 'Explora restaurantes y reserva tu próxima experiencia.'
              : 'Cuando completes visitas, aparecerán aquí.'}
          </p>
          <Link to="/app/explorar" className={styles.emptyCta}>
            Buscar restaurante
          </Link>
        </div>
      ) : (
        <div className={styles.list}>
          {visible.map((reservation) => (
            <CustomerReservationCard
              key={reservation.id}
              reservation={reservation}
              restaurant={restaurantById[reservation.companyId]}
              bucket={tab}
              isNext={tab === 'upcoming' && reservation.id === nextReservation?.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomerReservationsTab
