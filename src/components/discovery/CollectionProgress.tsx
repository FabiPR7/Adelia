import { useEffect } from 'react'
import { Award, Check } from 'lucide-react'
import {
  loadRestaurantCollection,
  useRestaurantCollection,
  type CollectionArea,
  type CollectionTier,
} from '../../services/restaurantCollection'
import styles from './CollectionProgress.module.css'

function Bar({ label, area }: { label: string; area: CollectionArea }) {
  const percent = area.total > 0 ? Math.min(100, Math.round((area.visited / area.total) * 100)) : 0
  const complete = area.total > 0 && area.visited >= area.total
  return (
    <div className={styles.area}>
      <div className={styles.areaHead}>
        <span className={styles.areaLabel}>{label}</span>
        <strong className={styles.count}>
          {area.visited}
          <span>/{area.total}</span>
        </strong>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={`${label}: has visitado ${area.visited} de ${area.total}`}
        aria-valuemin={0}
        aria-valuemax={area.total}
        aria-valuenow={area.visited}
      >
        <span className={`${styles.fill} ${complete ? styles.fillDone : ''}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/** El próximo premio que se puede conseguir (primero la ciudad). */
function nextTier(tiers: CollectionTier[]): CollectionTier | null {
  return tiers.find((tier) => tier.available && !tier.earned) ?? null
}

/** «Tu mapa gastronómico»: cuántos restaurantes de tu ciudad y de tu país has probado. */
function CollectionProgress({
  city,
  kicker = 'Tu mapa gastronómico',
  title = '¿Cuántos has probado?',
  flush = false,
}: {
  city: string
  kicker?: string
  title?: string
  /** Sin margen lateral (dentro de otra columna, como Misiones). */
  flush?: boolean
}) {
  const collection = useRestaurantCollection()

  useEffect(() => {
    void loadRestaurantCollection(city)
  }, [city])

  if (!collection || collection.country.total === 0) return null

  const next = nextTier(collection.tiers)
  const left = next ? Math.max(0, next.target - next.visited) : 0

  return (
    <section className={`${styles.section} ${flush ? styles.flush : ''}`} aria-labelledby="collection-title">
      <div className={styles.card}>
        <p className={styles.kicker}>{kicker}</p>
        <h2 id="collection-title" className={styles.title}>{title}</h2>
        <p className={styles.lead}>
          Cuenta cada restaurante al que vas: con una reserva a la que acudes o un consumo validado.
        </p>

        <div className={styles.areas}>
          {collection.city && collection.city.total > 0 ? <Bar label={collection.city.name} area={collection.city} /> : null}
          <Bar label={collection.country.name} area={collection.country} />
        </div>

        {collection.newlyEarned.length > 0 ? (
          <div className={styles.celebrate} role="status">
            <Award size={18} aria-hidden="true" />
            ¡Insignia única conseguida: {collection.newlyEarned.map((badge) => badge.name).join(', ')}! Tienes el premio en tu inventario.
          </div>
        ) : null}

        {next ? (
          <div className={styles.prize}>
            <span className={styles.prizeIcon} aria-hidden="true">
              <Award size={20} />
            </span>
            <span className={styles.prizeText}>
              <strong>{next.badgeName}</strong>
              <span>
                {next.scope === 'city'
                  ? `Visita los ${next.total} de ${collection.city?.name ?? 'tu ciudad'}`
                  : next.percent === 100
                    ? `Visita todos los de ${collection.country.name}`
                    : `Visita el ${next.percent} % de ${collection.country.name}`}
                {left > 0 ? ` · te faltan ${left}` : ''}
              </span>
              <span className={styles.reward}>Premio: insignia única + {next.reward}</span>
            </span>
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
