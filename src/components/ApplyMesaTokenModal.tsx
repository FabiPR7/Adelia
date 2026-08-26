import { useMemo, useState } from 'react'
import InventoryItemCard from './InventoryItemCard'
import ConfirmDialog from './ConfirmDialog'
import {
  matchingReservationTokens,
  promoMinimumCents,
} from '../data/inventoryItems'
import { formatCentsAsEuros } from '../utils/minimumSpendVerification'
import type { PublicPromotion } from '../services/publicPromotions'
import { sortCompanyLadderPromotions } from '../utils/promotionReservationProgress'
import styles from './ApplyMesaTokenModal.module.css'

interface ApplyMesaTokenModalProps {
  open: boolean
  companyName: string
  companyId: string
  ladderPromotions: PublicPromotion[]
  activePromotionId?: string | null
  inventory: Record<string, number>
  applying?: boolean
  error?: string | null
  notice?: string | null
  onClose: () => void
  onApply: (itemId: string) => void
}

function promoMinForPromotions(
  promotions: PublicPromotion[],
  activePromotionId?: string | null,
): number {
  const ladder = sortCompanyLadderPromotions(promotions)
  const active = ladder.find((promotion) => promotion.id === activePromotionId) ?? ladder[0]
  if (!active) {
    return 0
  }

  return promoMinimumCents(active.minimumSpendCents, active.minimumSpendEnabled)
}

export default function ApplyMesaTokenModal({
  open,
  companyName,
  companyId,
  ladderPromotions,
  activePromotionId,
  inventory,
  applying = false,
  error = null,
  notice = null,
  onClose,
  onApply,
}: ApplyMesaTokenModalProps) {
  const promoMinCents = useMemo(
    () => promoMinForPromotions(ladderPromotions, activePromotionId),
    [activePromotionId, ladderPromotions],
  )
  const tokens = matchingReservationTokens(inventory, promoMinCents)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const selected = tokens.find((item) => item.id === selectedId) ?? tokens[0] ?? null
  const selectedValid = Boolean(selected?.coversFully)

  if (!open) {
    return null
  }

  const minLabel = promoMinCents > 0
    ? `gasto mínimo de ${formatCentsAsEuros(promoMinCents)}`
    : 'sin gasto mínimo'
  const visits = selected?.visitValue ?? 1

  const handleUseClick = () => {
    if (!selected) {
      return
    }
    if (!selected.coversFully) {
      return
    }
    setConfirmOpen(true)
  }

  return (
    <>
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <section
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-token-title"
      >
        <h2 id="apply-token-title">Usar carta o llave</h2>
        <p>
          En <strong>{companyName}</strong> cuenta como reserva o consumo
          {' '}({minLabel}). Solo valen cartas que cubran el gasto mínimo de esta oferta.
        </p>
        {tokens.length === 0 ? (
          <p className={styles.empty}>
            {promoMinCents > 0
              ? 'No tienes una carta válida para esta oferta. Tiene que cubrir el gasto mínimo; si no, no se gasta.'
              : 'No tienes cartas de mesa, sellos ni llaves. Consíguelas en Misiones.'}
          </p>
        ) : (
          <div className={styles.grid}>
            {tokens.map((item) => (
              <InventoryItemCard
                key={`${companyId}-${item.id}`}
                item={item}
                quantity={item.quantity}
                selected={(selected?.id ?? null) === item.id}
                compact
                onClick={() => setSelectedId(item.id)}
              />
            ))}
          </div>
        )}
        {selectedValid ? (
          <p className={styles.coverOk}>
            Esta carta cubre el mínimo. Se suman {visits} {visits === 1 ? 'visita' : 'visitas'} al momento.
          </p>
        ) : null}
        {notice ? <p className={styles.notice}>{notice}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!selectedValid || applying}
            onClick={handleUseClick}
          >
            {applying ? 'Aplicando…' : 'Usar carta'}
          </button>
        </div>
      </section>
    </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        elevated
        title="¿Usar esta carta?"
        message={
          selected
            ? `Se gastará 1 × ${selected.name} en ${companyName} y sumará ${visits} ${visits === 1 ? 'visita' : 'visitas'} a la oferta. Si cancelas, no se gasta nada.`
            : ''
        }
        confirmLabel="Sí, usarla"
        cancelLabel="No, cancelar"
        isLoading={applying}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (!selected || !selected.coversFully) {
            setConfirmOpen(false)
            return
          }
          setConfirmOpen(false)
          onApply(selected.id)
        }}
      />
    </>
  )
}
