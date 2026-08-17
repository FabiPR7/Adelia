import type { InventoryItemDefinition } from '../data/inventoryItems'
import { itemEmblem } from '../data/inventoryItems'
import InventoryItemEmblem from './InventoryItemEmblem'
import styles from './InventoryItemCard.module.css'

interface InventoryItemCardProps {
  item: InventoryItemDefinition
  quantity?: number
  selected?: boolean
  dimmed?: boolean
  compact?: boolean
  mini?: boolean
  featured?: boolean
  onClick?: () => void
}

function InventoryItemCard({
  item,
  quantity = 0,
  selected = false,
  dimmed = false,
  compact = false,
  mini = false,
  featured = false,
  onClick,
}: InventoryItemCardProps) {
  const className = [
    styles.card,
    styles[`rarity_${item.rarity}`],
    compact ? styles.compact : '',
    mini ? styles.mini : '',
    featured ? styles.featured : '',
    selected ? styles.selected : '',
    dimmed ? styles.dimmed : '',
    onClick ? styles.clickable : '',
  ].filter(Boolean).join(' ')

  const label = quantity > 0 ? `${item.name}, ${quantity}` : item.name

  const content = (
    <>
      <span className={styles.material} aria-hidden="true" />
      <span className={styles.sheen} aria-hidden="true" />
      <span className={styles.innerFrame} aria-hidden="true" />
      {quantity > 0 ? <span className={styles.qty}>{quantity}</span> : null}
      <div className={`${styles.stage} ${item.kind === 'cancel_shield' ? styles.stageShield : ''}`}>
        <InventoryItemEmblem emblem={itemEmblem(item)} />
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={label}
        aria-pressed={selected}
      >
        {content}
      </button>
    )
  }

  return <article className={className} aria-label={label}>{content}</article>
}

export default InventoryItemCard
