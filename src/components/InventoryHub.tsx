import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import InventoryItemCard from './InventoryItemCard'
import { PROMO_LOCK_STRIKES } from '../data/cancellationPenalties'
import {
  INVENTORY_ITEMS,
  getInventoryItem,
  inventoryQuantity,
  inventoryTotalCount,
  isPromoSpendItem,
  type InventoryItemDefinition,
} from '../data/inventoryItems'
import styles from './InventoryHub.module.css'

type InventoryFilter = 'owned' | 'mesas' | 'utilidad' | 'all'

interface InventoryHubProps {
  inventory: Record<string, number>
  strikeCount?: number
  promoLocked?: boolean
  onUseItem?: (itemId: string) => Promise<string>
}

function isUtility(item: InventoryItemDefinition) {
  return !isPromoSpendItem(item)
}

function canUseFromHub(item: InventoryItemDefinition) {
  return item.kind === 'pardon' || item.kind === 'unlock'
}

function hubRoute(item: InventoryItemDefinition): { to: string; label: string } | null {
  switch (item.kind) {
    case 'reservation_token':
    case 'ladder_boost':
      return { to: '/app/promociones', label: 'Usar en Promos' }
    case 'extra_pax':
    case 'deposit_pass':
      return { to: '/app/explorar', label: 'Ir a reservar' }
    case 'cancel_shield':
      return { to: '/app/reservas', label: 'Cancelar una reserva' }
    case 'review_boost':
      return { to: '/app/reservas', label: 'Ir a reseñar' }
    default:
      return null
  }
}

function hubUseBlockedReason(
  item: InventoryItemDefinition,
  quantity: number,
  strikeCount: number,
  promoLocked: boolean,
): string | null {
  if (!canUseFromHub(item) || quantity < 1) {
    return null
  }
  if (item.kind === 'pardon' && strikeCount < 1) {
    return 'No tienes avisos de cancelación que quitar.'
  }
  if (item.kind === 'unlock' && !promoLocked && strikeCount < PROMO_LOCK_STRIKES) {
    return 'Tus promos no están bloqueadas. Esta carta no haría nada ahora.'
  }
  return null
}

function InventoryHub({
  inventory,
  strikeCount = 0,
  promoLocked = false,
  onUseItem,
}: InventoryHubProps) {
  const [filter, setFilter] = useState<InventoryFilter>('owned')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const total = inventoryTotalCount(inventory)
  const selected = selectedId ? getInventoryItem(selectedId) : null
  const selectedQty = selected ? inventoryQuantity(inventory, selected.id) : 0

  const visibleItems = useMemo(() => {
    const owned = INVENTORY_ITEMS.filter((item) => inventoryQuantity(inventory, item.id) > 0)
    if (filter === 'owned') {
      return owned.length > 0 ? owned : INVENTORY_ITEMS
    }
    if (filter === 'mesas') {
      return INVENTORY_ITEMS.filter((item) => isPromoSpendItem(item))
    }
    if (filter === 'utilidad') {
      return INVENTORY_ITEMS.filter((item) => isUtility(item))
    }
    return INVENTORY_ITEMS
  }, [filter, inventory])

  const showingCatalog = filter === 'owned' && total === 0

  return (
    <section className={styles.hub}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Colección</p>
          <h2>Mis ítems</h2>
          <p className={styles.lead}>
            Cada carta se usa en un sitio concreto. Ábrela y pulsa el botón.
          </p>
        </div>
        <strong className={styles.total}>{total}</strong>
      </header>

      <ul className={styles.legend} aria-label="Rareza de las cartas">
        <li><span className={styles.dotWhite} />blanca</li>
        <li><span className={styles.dotCopper} />cobre</li>
        <li><span className={styles.dotSilver} />plata</li>
        <li><span className={styles.dotGold} />oro</li>
        <li><span className={styles.dotAzure} />épica</li>
      </ul>

      <div className={styles.filters} role="tablist" aria-label="Filtrar ítems">
        {([
          ['owned', 'Tengo'],
          ['mesas', 'Promos'],
          ['utilidad', 'Útiles'],
          ['all', 'Guía'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? styles.filterActive : styles.filter}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {showingCatalog ? (
        <p className={styles.emptyHint}>
          Aún no tienes cartas. Completa misiones, reclama el bonus de temporada o sube de nivel.
        </p>
      ) : null}

      <div className={styles.grid}>
        {visibleItems.map((item) => {
          const quantity = inventoryQuantity(inventory, item.id)
          return (
            <InventoryItemCard
              key={item.id}
              item={item}
              quantity={quantity}
              dimmed={quantity === 0}
              selected={selectedId === item.id}
              onClick={() => setSelectedId(item.id)}
            />
          )
        })}
      </div>

      {selected ? (
        <ItemDetail
          item={selected}
          quantity={selectedQty}
          strikeCount={strikeCount}
          promoLocked={promoLocked}
          onClose={() => setSelectedId(null)}
          onUse={canUseFromHub(selected) && selectedQty > 0 && selected.usable !== false
            ? onUseItem
            : undefined}
        />
      ) : null}
    </section>
  )
}

function ItemDetail({
  item,
  quantity,
  strikeCount,
  promoLocked,
  onClose,
  onUse,
}: {
  item: InventoryItemDefinition
  quantity: number
  strikeCount: number
  promoLocked: boolean
  onClose: () => void
  onUse?: (itemId: string) => Promise<string>
}) {
  const [using, setUsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const route = hubRoute(item)
  const blockedReason = hubUseBlockedReason(item, quantity, strikeCount, promoLocked)

  const handleUse = async () => {
    if (!onUse || blockedReason) {
      return
    }
    setUsing(true)
    setError(null)
    try {
      const message = await onUse(item.id)
      setNotice(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo usar.')
    } finally {
      setUsing(false)
    }
  }

  return (
    <div className={styles.detailOverlay} onClick={onClose} role="presentation">
      <article
        className={styles.detail}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-title"
      >
        <div className={styles.detailCard}>
          <InventoryItemCard item={item} quantity={quantity} featured />
        </div>
        <h3 id="item-detail-title">{item.name}</h3>
        <p className={styles.detailCopy}>{item.description}</p>
        <p className={styles.detailBlock}>
          <strong>Cómo se usa</strong>
          {item.howToUse}
        </p>
        <p className={styles.detailBlock}>
          <strong>Cómo se consigue</strong>
          {item.howToEarn}
        </p>
        <p className={styles.ownedLine}>
          {quantity > 0 ? `Tienes ${quantity}` : 'Todavía no tienes esta carta'}
        </p>
        {error ? <p className={styles.detailError}>{error}</p> : null}
        {notice ? <p className={styles.ownedLine}>{notice}</p> : null}
        {blockedReason ? <p className={styles.detailHint}>{blockedReason}</p> : null}
        {onUse && !blockedReason ? (
          <button type="button" className={styles.useDetail} disabled={using} onClick={() => void handleUse()}>
            {using ? 'Usando…' : 'Usar ahora'}
          </button>
        ) : null}
        {route ? (
          <Link to={route.to} className={onUse && !blockedReason ? styles.goUse : styles.useDetail}>
            {quantity > 0 ? route.label : 'Dónde se usa'}
          </Link>
        ) : null}
        <button type="button" className={styles.closeDetail} onClick={onClose}>
          Entendido
        </button>
      </article>
    </div>
  )
}

export default InventoryHub
