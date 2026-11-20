import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Repeat } from 'lucide-react'
import { useRestaurantCollection, visitsForSlug } from '../../services/restaurantCollection'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import type { PublicDiscoveryRestaurant } from '../../utils/publicDiscovery'
import styles from './VisitRows.module.css'

interface VisitRowsProps {
  /** Ya ordenados: primero los de tu zona. */
  restaurants: PublicDiscoveryRestaurant[]
}

function ratingOf(restaurant: PublicDiscoveryRestaurant): number {
  return restaurant.reviewCount > 0 ? restaurant.reviewRatingSum / restaurant.reviewCount : 0
}

function Row({
  id,
  icon,
  kicker,
  title,
  items,
  visited,
  badge,
}: {
  id: string
  icon: React.ReactNode
  kicker: string
  title: string
  items: PublicDiscoveryRestaurant[]
  visited: boolean
  badge: (restaurant: PublicDiscoveryRestaurant) => string
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.heading}>
        <span className={`${styles.kicker} ${visited ? styles.kickerVisited : ''}`}>
          {icon} {kicker}
        </span>
        <h2 id={id}>{title}</h2>
      </div>
      <ul className={styles.row}>
        {items.map((restaurant) => {
          const photo = restaurant.photoUrl
            ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoPreview)
            : ''
          return (
            <li key={restaurant.slug}>
              <Link
                to={`/reservar/${restaurant.slug}`}
                className={`${styles.card} ${visited ? styles.cardVisited : styles.cardNew}`}
              >
                <span className={styles.media}>
                  {photo ? (
                    <img src={photo} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className={styles.fallback} aria-hidden="true">{restaurant.name.charAt(0)}</span>
                  )}
                  <span className={`${styles.pill} ${visited ? styles.pillVisited : ''}`}>{badge(restaurant)}</span>
                </span>
                <span className={styles.body}>
                  <strong className={styles.name}>{restaurant.name}</strong>
                  {restaurant.municipality ? <span className={styles.place}>{restaurant.municipality}</span> : null}
                  <span className={styles.cta}>{visited ? 'Repetir' : 'Descubrir'} →</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** «Descubre uno nuevo» y «Tus restaurantes de confianza». */
function VisitRows({ restaurants }: VisitRowsProps) {
  const collection = useRestaurantCollection()

  const { fresh, trusted } = useMemo(() => {
    if (!collection) return { fresh: [], trusted: [] }
    const notVisited = restaurants.filter((restaurant) => visitsForSlug(collection, restaurant.slug) === 0)
    // Los de tu zona van primero en la lista: de los 20 primeros, los mejor valorados.
    const fresh = [...notVisited.slice(0, 20)]
      .sort((a, b) => ratingOf(b) - ratingOf(a) || b.reviewCount - a.reviewCount)
      .slice(0, 10)
    const trusted = restaurants
      .filter((restaurant) => visitsForSlug(collection, restaurant.slug) > 0)
      .sort((a, b) => visitsForSlug(collection, b.slug) - visitsForSlug(collection, a.slug))
      .slice(0, 10)
    return { fresh, trusted }
  }, [collection, restaurants])

  if (!collection) return null

  return (
    <>
      {fresh.length > 0 ? (
        <Row
          id="visit-new-title"
          icon={<Compass size={14} aria-hidden="true" />}
          kicker="Aún no has ido"
          title="Descubre uno nuevo"
          items={fresh}
          visited={false}
          badge={() => 'Sin visitar'}
        />
      ) : null}
      {trusted.length > 0 ? (
        <Row
          id="visit-trusted-title"
          icon={<Repeat size={14} aria-hidden="true" />}
          kicker="Sobre seguro"
          title="Tus restaurantes de confianza"
          items={trusted}
          visited
          badge={(restaurant) => {
            const count = visitsForSlug(collection, restaurant.slug)
            return count === 1 ? '✓ 1 visita' : `✓ ${count} visitas`
          }}
        />
      ) : null}
    </>
  )
}

export default VisitRows
