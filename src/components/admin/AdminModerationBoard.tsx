import { useMemo, useState } from 'react'
import type { IndexedReview } from '../../types/adminOps'
import { IconSearch } from './AdminIcons'
import styles from './AdminOpsBoard.module.css'

interface AdminModerationBoardProps {
  reviews: IndexedReview[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  onDelete: (review: IndexedReview) => Promise<void>
}

function AdminModerationBoard({
  reviews,
  isLoading,
  isSaving,
  error,
  onDelete,
}: AdminModerationBoardProps) {
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return reviews
    return reviews.filter((review) => (
      [review.companyName, review.commentExcerpt, String(review.rating)]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    ))
  }, [query, reviews])

  return (
    <div className={styles.wrap}>
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.kpis}>
        <article>
          <strong>{reviews.length}</strong>
          <span>Reseñas públicas</span>
        </article>
        <article>
          <strong>{reviews.filter((review) => review.rating <= 2).length}</strong>
          <span>Nota 1–2</span>
        </article>
        <article>
          <strong>{reviews.filter((review) => review.hasPhoto).length}</strong>
          <span>Con foto</span>
        </article>
        <article>
          <strong>{reviews.filter((review) => !review.commentExcerpt.trim()).length}</strong>
          <span>Sin texto</span>
        </article>
      </div>

      <label className={styles.search}>
        <IconSearch />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por local o texto" />
      </label>

      <div className={styles.panel}>
        {isLoading ? (
          <p className={styles.empty}>Cargando reseñas…</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>No hay reseñas en el índice.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Local</th>
                <th>Nota</th>
                <th>Texto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((review) => (
                <tr key={review.id}>
                  <td>
                    <strong>{review.companyName}</strong>
                    <em>{new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(review.createdAt)}</em>
                  </td>
                  <td>
                    {review.rating}/5
                    {review.hasPhoto ? <em>Con foto</em> : null}
                  </td>
                  <td>{review.commentExcerpt || '—'}</td>
                  <td>
                    <button type="button" className={styles.danger} disabled={isSaving} onClick={() => void onDelete(review)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AdminModerationBoard
