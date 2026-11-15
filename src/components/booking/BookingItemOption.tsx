import type { ReactNode } from 'react'
import type { InventoryItemDefinition } from '../../data/inventoryItems'
import InventoryItemCard from '../InventoryItemCard'
import styles from './BookingItemOption.module.css'

interface BookingItemOptionProps {
  item: InventoryItemDefinition
  quantity: number
  active: boolean
  /** Qué hace la carta en esta reserva. */
  effect: ReactNode
  onToggle: (next: boolean) => void
}

/** Una carta del inventario que se puede usar en la reserva: se ve la carta y se pulsa entera. */
function BookingItemOption({ item, quantity, active, effect, onToggle }: BookingItemOptionProps) {
  return (
    <button
      type="button"
      className={`${styles.option} ${active ? styles.active : ''}`}
      aria-pressed={active}
      onClick={() => onToggle(!active)}
    >
      <span className={styles.cardSlot}>
        <InventoryItemCard item={item} quantity={quantity} selected={active} mini />
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.effect}>{effect}</span>
      </span>
      <span className={styles.state} aria-hidden="true">
        {active ? '✓ En uso' : 'Usar'}
      </span>
    </button>
  )
}

export default BookingItemOption
