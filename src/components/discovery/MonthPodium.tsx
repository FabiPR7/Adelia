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
  /** false la primera semana del mes: se enseña el resultado final del mes anterior. */
  inPlay?: boolean
  scope: 'city' | 'spain'
  best?: PodiumRestaurant[]
}


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
  const inPlay = data.inPlay !== false
  const name = monthName(data.month)
  const placeLabel = (place: 1 | 2 | 3) => {
    if (place === 1) return inPlay ? 'Mejor restaurante del mes' : `Mejor restaurante de ${name}`
    return inPlay ? (place === 2 ? 'Segundo del mes' : 'Tercero del mes') : (place === 2 ? `Segundo de ${name}` : `Tercero de ${name}`)
  }

  const card = (item: PodiumRestaurant | null, place: 1 | 2 | 3) => {
    if (!item) {
      return (
        <div className={`${styles.spot} ${styles[`spot_${place}`]} ${styles.spotEmpty}`} aria-hidden="true">
          <span className={styles.badge}>{place}</span>
          <span className={styles.emptyText}><strong>Puesto libre</strong><br />{inPlay ? 'Aún nadie más compite aquí este mes' : 'Nadie más compitió ese mes'}</span>
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
          <span className={styles.label}>{placeLabel(place)}</span>
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
        <span className={styles.kicker}>Liga Adelia · {inPlay ? 'En juego' : 'Resultado final'}</span>
        <h2 id="month-podium-title">Los mejores de {name} en {where}</h2>
        <p>
          {inPlay
            ? 'Así va el mes: los que más reservas, premios y buenas reseñas suman. Se decide el día 1.'
            : 'Los ganadores del mes pasado. El nuevo mes ya está en juego y lo verás aquí a partir del día 8.'}
        </p>
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
