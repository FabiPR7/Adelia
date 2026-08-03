import type { SortState } from '../../utils/tableSort'
import styles from './SortableTh.module.css'

interface SortableThProps {
  label: string
  sortKey: string
  sort: SortState
  onSort: (key: string) => void
}

function SortableTh({ label, sortKey, sort, onSort }: SortableThProps) {
  const active = sort.key === sortKey
  const directionLabel = sort.direction === 'asc' ? 'ascendente' : 'descendente'

  return (
    <th scope="col">
      <button
        type="button"
        className={`${styles.sortButton} ${active ? styles.sortButtonActive : ''}`}
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{label}</span>
        <span className={styles.sortIcon} aria-hidden="true">
          {active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
        <span className={styles.srOnly}>
          {active ? `Ordenado ${directionLabel}` : 'Ordenar columna'}
        </span>
      </button>
    </th>
  )
}

export default SortableTh
