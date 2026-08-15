import { useMemo, useState } from 'react'
import type { MenuNode } from '../types/company'
import type { PublicPromotion } from '../services/publicPromotions'
import type { ReviewTaggedProduct, ReviewTaggedPromotion } from '../types/review'
import styles from './ReviewTagSearchPanel.module.css'

type TagPickerMode = 'product' | 'promotion'

interface ReviewTagSearchPanelProps {
  mode: TagPickerMode
  menuProducts: MenuNode[]
  promotions: PublicPromotion[]
  onSelectProduct: (tag: ReviewTaggedProduct) => void
  onSelectPromotion: (tag: ReviewTaggedPromotion) => void
  onClose: () => void
}

function ReviewTagSearchPanel({
  mode,
  menuProducts,
  promotions,
  onSelectProduct,
  onSelectPromotion,
  onClose,
}: ReviewTagSearchPanelProps) {
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLowerCase()

  const productResults = useMemo(() => menuProducts
    .filter((node) => node.nodeType === 'product' && node.active)
    .filter((node) => !normalizedQuery || node.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 8), [menuProducts, normalizedQuery])

  const promotionResults = useMemo(() => promotions
    .filter((promotion) => {
      if (!normalizedQuery) {
        return true
      }

      return promotion.title.toLowerCase().includes(normalizedQuery)
        || promotion.description.toLowerCase().includes(normalizedQuery)
    })
    .slice(0, 8), [promotions, normalizedQuery])

  const results = mode === 'product' ? productResults : promotionResults

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <strong>{mode === 'product' ? 'Etiquetar producto' : 'Etiquetar promo'}</strong>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={mode === 'product' ? 'Buscar en la carta…' : 'Buscar promoción…'}
        className={styles.searchInput}
        autoFocus
      />

      <ul className={styles.results}>
        {results.length === 0 ? (
          <li className={styles.empty}>No hay resultados.</li>
        ) : mode === 'product' ? (
          productResults.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                className={styles.resultButton}
                onClick={() => {
                  onSelectProduct({
                    nodeId: node.id,
                    boardId: node.boardId,
                    name: node.name,
                  })
                }}
              >
                <span>{node.name}</span>
              </button>
            </li>
          ))
        ) : (
          promotionResults.map((promotion) => (
            <li key={promotion.id}>
              <button
                type="button"
                className={styles.resultButton}
                onClick={() => {
                  onSelectPromotion({
                    promotionId: promotion.id,
                    name: promotion.title,
                  })
                }}
              >
                <span>{promotion.title}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

export default ReviewTagSearchPanel
