import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { PublicPromotion } from '../../services/publicPromotions'
import type { ClaimedPromotionRecord } from '../../types/gamification'
import {
  buildLadderMapDecorations,
  buildLadderMapNodePositions,
  buildLadderMapPath,
  getLadderMapCanvasHeight,
  getLadderMapViewBoxHeight,
  toMapPercentY,
} from '../../utils/promotionLadderMapLayout'
import {
  pickRandomLadderMapTheme,
  type LadderMapTheme,
} from '../../utils/promotionLadderMapThemes'
import { getCompanyLadderCompletions, getLadderNodeStatus } from '../../utils/promotionLadderStatus'
import {
  getLadderProgress,
  resolveActiveLadderPromotionId,
  sortCompanyLadderPromotions,
  type CompanyLadderRuntime,
} from '../../utils/promotionReservationProgress'
import { buildPromotionBookingHref } from '../../utils/promotionBooking'
import PromotionLadderMapThemeArt from './PromotionLadderMapThemeArt'
import PromotionOfferCard from './PromotionOfferCard'
import styles from './PromotionLadderMapModal.module.css'

export interface LadderRestaurantGroup {
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  distanceKm: number | null
  ladderPromotions: PublicPromotion[]
}

interface PromotionLadderMapModalProps {
  group: LadderRestaurantGroup | null
  confirmedCounts: Record<string, number>
  pendingCounts: Record<string, number>
  ladderRuntime: CompanyLadderRuntime
  claimedPromotions: ClaimedPromotionRecord[]
  onClose: () => void
  onClaim: (promotion: PublicPromotion) => void
}

export default function PromotionLadderMapModal({
  group,
  confirmedCounts,
  pendingCounts,
  ladderRuntime,
  claimedPromotions,
  onClose,
  onClaim,
}: PromotionLadderMapModalProps) {
  const [theme, setTheme] = useState<LadderMapTheme>(() => pickRandomLadderMapTheme())

  useEffect(() => {
    if (group) {
      setTheme(pickRandomLadderMapTheme())
    }
  }, [group?.companyId])

  if (!group) {
    return null
  }

  const sortedLadder = sortCompanyLadderPromotions(group.ladderPromotions)
  const positions = buildLadderMapNodePositions(sortedLadder.length)
  const path = buildLadderMapPath(positions)
  const decorations = buildLadderMapDecorations(sortedLadder.length)
  const canvasHeight = getLadderMapCanvasHeight(sortedLadder.length)
  const viewBoxHeight = getLadderMapViewBoxHeight(sortedLadder.length)
  const themeStyle = theme.cssVars as CSSProperties
  const mapPercentY = (y: number) => toMapPercentY(y, sortedLadder.length)
  const completions = getCompanyLadderCompletions(
    group.companyId,
    ladderRuntime.ladderCompletionsByCompany,
    claimedPromotions,
    sortedLadder.length,
  )
  const activePromotionId =
    resolveActiveLadderPromotionId(
      group.companyId,
      sortedLadder,
      ladderRuntime.activeLadderPromotionByCompany,
    ) ?? sortedLadder[0]?.id
  const bookingHref = activePromotionId
    ? buildPromotionBookingHref(group.companySlug, activePromotionId, { fromPromotions: true })
    : `/reservar/${encodeURIComponent(group.companySlug)}?reservar=1`

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Mapa de premios de ${group.companyName}`}
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div className={styles.mapScroll}>
          <div className={styles.treasureMap} style={themeStyle}>
            {completions > 0 ? (
              <div
                className={styles.lapCounter}
                aria-label={`Mapa completado ${completions} ${completions === 1 ? 'vez' : 'veces'}`}
              >
                <span className={styles.lapCounterIcon} aria-hidden="true">🏆</span>
                <span className={styles.lapCounterText}>
                  <strong>{completions}</strong>
                  {completions === 1 ? ' vuelta completada' : ' vueltas completadas'}
                </span>
              </div>
            ) : null}

            <PromotionLadderMapThemeArt themeId={theme.id} />

            <div className={styles.mapCanvas} style={{ minHeight: `${canvasHeight}px` }}>
              {path ? (
                <svg
                  className={styles.mapPath}
                  viewBox={`0 0 100 ${viewBoxHeight}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d={path} className={styles.mapPathGlow} />
                  <path d={path} className={styles.mapPathLine} />
                </svg>
              ) : null}

              {theme.stickers.map((sticker) => (
                <span
                  key={`${sticker.emoji}-${sticker.x}-${sticker.y}`}
                  className={styles.mapSticker}
                  style={{ left: `${sticker.x}%`, top: `${sticker.y}%` }}
                  aria-hidden="true"
                >
                  {sticker.emoji}
                </span>
              ))}

              <span
                className={`${styles.mapDecoration} ${styles.compass}`}
                style={{ left: `${decorations.compass.x}%`, top: `${mapPercentY(decorations.compass.y)}%` }}
                aria-hidden="true"
              >
                {theme.compassEmoji}
              </span>

              {sortedLadder.length > 1 ? (
                <span
                  className={styles.mapDecoration}
                  style={{ left: `${decorations.finish.x}%`, top: `${mapPercentY(decorations.finish.y)}%` }}
                  aria-hidden="true"
                >
                  {theme.finishEmoji}
                </span>
              ) : null}

              {sortedLadder.map((promotion, index) => {
                const position = positions[index]
                if (!position) {
                  return null
                }

                const status = getLadderNodeStatus(
                  promotion,
                  sortedLadder,
                  claimedPromotions,
                  ladderRuntime,
                  confirmedCounts,
                  pendingCounts,
                )
                const { current, required } = getLadderProgress(
                  promotion,
                  confirmedCounts,
                  ladderRuntime.ladderBaselinesByCompany,
                )

                return (
                  <div
                    key={promotion.id}
                    className={styles.mapNode}
                    style={{ left: `${position.x}%`, top: `${mapPercentY(position.y)}%` }}
                  >
                    <div className={styles.mapNodeCard}>
                      <PromotionOfferCard
                        promotion={promotion}
                        index={index}
                        mapMode
                        ladderStatus={status}
                        progress={required > 0 ? { current, required } : undefined}
                        onClaim={() => onClaim(promotion)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className={styles.completeFabWrap}>
          <Link
            to={bookingHref}
            className={styles.completeFab}
            onClick={onClose}
          >
            Completar
          </Link>
        </div>
      </div>
    </div>
  )
}
