import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  FOOD_CATEGORIES,
  restaurantMatchesFoodCategory,
  type FoodCategory,
} from '../../data/foodCategories'
import type { PublicDiscoveryRestaurant } from '../../utils/publicDiscovery'
import styles from './FoodCategoryButtons.module.css'

export function foodCategoryPath(category: FoodCategory): string {
  return `/app/explorar/comida/${category.id}`
}

/**
 * «¿Qué te apetece hoy?»: un botón por tipo de comida. Salen siempre los principales
 * y, además, cualquier otro tipo que tenga algún restaurante. Al pulsar, se abre la
 * página con los restaurantes de ese tipo.
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
  const items = useMemo(() => {
    const withCount = FOOD_CATEGORIES.map((category) => ({
      category,
      count: restaurants.filter((restaurant) => restaurantMatchesFoodCategory(restaurant, category)).length,
    }))
    return withCount
      .filter(({ category, count }) => category.main || count > 0 || category.id === activeId)
      .sort((a, b) => Number(b.count > 0) - Number(a.count > 0))
  }, [restaurants, activeId])

  return (
    <section className={styles.section} aria-label={title ?? 'Tipos de comida'}>
      {title ? (
        <div className={styles.heading}>
          <h2>{title}</h2>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      ) : null}
      <ul className={styles.row}>
        {items.map(({ category, count }) => (
          <li key={category.id}>
            <Link
              to={foodCategoryPath(category)}
              className={`${styles.button} ${category.id === activeId ? styles.active : ''}`}
              aria-current={category.id === activeId ? 'page' : undefined}
            >
              <span className={styles.emoji} aria-hidden="true">{category.emoji}</span>
              <span className={styles.label}>{category.label}</span>
              {count > 0 ? <span className={styles.count}>{count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default FoodCategoryButtons
