import { useMemo, useState } from 'react'
import type { MenuNode } from '../../types/company'
import { getMenuProductCategoryLabel } from '../../utils/promotionOffer'
import { formatMenuPrice } from '../../utils/menuTree'
import type { ProductCartQuantities } from '../../utils/minimumSpendVerification'
import styles from './MinSpendProductCart.module.css'

interface MinSpendProductCartProps {
  menuNodes: MenuNode[]
  quantities: ProductCartQuantities
  onChange: (quantities: ProductCartQuantities) => void
}

export default function MinSpendProductCart({
  menuNodes,
  quantities,
  onChange,
}: MinSpendProductCartProps) {
  const [query, setQuery] = useState('')

  const products = useMemo(
    () => menuNodes
      .filter((node) => node.nodeType === 'product' && node.active && node.priceCents != null)
      .sort((left, right) => left.name.localeCompare(right.name, 'es')),
    [menuNodes],
  )

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return products
    }

    return products.filter((product) => {
      const category = getMenuProductCategoryLabel(product, menuNodes).toLowerCase()
      return product.name.toLowerCase().includes(normalized) || category.includes(normalized)
    })
  }, [menuNodes, products, query])

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, MenuNode[]>()

    for (const product of filteredProducts) {
      const category = getMenuProductCategoryLabel(product, menuNodes)
      const bucket = groups.get(category) ?? []
      bucket.push(product)
      groups.set(category, bucket)
    }

    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, 'es'))
  }, [filteredProducts, menuNodes])

  const selectedLines = useMemo(
    () => Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([nodeId, quantity]) => {
        const product = products.find((item) => item.id === nodeId)
        if (!product || product.priceCents == null) {
          return null
        }

        return {
          product,
          quantity,
          lineTotalCents: product.priceCents * quantity,
        }
      })
      .filter((line): line is NonNullable<typeof line> => line != null),
    [products, quantities],
  )

  const updateQuantity = (productId: string, nextQuantity: number) => {
    const safeQuantity = Math.max(0, Math.trunc(nextQuantity))
    const next = { ...quantities }

    if (safeQuantity === 0) {
      delete next[productId]
    } else {
      next[productId] = safeQuantity
    }

    onChange(next)
  }

  return (
    <div className={styles.wrapper}>
      {selectedLines.length > 0 ? (
        <div className={styles.cart}>
          <p className={styles.cartTitle}>Tu pedido</p>
          <ul className={styles.cartList}>
            {selectedLines.map(({ product, quantity, lineTotalCents }) => (
              <li key={product.id} className={styles.cartRow}>
                <div className={styles.cartInfo}>
                  <strong>{product.name}</strong>
                  <span>{formatMenuPrice(product.priceCents, product.priceCurrency)}</span>
                </div>
                <div className={styles.quantityControls}>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    onClick={() => updateQuantity(product.id, quantity - 1)}
                    aria-label={`Quitar uno de ${product.name}`}
                  >
                    −
                  </button>
                  <span className={styles.quantityValue}>{quantity}</span>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    onClick={() => updateQuantity(product.id, quantity + 1)}
                    aria-label={`Añadir uno de ${product.name}`}
                  >
                    +
                  </button>
                </div>
                <span className={styles.lineTotal}>
                  {formatMenuPrice(lineTotalCents, product.priceCurrency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.hint}>Añade productos de la carta. Puedes repetir los que quieras.</p>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar producto o categoría…"
        className={styles.searchInput}
      />

      {products.length === 0 ? (
        <p className={styles.empty}>Este restaurante no tiene productos con precio en la carta.</p>
      ) : groupedProducts.length === 0 ? (
        <p className={styles.empty}>Ningún producto coincide con la búsqueda.</p>
      ) : (
        <div className={styles.groups}>
          {groupedProducts.map(([category, items]) => (
            <section key={category} className={styles.group}>
              <h4>{category}</h4>
              <ul className={styles.productList}>
                {items.map((product) => {
                  const quantity = quantities[product.id] ?? 0

                  return (
                    <li key={product.id} className={styles.productRow}>
                      <div className={styles.productInfo}>
                        <strong>{product.name}</strong>
                        <span>{formatMenuPrice(product.priceCents, product.priceCurrency)}</span>
                      </div>
                      <div className={styles.quantityControls}>
                        <button
                          type="button"
                          className={styles.quantityButton}
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          disabled={quantity === 0}
                          aria-label={`Quitar ${product.name}`}
                        >
                          −
                        </button>
                        <span className={styles.quantityValue}>{quantity}</span>
                        <button
                          type="button"
                          className={styles.quantityButton}
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          aria-label={`Añadir ${product.name}`}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
