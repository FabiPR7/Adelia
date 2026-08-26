import PromotionPhotoCollage from './PromotionPhotoCollage'
import type { LadderRestaurantGroup } from './PromotionLadderMapModal'
import {
  formatLadderCompletionsLabel,
  getActiveLadderPromotionSummary,
  getCompanyLadderCompletions,
  getLadderNodeStatus,
} from '../../utils/promotionLadderStatus'
import { sortCompanyLadderPromotions, type CompanyLadderRuntime } from '../../utils/promotionReservationProgress'
import type { ClaimedPromotionRecord } from '../../types/gamification'
import { formatDistanceKm } from '../../utils/geo'
import styles from './LadderRestaurantPromoCard.module.css'

interface LadderRestaurantPromoCardProps {
  group: LadderRestaurantGroup
  variant?: 'compact' | 'full'
  confirmedCounts: Record<string, number>
  pendingCounts: Record<string, number>
  ladderRuntime: CompanyLadderRuntime
  claimedPromotions: ClaimedPromotionRecord[]
  onOpenMap: (group: LadderRestaurantGroup) => void
  onUseToken?: (group: LadderRestaurantGroup) => void
}

function milestoneDotClass(
  status: ReturnType<typeof getLadderNodeStatus>,
): string {
  if (status === 'claimed') {
    return styles.ladderDotDone
  }

  if (status === 'claimable') {
    return styles.ladderDotClaimable
  }

  if (status === 'awaiting' || status === 'in_progress' || status === 'active') {
    return styles.ladderDotActive
  }

  return styles.ladderDot
}

export default function LadderRestaurantPromoCard({
  group,
  variant = 'full',
  confirmedCounts,
  pendingCounts,
  ladderRuntime,
  claimedPromotions,
  onOpenMap,
  onUseToken,
}: LadderRestaurantPromoCardProps) {
  const sortedLadder = sortCompanyLadderPromotions(group.ladderPromotions)
  const summary = getActiveLadderPromotionSummary(
    sortedLadder,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    claimedPromotions,
  )
  const completions = getCompanyLadderCompletions(
    group.companyId,
    ladderRuntime.ladderCompletionsByCompany,
    claimedPromotions,
    sortedLadder.length,
  )
  const completionsLabel = formatLadderCompletionsLabel(completions)
  const coverPromotion = summary?.promotion ?? sortedLadder[0]
  const productRefs = coverPromotion.productRefs ?? []
  const hasVisual = productRefs.some((ref) => ref.photoUrl.trim())
    || Boolean(coverPromotion.photoUrl?.trim())
    || Boolean(group.companyPhotoUrl.trim())
  const rewardCount = sortedLadder.length
  const percent = summary && summary.required > 0
    ? Math.min(100, Math.round((summary.current / summary.required) * 100))
    : 0

  const tagLabel = summary?.status === 'claimable'
    ? '¡Reclamar!'
    : summary?.status === 'awaiting'
      ? 'A medias'
      : summary?.status === 'in_progress' || summary?.status === 'active'
        ? 'En curso'
        : null

  return (
    <article className={variant === 'compact' ? styles.ladderCardCompact : styles.ladderCard}>
      <button
        type="button"
        className={styles.ladderButton}
        onClick={() => onOpenMap(group)}
        aria-label={`Abrir mapa de premios de ${group.companyName}`}
      >
        <div className={styles.ladderVisual}>
          {hasVisual ? (
            <PromotionPhotoCollage
              productRefs={productRefs}
              fallbackPhotoUrl={coverPromotion.photoUrl || group.companyPhotoUrl}
              size="card"
              className={styles.ladderVisualCollage}
              alt={group.companyName}
            />
          ) : (
            <div className={styles.ladderFallback} aria-hidden="true">🗺️</div>
          )}
          <div className={styles.ladderOverlay} aria-hidden="true" />
          <div className={styles.ladderTopBar}>
            <div className={styles.ladderTopLeft}>
              {completionsLabel ? (
                <span
                  className={styles.ladderCompletions}
                  aria-label={completionsLabel}
                  title={completionsLabel}
                >
                  {variant === 'compact' ? `×${completions}` : completionsLabel}
                </span>
              ) : (
                <span className={styles.ladderBadge}>
                  {rewardCount} recompensa{rewardCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {tagLabel ? (
              <span className={`${styles.ladderTag} ${summary?.status === 'claimable' ? styles.ladderTagClaimable : ''}`}>
                {tagLabel}
              </span>
            ) : null}
          </div>
          <h3 className={styles.ladderTitle}>Cada reserva o consumo gana premios</h3>
        </div>

        <div className={styles.ladderBody}>
          <p className={styles.ladderRestaurant}>{group.companyName}</p>
          {summary ? (
            <>
              <p className={styles.ladderCopy}>
                {summary.status === 'claimable' ? (
                  <>Ya puedes reclamar <strong>{summary.promotion.title}</strong></>
                ) : summary.status === 'awaiting' ? (
                  <>Cuando el restaurante confirme tu reserva o consumo contará para el premio</>
                ) : (
                  <>
                    Te {summary.required - summary.current === 1 ? 'falta' : 'faltan'}{' '}
                    <strong>{Math.max(0, summary.required - summary.current)}</strong> para{' '}
                    <strong>{summary.promotion.title}</strong>
                  </>
                )}
              </p>
              <div className={styles.ladderProgressBar} aria-hidden="true">
                <span style={{ width: `${Math.max(percent, 8)}%` }} />
              </div>
              <p className={styles.ladderProgressCopy}>{summary.current}/{summary.required}</p>
            </>
          ) : (
            <p className={styles.ladderCopy}>
              Cada visita suma. Reserva o consume y desbloquea <strong>{rewardCount}</strong> recompensa{rewardCount === 1 ? '' : 's'} en este local.
            </p>
          )}

          <div className={styles.ladderMeta}>
            <div className={styles.ladderMilestones} aria-hidden="true">
              {sortedLadder.map((promotion) => {
                const status = getLadderNodeStatus(
                  promotion,
                  sortedLadder,
                  claimedPromotions,
                  ladderRuntime,
                  confirmedCounts,
                  pendingCounts,
                )

                return (
                  <span
                    key={promotion.id}
                    className={`${styles.ladderDot} ${milestoneDotClass(status)}`}
                  />
                )
              })}
            </div>
            <span className={styles.ladderArrow} aria-hidden="true">→</span>
          </div>

          {group.distanceKm != null && variant === 'full' ? (
            <span className={styles.ladderDistance}>{formatDistanceKm(group.distanceKm)}</span>
          ) : null}
        </div>
      </button>
      {onUseToken ? (
        <button
          type="button"
          className={styles.useTokenButton}
          onClick={() => onUseToken(group)}
        >
          Usar carta
        </button>
      ) : null}
    </article>
  )
}
