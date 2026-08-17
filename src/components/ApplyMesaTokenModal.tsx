import { useMemo, useState } from 'react'
import InventoryItemCard from './InventoryItemCard'
import {
  matchingReservationTokens,
  promoMinimumCents,
} from '../data/inventoryItems'
import { formatCentsAsEuros } from '../utils/minimumSpendVerification'
import type { PublicPromotion } from '../services/publicPromotions'
import { resolveActiveLadderPromotionId, sortCompanyLadderPromotions } from '../utils/promotionReservationProgress'
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
  const selected = tokens.find((item) => item.id === selectedId) ?? tokens[0] ?? null

  if (!open) {
    return null
  }

  const minLabel = promoMinCents > 0
    ? `gasto mínimo de ${formatCentsAsEuros(promoMinCents)}`
    : 'sin gasto mínimo'

  return (
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
          En <strong>{companyName}</strong> cuenta como reserva de fidelidad
          {' '}({minLabel}). Las llaves y sellos extra saltan el gasto mínimo.
        </p>
        {promoMinCents > 0 ? (
          <p>
            Sirve cualquier carta de gasto mínimo igual o mayor.
            Si la carta cubre menos, el restaurante verifica solo lo que falte.
          </p>
        ) : null}
        {tokens.length === 0 ? (
          <p className={styles.empty}>
            {promoMinCents > 0
              ? 'No tienes una carta, sello o llave para esta promo. Las de mesa libre no valen si hay gasto mínimo.'
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
        {selected ? (
          <p className={selected.coversFully ? styles.coverOk : styles.coverWarn}>
            {selected.coversFully
              ? `Esta carta cubre el mínimo. Se suman ${selected.visitValue ?? 1} ${(selected.visitValue ?? 1) === 1 ? 'reserva' : 'reservas'} al momento.`
              : `La carta cubre ${formatCentsAsEuros(selected.coverCents)}. Faltan ${formatCentsAsEuros(selected.remainderCents)}: el restaurante deberá verificar ese resto.`}
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
            disabled={!selected || applying}
            onClick={() => selected && onApply(selected.id)}
          >
            {applying
              ? 'Aplicando…'
              : selected?.coversFully === false
                ? 'Usar y verificar resto'
                : selected
                  ? 'Usar carta'
                  : 'Usar carta'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function resolveTokenTargetPromotionId(
  ladderPromotions: PublicPromotion[],
  activeByCompany: Record<string, string>,
  companyId: string,
): string | null {
  return resolveActiveLadderPromotionId(companyId, ladderPromotions, activeByCompany)
}
