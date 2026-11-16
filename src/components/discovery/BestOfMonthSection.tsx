import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import styles from './BestOfMonthSection.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface LeagueRestaurant {
  companyId: string
  name: string
  slug: string
  municipality: string
  photoUrl: string
  level: number
  levelTitle: string
  prestige: { id: 'bronze' | 'silver' | 'gold' | 'diamond'; label: string }
  rank: number
  display: string
}

interface LeagueResponse {
  month: string
  scope: 'city' | 'spain'
  boards: Array<{ id: 'reservations' | 'promotions' | 'rating' | 'rising'; name: string; unit: string; podium: LeagueRestaurant[] }>
  illustrious: LeagueRestaurant[]
}

const TAB_LABEL: Record<string, string> = {
  reservations: 'Más reservados',
  rating: 'Mejor valorados',
  promotions: 'Más premios',
}

function monthName(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString('es-ES', { month: 'long' })
}

function photo(url: string): string {
  return url ? optimizeCloudinaryUrl(url, CLOUDINARY_DISPLAY.photoThumb) : ''
}

/** «Lo mejor del mes»: podio de la Liga Adelia, la revelación y las casas ilustres. */
function BestOfMonthSection({ city }: { city: string }) {
  const [data, setData] = useState<LeagueResponse | null>(null)
  const [tab, setTab] = useState<'reservations' | 'rating' | 'promotions'>('reservations')

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

  if (!data) return null
  const tabs = data.boards.filter((board) => board.id !== 'rising' && board.podium.length > 0)
  const active = tabs.find((board) => board.id === tab) ?? tabs[0]
  const rising = data.boards.find((board) => board.id === 'rising')?.podium[0] ?? null
  if (!active && !rising && data.illustrious.length === 0) return null

  // Podio en orden 2-1-3 para que el ganador quede en el centro.
  const podium = active ? [active.podium[1], active.podium[0], active.podium[2]].filter(Boolean) : []
  const where = data.scope === 'city' && city ? `en ${city}` : 'en España'

  return (
    <section className={styles.section} aria-labelledby="best-of-month-title">
      <div className={styles.head}>
        <span className={styles.kicker}>Liga Adelia</span>
        <h2 id="best-of-month-title" className={styles.title}>Lo mejor de {monthName(data.month)}</h2>
        <span className={styles.subtitle}>Los restaurantes que más lo están petando {where}</span>
      </div>

      {active ? (
        <>
          <div className={styles.tabs} role="tablist" aria-label="Categorías">
            {tabs.map((board) => (
              <button
                key={board.id}
                type="button"
                role="tab"
                aria-selected={board.id === active.id}
                className={board.id === active.id ? styles.tabOn : styles.tabOff}
                onClick={() => setTab(board.id as typeof tab)}
              >
                {TAB_LABEL[board.id] ?? board.name}
              </button>
            ))}
          </div>
          <div className={styles.podium}>
            {podium.map((restaurant) => (
              <Link
                key={restaurant.companyId}
                to={`/reservar/${restaurant.slug}`}
                className={`${styles.step} ${styles[`step${restaurant.rank}`]}`}
              >
                <span className={styles.photo} style={photo(restaurant.photoUrl) ? { backgroundImage: `url(${photo(restaurant.photoUrl)})` } : undefined} />
                <span className={`${styles.medal} ${styles[`medal${restaurant.rank}`]}`}>{restaurant.rank}</span>
                <span className={styles.name}>{restaurant.name}</span>
                <span className={styles.meta}>{restaurant.display} {active.id === 'rating' ? '' : active.unit === 'asistencias' ? 'reservas' : active.unit}</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {rising ? (
        <Link to={`/reservar/${rising.slug}`} className={styles.rising}>
          <span className={styles.risingPhoto} style={photo(rising.photoUrl) ? { backgroundImage: `url(${photo(rising.photoUrl)})` } : undefined} />
          <span className={styles.risingText}>
            <span className={styles.risingBadge}>Revelación del mes</span>
            <span className={styles.risingName}>{rising.name}</span>
            <span className={styles.risingMeta}>{rising.display} · {rising.municipality}</span>
          </span>
        </Link>
      ) : null}

      {data.illustrious.length > 0 ? (
        <div className={styles.illustrious}>
          <div className={styles.illustriousHead}>
            <h3>Casas ilustres</h3>
            <span>Restaurantes de nivel Oro y Diamante</span>
          </div>
          <div className={styles.illustriousRow}>
            {data.illustrious.map((restaurant) => (
              <Link key={restaurant.companyId} to={`/reservar/${restaurant.slug}`} className={styles.house}>
                <span className={styles.housePhoto} style={photo(restaurant.photoUrl) ? { backgroundImage: `url(${photo(restaurant.photoUrl)})` } : undefined} />
                <span className={styles.name}>{restaurant.name}</span>
                <span className={`${styles.levelChip} ${styles[`prestige_${restaurant.prestige.id}`]}`}>
                  Nv. {restaurant.level} · {restaurant.prestige.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default BestOfMonthSection
