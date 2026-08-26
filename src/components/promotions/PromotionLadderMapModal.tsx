import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PublicPromotion } from '../../services/publicPromotions'
import type { ClaimedPromotionRecord } from '../../types/gamification'
import type { MenuNode } from '../../types/company'
import type { RegisterConsumptionInput } from '../../services/firestore'
import { getPublicCompanyMenuNodes } from '../../services/companyMenu'
import {
  buildLadderMapDecorations,
  buildLadderMapNodePositions,
  buildLadderMapPath,
  buildLadderMapTrailMarks,
  getLadderMapCanvasHeight,
  getLadderMapViewBoxHeight,
  toMapPercentY,
} from '../../utils/promotionLadderMapLayout'
import {
  LADDER_MAP_HOOK,
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
import { promoVisitCompletePath } from '../../data/companyReservationMode'
import PromotionLadderMapThemeArt, { LadderMapCompassRose } from './PromotionLadderMapThemeArt'
import PromotionOfferCard from './PromotionOfferCard'
import PromoVisitCompleteModal from './PromoVisitCompleteModal'
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
  onRegisterConsumption: (
    companyId: string,
    payload: RegisterConsumptionInput,
    promotionId: string,
  ) => Promise<void>
}

function completeHintForPath(path: ReturnType<typeof promoVisitCompletePath>): string {
  if (path === 'reserve') {
    return 'Reserva y avanza en el mapa'
  }

  if (path === 'consume') {
    return 'Consume y avanza en el mapa'
  }

  return 'Reserva o consume y gana premios'
}

function MapTreasureTrail({
  path,
  viewBoxHeight,
}: {
  path: string
  viewBoxHeight: number
}) {
  const trailRef = useRef<SVGPathElement>(null)
  const [trailLength, setTrailLength] = useState(0)
  const [trailReady, setTrailReady] = useState(false)

  useLayoutEffect(() => {
    const node = trailRef.current
    if (!node || !path) {
      setTrailLength(0)
      setTrailReady(false)
      return
    }

    setTrailLength(node.getTotalLength())
    setTrailReady(true)
  }, [path])

  if (!path) {
    return null
  }

  return (
    <svg
      className={styles.mapPath}
      viewBox={`0 0 100 ${viewBoxHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} className={styles.mapPathGlow} />
      <path
        ref={trailRef}
        d={path}
        className={`${styles.mapPathDraw} ${trailReady ? styles.mapPathDrawReady : ''}`}
        style={
          trailLength > 0
            ? {
                strokeDasharray: trailLength,
                strokeDashoffset: trailLength,
              }
            : undefined
        }
      />
      <path d={path} className={styles.mapPathLine} />
    </svg>
  )
}

function waypointPinClass(status: ReturnType<typeof getLadderNodeStatus>): string {
  if (status === 'claimed') {
    return styles.waypointClaimed
  }

  if (status === 'claimable') {
    return styles.waypointClaimable
  }

  if (status === 'awaiting' || status === 'in_progress' || status === 'active') {
    return styles.waypointActive
  }

  return ''
}

export default function PromotionLadderMapModal({
  group,
  confirmedCounts,
  pendingCounts,
  ladderRuntime,
  claimedPromotions,
  onClose,
  onClaim,
  onRegisterConsumption,
}: PromotionLadderMapModalProps) {
  const navigate = useNavigate()
  const [theme, setTheme] = useState<LadderMapTheme>(() => pickRandomLadderMapTheme())
  const [visitOpen, setVisitOpen] = useState(false)
  const [menuNodes, setMenuNodes] = useState<MenuNode[]>([])
  const [menuLoading, setMenuLoading] = useState(false)

  useEffect(() => {
    if (group) {
      setTheme(pickRandomLadderMapTheme())
      setVisitOpen(false)
    }
  }, [group?.companyId])

  useEffect(() => {
    if (!visitOpen || !group) {
      return
    }

    let cancelled = false
    setMenuLoading(true)

    void getPublicCompanyMenuNodes(group.companyId)
      .then((nodes) => {
        if (!cancelled) {
          setMenuNodes(nodes)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMenuNodes([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMenuLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [group?.companyId, visitOpen])

  if (!group) {
    return null
  }

  const sortedLadder = sortCompanyLadderPromotions(group.ladderPromotions)
  const positions = buildLadderMapNodePositions(sortedLadder.length)
  const path = buildLadderMapPath(positions)
  const trailMarks = buildLadderMapTrailMarks(positions)
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
  const restaurantHref = `/reservar/${encodeURIComponent(group.companySlug)}`
  const visitPath = promoVisitCompletePath(sortedLadder[0]?.reservationMode)
  const activePromotion = sortedLadder.find((promotion) => promotion.id === activePromotionId)
    ?? sortedLadder[0]
    ?? null

  const goReserve = () => {
    navigate(bookingHref)
    onClose()
  }

  const goRestaurant = () => {
    navigate(restaurantHref)
    onClose()
  }

  const handleCompletar = () => {
    if (visitPath === 'reserve') {
      goReserve()
      return
    }
    setVisitOpen(true)
  }

  return (
    <>
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        style={themeStyle}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Mapa de premios de ${group.companyName}`}
      >
        <div className={styles.leatherCorners} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className={styles.mapScroll}>
          <div className={styles.mapHud}>
            <div className={styles.mapHudTop}>
              <button
                type="button"
                className={styles.viewRestaurant}
                onClick={goRestaurant}
                title={group.companyName}
              >
                <svg className={styles.viewRestaurantIcon} viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M4 17V8.2L10 3.5l6 4.7V17H12V12H8v5H4Z"
                    fill="currentColor"
                  />
                </svg>
                Ver restaurante
              </button>
              <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className={styles.mapHudBanner}>
              <p className={styles.hookEyebrow}>{theme.eyebrow}</p>
              <p className={styles.hookTitle}>{LADDER_MAP_HOOK}</p>
              <div className={styles.mapHudMeta}>
                <span className={styles.themeBadge}>{theme.label}</span>
                {completions > 0 ? (
                  <span
                    className={styles.lapSeal}
                    aria-label={`Mapa completado ${completions} ${completions === 1 ? 'vez' : 'veces'}`}
                  >
                    <span aria-hidden="true">🏆</span>
                    {completions === 1 ? '1 vuelta' : `${completions} vueltas`}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.treasureMap}>
            <PromotionLadderMapThemeArt themeId={theme.id} />

            <div className={styles.mapCanvas} style={{ minHeight: `${canvasHeight}px` }}>
              <MapTreasureTrail path={path} viewBoxHeight={viewBoxHeight} />

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
                <LadderMapCompassRose />
              </span>

              {sortedLadder.length > 0 ? (
                <span
                  className={styles.trailFlag}
                  style={{ left: `${decorations.start.x}%`, top: `${mapPercentY(decorations.start.y)}%` }}
                >
                  Inicio
                </span>
              ) : null}

              {sortedLadder.length > 1 ? (
                <span
                  className={`${styles.trailFlag} ${styles.trailFlagFinish}`}
                  style={{ left: `${decorations.finish.x}%`, top: `${mapPercentY(decorations.finish.y)}%` }}
                >
                  <span aria-hidden="true">{theme.finishEmoji}</span>
                  Tesoro
                </span>
              ) : null}

              {trailMarks.map((mark, index) => (
                <span
                  key={`mark-${mark.x}-${mark.y}-${index}`}
                  className={styles.trailMark}
                  style={{ left: `${mark.x}%`, top: `${mapPercentY(mark.y)}%` }}
                  aria-hidden="true"
                >
                  ×
                </span>
              ))}

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
                    <span className={`${styles.waypointPin} ${waypointPinClass(status)}`}>
                      {index + 1}
                    </span>
                    <div
                      className={`${styles.mapNodeCard} ${index % 2 === 0 ? styles.mapNodeCardTiltLeft : styles.mapNodeCardTiltRight}`}
                    >
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

              <p className={styles.scaleBar}>1 visita = 1 sello en el mapa</p>
            </div>
          </div>
        </div>

        <div className={styles.completeFabWrap}>
          <p className={styles.completeFabHint}>{completeHintForPath(visitPath)}</p>
          <button
            type="button"
            className={styles.completeFab}
            onClick={handleCompletar}
          >
            Completar
          </button>
        </div>
      </div>
    </div>

      <PromoVisitCompleteModal
        open={visitOpen}
        companyName={group.companyName}
        path={visitPath}
        promotion={activePromotion}
        menuNodes={menuNodes}
        menuLoading={menuLoading}
        onClose={() => setVisitOpen(false)}
        onReserve={goReserve}
        onRegisterConsumption={async (payload) => {
          await onRegisterConsumption(
            group.companyId,
            payload,
            activePromotionId ?? sortedLadder[0]?.id ?? '',
          )
        }}
      />
    </>
  )
}
