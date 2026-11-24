import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requestUserLocation } from '../utils/requestUserLocation'
import { formatDistanceKm, haversineDistanceKm, type GeoCoordinates } from '../utils/geo'
import { fetchNowRestaurants, nowBookingHref, nowSlotLabel, type NowResult } from '../services/nowAvailability'
import styles from './EatNowPage.module.css'

const PAX_OPTIONS = [1, 2, 3, 4, 5, 6, 8]

type Where = { near: GeoCoordinates } | { city: string }

/**
 * «Comer ahora»: para cuando hay prisa. Enseña los locales cercanos con mesa libre
 * para ya mismo o en unos minutos (lo calcula el servidor) y abre la reserva con
 * todo puesto: hoy, la hora, las personas y una mesa libre.
 */
function EatNowPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pax, setPax] = useState(2)
  const [where, setWhere] = useState<Where | null>(null)
  const [locating, setLocating] = useState(true)
  const [cityInput, setCityInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<NowResult | null>(null)

  useEffect(() => {
    document.title = 'Comer ahora · Adelia'
  }, [])

  // Primero tu ubicación; si no se puede, tu ciudad del perfil; si no, la escribes tú.
  useEffect(() => {
    let cancelled = false
    setLocating(true)
    requestUserLocation('')
      .then((location) => {
        if (!cancelled) setWhere({ near: location.coords })
      })
      .catch(() => {
        if (cancelled) return
        const city = (profile as { homeCity?: string } | null)?.homeCity?.trim() ?? ''
        if (city) setWhere({ city })
      })
      .finally(() => {
        if (!cancelled) setLocating(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile])

  const search = useCallback(async (target: Where, people: number) => {
    setLoading(true)
    setError(null)
    try {
      setResult(await fetchNowRestaurants(target, people))
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'No se pudieron buscar mesas para ahora.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (where) void search(where, pax)
  }, [where, pax, search])

  const submitCity = (event: FormEvent) => {
    event.preventDefault()
    if (cityInput.trim().length >= 2) setWhere({ city: cityInput.trim() })
  }

  const origin = where && 'near' in where ? where.near : null
  const restaurants = result?.restaurants ?? []

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Volver">
          ←
        </button>
        <p className={styles.eyebrow}>Comer ahora</p>
        <h1 className={styles.title}>Mesa libre, ya</h1>
        <p className={styles.lead}>
          Sitios cerca de ti con mesa para ahora mismo o en los próximos {result?.windowMinutes ?? 30} minutos.
        </p>

        <div className={styles.paxRow} role="radiogroup" aria-label="¿Cuántos sois?">
          <span className={styles.paxLabel}>¿Cuántos sois?</span>
          {PAX_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={pax === option}
              className={`${styles.paxChip} ${pax === option ? styles.paxChipOn : ''}`}
              onClick={() => setPax(option)}
            >
              {option === 8 ? '8+' : option}
            </button>
          ))}
        </div>
      </header>

      <main className={styles.main}>
        {!where && !locating ? (
          <form className={styles.cityForm} onSubmit={submitCity}>
            <p>No hemos podido usar tu ubicación. ¿En qué ciudad estás?</p>
            <div className={styles.cityRow}>
              <input
                value={cityInput}
                onChange={(event) => setCityInput(event.target.value)}
                placeholder="Logroño, Madrid…"
                aria-label="Ciudad"
              />
              <button type="submit" className={styles.primary}>Buscar</button>
            </div>
          </form>
        ) : null}

        {locating || loading ? (
          <p className={styles.status} role="status">
            {locating ? 'Buscando dónde estás…' : 'Buscando mesas libres para ahora…'}
          </p>
        ) : null}

        {error ? (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            {where ? <button type="button" className={styles.secondary} onClick={() => void search(where, pax)}>Reintentar</button> : null}
          </div>
        ) : null}

        {!loading && !error && result && restaurants.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Ahora mismo no hay mesas libres cerca</p>
            <p>Prueba con menos personas, o reserva para más tarde.</p>
            <Link className={styles.primary} to="/">Ver todos los restaurantes</Link>
          </div>
        ) : null}

        {!loading && restaurants.length > 0 ? (
          <ul className={styles.list}>
            {restaurants.map((restaurant) => {
              const distance = origin && restaurant.latitude != null && restaurant.longitude != null
                ? formatDistanceKm(haversineDistanceKm(origin, { lat: restaurant.latitude, lng: restaurant.longitude }))
                : ''
              return (
                <li key={restaurant.id} className={styles.card}>
                  <div className={styles.photo}>
                    {restaurant.photoUrl ? <img src={restaurant.photoUrl} alt="" loading="lazy" /> : <span>{restaurant.name.charAt(0)}</span>}
                  </div>
                  <div className={styles.body}>
                    <h2>{restaurant.name}</h2>
                    <p className={styles.meta}>{[restaurant.municipality, distance].filter(Boolean).join(' · ')}</p>
                    <p className={styles.slot}>{nowSlotLabel(restaurant.now)}</p>
                    <Link className={styles.primary} to={nowBookingHref(restaurant, pax)}>
                      Reservar a las {restaurant.now.time}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {result && result.graceMinutes > 0 ? (
          <p className={styles.note}>
            Si la hora ya ha empezado, aún puedes reservar durante {result.graceMinutes} minutos: el local te espera.
          </p>
        ) : null}
      </main>
    </div>
  )
}

export default EatNowPage
