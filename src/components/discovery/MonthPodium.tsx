import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import styles from './MonthPodium.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface PodiumRestaurant {
  companyId: string
  name: string
  slug: string
  municipality: string
  photoUrl: string
  level: number
  rank: number
  podiums: string[]
}

interface LeagueResponse {
  month: string
  scope: 'city' | 'spain'
  best?: PodiumRestaurant[]
}

const PLACE_LABEL = ['', 'Mejor restaurante del mes', 'Segundo del mes', 'Tercero del mes']

function monthName(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString('es-ES', { month: 'long' })
}

/**
 * Podio del mes de la Liga Adelia: el 1.º en el centro y más grande, el 2.º a
 * la izquierda y el 3.º a la derecha. Suma los puestos en las cuatro ligas.
 */
function MonthPodium({ city }: { city: string }) {
  const [data, setData] = useState<LeagueResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    const query = city ? `?city=${encodeURIComponent(city.trim().toLowerCase())}` : ''
    fetch(`${API_BASE}/api/public/discovery/league${query}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json: LeagueResponse | null) => {
        if (!cancelled) setData(json)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [city])

  const best = data?.best ?? []
  if (!data || best.length === 0) return null

  const first = best.find((item) => item.rank === 1) ?? null
  const second = best.find((item) => item.rank === 2) ?? null
  const third = best.find((item) => item.rank === 3) ?? null
  const where = data.scope === 'city' && city ? city : 'España'

  const card = (item: PodiumRestaurant | null, place: 1 | 2 | 3) => {
    if (!item) {
      return (
        <div className={`${styles.spot} ${styles[`spot_${place}`]} ${styles.spotEmpty}`} aria-hidden="true">
          <span className={styles.badge}>{place}</span>
          <span className={styles.emptyText}>Puesto libre</span>
        </div>
      )
    }
    const photo = item.photoUrl ? optimizeCloudinaryUrl(item.photoUrl, CLOUDINARY_DISPLAY.photoPreview) : ''
    return (
      <Link
        to={`/reservar/${item.slug}`}
        className={`${styles.spot} ${styles[`spot_${place}`]}`}
        aria-label={`${place}.º del mes: ${item.name}`}
      >
        {photo ? (
          <img className={styles.photo} src={photo} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.fallback} aria-hidden="true">{item.name.charAt(0).toUpperCase()}</span>
        )}
        <span className={styles.shade} aria-hidden="true" />
        <span className={styles.badge}>
          {place === 1 ? <Crown size={18} aria-hidden="true" /> : null}
          {place}
        </span>
        <span className={styles.info}>
          <span className={styles.label}>{PLACE_LABEL[place]}</span>
          <strong className={styles.name}>{item.name}</strong>
          <span className={styles.meta}>
            {[item.municipality, item.podiums[0]].filter(Boolean).join(' · ')}
          </span>
        </span>
      </Link>
    )
  }

  return (
    <section className={styles.section} aria-labelledby="month-podium-title">
      <div className={styles.heading}>
        <span className={styles.kicker}>Liga Adelia · {monthName(data.month)}</span>
        <h2 id="month-podium-title">Los mejores del mes en {where}</h2>
        <p>Los restaurantes que más reservas, premios y buenas reseñas suman este mes.</p>
      </div>
      <div className={styles.podium}>
        {card(second, 2)}
        {card(first, 1)}
        {card(third, 3)}
      </div>
    </section>
  )
}

export default MonthPodium
