import type { PublicPromotion } from '../../services/publicPromotions'
import { resolvePromotionHighlight } from '../../utils/promotionOffer'
import styles from './PromotionClaimTicketModal.module.css'

interface PromotionClaimTicketModalProps {
  promotion: PublicPromotion | null
  onClose: () => void
}

export default function PromotionClaimTicketModal({
  promotion,
  onClose,
}: PromotionClaimTicketModalProps) {
  if (!promotion) {
    return null
  }

  const prizeLabel = resolvePromotionHighlight(promotion, 0)

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.ticket}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-ticket-title"
      >
        <div className={styles.ticketHeader}>
          <span className={styles.ticketEmoji} aria-hidden="true">🎉</span>
          <h2 id="claim-ticket-title">¡Felicidades por tu fidelidad!</h2>
          <p>Has completado las reservas o consumos necesarios. Este es tu premio.</p>
        </div>

        <div className={styles.prizeBlock}>
          <p className={styles.prizeEyebrow}>Te has ganado</p>
          <p className={styles.prizeValue}>{prizeLabel}</p>
          <p className={styles.prizeTitle}>{promotion.title}</p>
          <p className={styles.prizeRestaurant}>{promotion.companyName}</p>
        </div>

        <div className={styles.instruction}>
          <strong>Enseñale esto al restaurante</strong>
          <span>Muéstrale esta pantalla en tu próxima visita para canjear tu recompensa.</span>
        </div>

        <button type="button" className={styles.closeButton} onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  )
}
