import { useEffect, useState } from 'react'
import Calendar from '../components/Calendar'
import ReservationList from '../components/ReservationList'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/auth'
import {
  getFirestoreErrorMessage,
  getReservationCountsByMonth,
  getReservationsForDate,
  getTableNamesByCompany,
} from '../services/firestore'
import type { Reservation } from '../types'
import { formatDateSpanish } from '../utils/helpers'
import styles from './CompanyDashboard.module.css'

function CompanyDashboard() {
  const { company } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tableNames, setTableNames] = useState<Record<string, string>>({})
  const [reservationCounts, setReservationCounts] = useState<Record<number, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!company) {
      return
    }

    let cancelled = false

    const loadData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [dayReservations, tables, counts] = await Promise.all([
          getReservationsForDate(company.id, selectedDate),
          getTableNamesByCompany(company.id),
          getReservationCountsByMonth(
            company.id,
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
          ),
        ])

        if (cancelled) {
          return
        }

        setReservations(dayReservations)
        setTableNames(tables)
        setReservationCounts(counts)
      } catch (err) {
        if (!cancelled) {
          setError(getFirestoreErrorMessage(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [company, selectedDate])

  const handleLogout = async () => {
    await logout()
  }

  if (!company) {
    return (
      <div className={styles.pageLoading}>
        <p>Cargando datos de la empresa…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <img src="/adelia-logo.png" alt="Adelia" className={styles.logo} />
          <div>
            <h1>{company.name}</h1>
            <p>{company.location}</p>
          </div>
        </div>
        <button type="button" className={styles.logoutButton} onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.todayBanner}>
          <span className={styles.todayLabel}>Hoy</span>
          <p className={styles.todayDate}>{formatDateSpanish(new Date())}</p>
        </section>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.content}>
          {isLoading ? (
            <p className={styles.loading}>Cargando reservas…</p>
          ) : (
            <>
              <ReservationList
                reservations={reservations}
                tableNames={tableNames}
                selectedDate={selectedDate}
              />
              <Calendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                reservationCounts={reservationCounts}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default CompanyDashboard
