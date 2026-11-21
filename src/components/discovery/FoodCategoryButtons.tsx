import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FOOD_CATEGORIES,
  restaurantMatchesFoodCategory,
  type FoodCategory,
} from '../../data/foodCategories'
import type { PublicDiscoveryRestaurant } from '../../utils/publicDiscovery'
import styles from './FoodCategoryButtons.module.css'

/** Cuadrados que se ven antes de «Ver más tipos» (3 filas de 3). */
const COLLAPSED = 9

export function foodCategoryPath(category: FoodCategory): string {
  return `/app/explorar/comida/${category.id}`
}

/**
 * «¿Qué te apetece hoy?»: un cuadrado grande por tipo de comida, en filas hacia abajo.
 * Primero los que tienen restaurantes; al pulsar, se abre la página de ese tipo.
 */
function FoodCategoryButtons({
  restaurants,
  activeId,
  title = '¿Qué te apetece hoy?',
  subtitle = 'Elige un tipo de comida y te enseñamos dónde',
}: {
  restaurants: PublicDiscoveryRestaurant[]
  activeId?: string
  title?: string | null
  subtitle?: string | null
}) {
  const [expanded, setExpanded] = useState(false)

  const items = useMemo(() => {
    const withCount = FOOD_CATEGORIES.map((category) => ({
      category,
      count: restaurants.filter((restaurant) => restaurantMatchesFoodCategory(restaurant, category)).length,
    }))
    return withCount
      .filter(({ category, count }) => category.main || count > 0 || category.id === activeId)
      .sort((a, b) => Number(b.count > 0) - Number(a.count > 0))
  }, [restaurants, activeId])

  const visible = expanded ? items : items.slice(0, COLLAPSED)

  return (
    <section className={styles.section} aria-label={title ?? 'Tipos de comida'}>
      {title ? (
        <div className={styles.heading}>
          <h2>{title}</h2>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      ) : null}
      <ul className={styles.grid}>
        {visible.map(({ category, count }) => (
          <li key={category.id}>
            <Link
              to={foodCategoryPath(category)}
              className={`${styles.tile} ${category.id === activeId ? styles.active : ''}`}
              aria-current={category.id === activeId ? 'page' : undefined}
              aria-label={`${category.label}${count > 0 ? `: ${count} ${count === 1 ? 'restaurante' : 'restaurantes'}` : ''}`}
            >
              <span className={styles.emoji} aria-hidden="true">{category.emoji}</span>
              <span className={styles.label}>{category.label}</span>
              {count > 0 ? <span className={styles.count} aria-hidden="true">{count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {items.length > COLLAPSED ? (
        <button type="button" className={styles.more} onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Ver menos' : `Ver más tipos (${items.length - COLLAPSED})`}
        </button>
      ) : null}
    </section>
  )
}

export default FoodCategoryButtons
