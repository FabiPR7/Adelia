import { useMemo, useState } from 'react'
import type { MenuNode } from '../../types/company'
import { getMenuProductCategoryLabel } from '../../utils/promotionOffer'
import styles from './PromotionProductPicker.module.css'

interface PromotionProductPickerProps {
  menuNodes: MenuNode[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
}

export default function PromotionProductPicker({
  menuNodes,
  selectedIds,
  onChange,
}: PromotionProductPickerProps) {
  const [query, setQuery] = useState('')

  const products = useMemo(
    () => menuNodes
      .filter((node) => node.nodeType === 'product' && node.active)
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

  const selectedProducts = useMemo(
    () => selectedIds
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is MenuNode => product != null),
    [products, selectedIds],
  )

  const toggleProduct = (productId: string) => {
    if (selectedIds.includes(productId)) {
      onChange(selectedIds.filter((id) => id !== productId))
      return
    }

    onChange([...selectedIds, productId])
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <label htmlFor="promotion-product-search">Productos de la carta</label>
        <span className={styles.counter}>{selectedIds.length} seleccionados</span>
      </div>

      {selectedProducts.length > 0 ? (
        <div className={styles.selectedList}>
          {selectedProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              className={styles.selectedChip}
              onClick={() => toggleProduct(product.id)}
            >
              <span>{product.name}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>Elige uno o varios productos. La foto se generará automáticamente.</p>
      )}

      <input
        id="promotion-product-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar producto o categoría…"
        className={styles.searchInput}
      />

      {products.length === 0 ? (
        <p className={styles.empty}>No hay productos activos en la carta. Créalos en Carta digital.</p>
      ) : groupedProducts.length === 0 ? (
        <p className={styles.empty}>Ningún producto coincide con la búsqueda.</p>
      ) : (
        <div className={styles.groups}>
          {groupedProducts.map(([category, items]) => (
            <section key={category} className={styles.group}>
              <h4>{category}</h4>
              <ul className={styles.productList}>
                {items.map((product) => {
                  const checked = selectedIds.includes(product.id)

                  return (
                    <li key={product.id}>
                      <label className={`${styles.productRow} ${checked ? styles.productRowSelected : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProduct(product.id)}
                        />
                        <span className={styles.productName}>{product.name}</span>
                        {product.photoUrl ? (
                          <span className={styles.photoBadge}>Con foto</span>
                        ) : null}
                      </label>
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
