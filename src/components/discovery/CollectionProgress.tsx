import { useEffect, useMemo } from 'react'
import { Award, Check, Trophy } from 'lucide-react'
import {
  loadRestaurantCollection,
  useRestaurantCollection,
  visitsForSlug,
  type CollectionArea,
  type CollectionTier,
} from '../../services/restaurantCollection'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import type { PublicDiscoveryRestaurant } from '../../utils/publicDiscovery'
import styles from './CollectionProgress.module.css'

/** Cuántos sellos se ven antes del «+N». */
const MAX_STAMPS = 14

function normalizePlace(value: string | undefined | null): string {
  return (value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function percentOf(area: CollectionArea): number {
  return area.total > 0 ? Math.min(100, Math.round((area.visited / area.total) * 100)) : 0
}

/** Anillo de progreso con el número en el centro. */
function Ring({ area }: { area: CollectionArea }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const percent = percentOf(area)
  const complete = area.total > 0 && area.visited >= area.total
  return (
    <div
      className={styles.ring}
      role="progressbar"
      aria-label={`${area.name}: has probado ${area.visited} de ${area.total}`}
      aria-valuemin={0}
      aria-valuemax={area.total}
      aria-valuenow={area.visited}
    >
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className={styles.ringTrack} cx="40" cy="40" r={radius} />
        <circle
          className={`${styles.ringFill} ${complete ? styles.ringDone : ''}`}
          cx="40"
          cy="40"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      <span className={styles.ringValue}>
        <strong>{area.visited}</strong>
        <span>de {area.total}</span>
      </span>
    </div>
  )
}

/** El próximo premio que se puede conseguir (primero la ciudad). */
function nextTier(tiers: CollectionTier[]): CollectionTier | null {
  return tiers.find((tier) => tier.available && !tier.earned) ?? null
}

/**
 * «Tu mapa gastronómico» como un álbum: los restaurantes de tu ciudad son sellos (en
 * color los que ya has probado, apagados los que te faltan) y un anillo dice cuántos
 * llevas de los que hay.
 */
function CollectionProgress({
  city,
  kicker = 'Tu mapa gastronómico',
  flush = false,
  restaurants,
  onOpenRestaurant,
}: {
  city: string
  kicker?: string
  /** Se mantiene por compatibilidad: el título ahora es la ciudad. */
  title?: string
  /** Sin margen lateral (dentro de otra columna, como Misiones). */
  flush?: boolean
  /** Restaurantes cargados en la pantalla: con ellos se dibujan los sellos. */
  restaurants?: PublicDiscoveryRestaurant[]
  onOpenRestaurant?: (restaurant: PublicDiscoveryRestaurant) => void
}) {
  const collection = useRestaurantCollection()

  useEffect(() => {
    void loadRestaurantCollection(city)
  }, [city])

  const stamps = useMemo(() => {
    if (!collection || !restaurants?.length) return []
    const cityName = normalizePlace(collection.city?.name)
    const pool = cityName
      ? restaurants.filter((restaurant) => normalizePlace(restaurant.municipality) === cityName)
      : restaurants.filter((restaurant) => visitsForSlug(collection, restaurant.slug) > 0)
    const withVisits = pool.map((restaurant) => ({ restaurant, visits: visitsForSlug(collection, restaurant.slug) }))
    return [...withVisits.filter((item) => item.visits > 0), ...withVisits.filter((item) => item.visits === 0)]
  }, [collection, restaurants])

  if (!collection || collection.country.total === 0) return null

  const main: CollectionArea = collection.city && collection.city.total > 0 ? collection.city : collection.country
  const showCountry = main !== collection.country
  const next = nextTier(collection.tiers)
  const left = next ? Math.max(0, next.target - next.visited) : 0
  const visible = stamps.slice(0, MAX_STAMPS)
  const hidden = stamps.length - visible.length

  return (
    <section className={`${styles.section} ${flush ? styles.flush : ''}`} aria-labelledby="collection-title">
      <div className={styles.card}>
        <div className={styles.top}>
          <div className={styles.headText}>
            <p className={styles.kicker}>{kicker}</p>
            <h2 id="collection-title" className={styles.title}>{main.name}</h2>
            <p className={styles.lead}>
              {main.visited === 0
                ? `Aún no has probado ninguno de los ${main.total}. ¡Empieza tu álbum!`
                : main.visited >= main.total
                  ? `¡Los has probado todos! ${main.total} de ${main.total}.`
                  : `Has probado ${main.visited} de los ${main.total} restaurantes.`}
            </p>
          </div>
          <Ring area={main} />
        </div>

        {visible.length > 0 ? (
          <ul className={styles.stamps} aria-label={`Restaurantes de ${main.name}`}>
            {visible.map(({ restaurant, visits }) => {
              const photo = restaurant.photoUrl
                ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoPreview)
                : ''
              const done = visits > 0
              return (
                <li key={restaurant.slug}>
                  <button
                    type="button"
                    className={`${styles.stamp} ${done ? styles.stampDone : ''}`}
                    onClick={() => onOpenRestaurant?.(restaurant)}
                    aria-label={`${restaurant.name}: ${done ? 'ya has ido' : 'te falta'}`}
                  >
                    <span className={styles.stampFace} aria-hidden="true">
                      {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : restaurant.name.charAt(0).toUpperCase()}
                      {done ? (
                        <span className={styles.stampCheck}><Check size={11} strokeWidth={3} /></span>
                      ) : null}
                    </span>
                    <span className={styles.stampName}>{restaurant.name}</span>
                  </button>
                </li>
              )
            })}
            {hidden > 0 ? (
              <li>
                <span className={styles.stampMore}>
                  <span className={styles.stampFace}>+{hidden}</span>
                  <span className={styles.stampName}>más</span>
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}

        <p className={styles.hint}>Cuenta cuando vas con reserva o validas un consumo.</p>

        <div className={styles.footer}>
          {showCountry ? (
            <span className={styles.chip}>
              {collection.country.name}
              <strong>{collection.country.visited}/{collection.country.total}</strong>
              <span className={styles.miniTrack} aria-hidden="true">
                <span style={{ width: `${percentOf(collection.country)}%` }} />
              </span>
            </span>
          ) : null}
          {next ? (
            <span className={`${styles.chip} ${styles.prizeChip}`}>
              <Trophy size={14} aria-hidden="true" />
              <span>
                {left > 0 ? <>Te faltan <strong>{left}</strong> para </> : null}
                <strong>{next.badgeName}</strong>
                <span className={styles.reward}> · {next.reward}</span>
              </span>
            </span>
          ) : null}
        </div>

        {collection.newlyEarned.length > 0 ? (
          <div className={styles.celebrate} role="status">
            <Award size={18} aria-hidden="true" />
            ¡Insignia única conseguida: {collection.newlyEarned.map((badge) => badge.name).join(', ')}! Tienes el premio en tu inventario.
          </div>
        ) : null}

        {collection.badges.length > 0 ? (
          <ul className={styles.badges} aria-label="Tus insignias del mapa">
            {collection.badges.map((badge) => (
              <li key={badge.id} className={styles.badge} title={badge.description}>
                <Check size={13} aria-hidden="true" /> {badge.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

export default CollectionProgress
