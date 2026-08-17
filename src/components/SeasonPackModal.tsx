import InventoryItemCard from './InventoryItemCard'
import {
  MONTHLY_MISSION_SLOT_COUNT,
  WEEKLY_MISSION_SLOT_COUNT,
  hasGrantedKey,
  resolveGrantItems,
  rewardsForSeasonPack,
  seasonPackGrantKey,
  type SeasonPackKind,
} from '../data/inventoryItems'
import { WEEKLY_BONUS_TARGET, WEEKLY_MISSION_BONUS_XP } from '../types/gamification'
import styles from './SeasonPackModal.module.css'

interface SeasonPackModalProps {
  open: boolean
  weekKey: string
  monthKey: string
  weeklyCompleted: number
  monthlyCompleted: number
  grantedItemKeys: string[]
  claiming?: SeasonPackKind | null
  error?: string | null
  onClose: () => void
  onClaim: (pack: SeasonPackKind) => void
}

function PackRow({
  kind,
  title,
  detail,
  progressLabel,
  ready,
  claimed,
  claiming,
  weekKey,
  monthKey,
  onClaim,
}: {
  kind: SeasonPackKind
  title: string
  detail: string
  progressLabel: string
  ready: boolean
  claimed: boolean
  claiming: boolean
  weekKey: string
  monthKey: string
  onClaim: (pack: SeasonPackKind) => void
}) {
  const items = resolveGrantItems(rewardsForSeasonPack(kind, weekKey, monthKey))

  return (
    <article className={styles.pack}>
      <header className={styles.packHead}>
        <div>
          <h3>{title}</h3>
          <p>{detail}</p>
        </div>
        <span className={styles.progress}>{progressLabel}</span>
      </header>
      <div className={styles.prizes}>
        {items.map(({ item, quantity }) => (
          <div key={item.id} className={styles.prize}>
            <InventoryItemCard item={item} quantity={quantity} mini />
            <span>{item.name}{quantity > 1 ? ` ×${quantity}` : ''}</span>
          </div>
        ))}
      </div>
      {claimed ? (
        <p className={styles.claimed}>Ya reclamado</p>
      ) : ready ? (
        <button
          type="button"
          className={styles.claim}
          disabled={claiming}
          onClick={() => onClaim(kind)}
        >
          {claiming ? 'Reclamando…' : 'Reclamar'}
        </button>
      ) : (
        <p className={styles.wait}>Completa las misiones para reclamar.</p>
      )}
    </article>
  )
}

function SeasonPackModal({
  open,
  weekKey,
  monthKey,
  weeklyCompleted,
  monthlyCompleted,
  grantedItemKeys,
  claiming = null,
  error = null,
  onClose,
  onClaim,
}: SeasonPackModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <section
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="season-pack-title"
      >
        <h2 id="season-pack-title">Premios de temporada</h2>
        <p className={styles.lead}>
          Cada semana y cada mes cambian las cartas. El XP de las 5 misiones se suma solo;
          las cartas hay que reclamarlas aquí. Si bajas de nivel por cancelar, esos premios
          de nivel no se vuelven a dar.
        </p>

        <PackRow
          kind="weekly_bonus"
          title={`${WEEKLY_BONUS_TARGET} de ${WEEKLY_MISSION_SLOT_COUNT} esta semana`}
          detail={`+${WEEKLY_MISSION_BONUS_XP} XP al llegar a ${WEEKLY_BONUS_TARGET}, y este pack de cartas.`}
          progressLabel={`${weeklyCompleted}/${WEEKLY_BONUS_TARGET}`}
          ready={weeklyCompleted >= WEEKLY_BONUS_TARGET}
          claimed={hasGrantedKey(grantedItemKeys, seasonPackGrantKey('weekly_bonus', weekKey, monthKey))}
          claiming={claiming === 'weekly_bonus'}
          weekKey={weekKey}
          monthKey={monthKey}
          onClaim={onClaim}
        />
        <PackRow
          kind="weekly_clear"
          title={`Las ${WEEKLY_MISSION_SLOT_COUNT} de la semana`}
          detail="Pack extra más útil si cierras el tablero semanal."
          progressLabel={`${weeklyCompleted}/${WEEKLY_MISSION_SLOT_COUNT}`}
          ready={weeklyCompleted >= WEEKLY_MISSION_SLOT_COUNT}
          claimed={hasGrantedKey(grantedItemKeys, seasonPackGrantKey('weekly_clear', weekKey, monthKey))}
          claiming={claiming === 'weekly_clear'}
          weekKey={weekKey}
          monthKey={monthKey}
          onClaim={onClaim}
        />
        <PackRow
          kind="monthly_clear"
          title={`Las ${MONTHLY_MISSION_SLOT_COUNT} del mes`}
          detail="Pack del mes: cartas más fuertes."
          progressLabel={`${monthlyCompleted}/${MONTHLY_MISSION_SLOT_COUNT}`}
          ready={monthlyCompleted >= MONTHLY_MISSION_SLOT_COUNT}
          claimed={hasGrantedKey(grantedItemKeys, seasonPackGrantKey('monthly_clear', weekKey, monthKey))}
          claiming={claiming === 'monthly_clear'}
          weekKey={weekKey}
          monthKey={monthKey}
          onClaim={onClaim}
        />

        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="button" className={styles.close} onClick={onClose}>
          Cerrar
        </button>
      </section>
    </div>
  )
}

export default SeasonPackModal
