import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed } from 'lucide-react'
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
  pickLadderMapTheme,
  type LadderMapTheme,
} from '../../utils/promotionLadderMapThemes'
import {
  getCompanyLadderCompletions,
  getLadderNodeStatus,
  type LadderNodeStatus,
} from '../../utils/promotionLadderStatus'
import {
  getLadderProgress,
  resolveActiveLadderPromotionId,
  sortCompanyLadderPromotions,
  type CompanyLadderRuntime,
} from '../../utils/promotionReservationProgress'
import { buildPromotionBookingHref } from '../../utils/promotionBooking'
import { resolvePromotionHighlight } from '../../utils/promotionOffer'
import { promoVisitCompletePath } from '../../data/companyReservationMode'
import { isWithinPromotionHours } from '../../utils/promotionAvailability'
import PromotionLadderMapThemeArt, { LadderMapCompassRose } from './PromotionLadderMapThemeArt'
import PromoVisitCompleteModal from './PromoVisitCompleteModal'
import { getPromotionHeroUrl } from './promoAppDisplay'
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
  /** Al tocar un premio del mapa: abre su ficha. */
  onOpenPromotion?: (promotion: PublicPromotion) => void
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

function isFocusStatus(status: LadderNodeStatus): boolean {
  return status === 'awaiting' || status === 'in_progress' || status === 'active' || status === 'claimable'
}

function waypointPinClass(status: LadderNodeStatus): string {
  if (status === 'claimed') {
    return styles.waypointClaimed
  }

  if (status === 'claimable') {
    return styles.waypointClaimable
  }

  if (isFocusStatus(status)) {
    return styles.waypointActive
  }

  return ''
}

function nodeCardClass(status: LadderNodeStatus, index: number): string {
  const tilt = index % 2 === 0 ? styles.nodeTiltLeft : styles.nodeTiltRight
  if (status === 'claimed') return `${styles.nodeCard} ${styles.nodeClaimed} ${tilt}`
  if (status === 'claimable') return `${styles.nodeCard} ${styles.nodeClaimable} ${tilt}`
  if (isFocusStatus(status)) return `${styles.nodeCard} ${styles.nodeFocus} ${tilt}`
  if (status === 'locked') return `${styles.nodeCard} ${styles.nodeLocked} ${tilt}`
  return `${styles.nodeCard} ${tilt}`
}

function MapNodeCard({
  promotion,
  index,
  status,
  current,
  required,
  onPress,
}: {
  promotion: PublicPromotion
  index: number
  status: LadderNodeStatus
  current: number
  required: number
  onPress: () => void
}) {
  const hero = getPromotionHeroUrl(promotion, 'photoThumb')
  const isClaimed = status === 'claimed'
  const highlight = resolvePromotionHighlight(promotion, index)
  const progressLabel = required > 0 ? `${current}/${required}` : `${promotion.requiredReservations ?? 0}`

  return (
    <button
      type="button"
      className={nodeCardClass(status, index)}
      onClick={onPress}
      aria-label={`${promotion.title}. ${isClaimed ? 'Reclamado' : `${progressLabel} visitas`}`}
    >
      <span className={styles.nodeMedia}>
        {hero ? <img src={hero} alt="" loading="lazy" /> : <span className={styles.nodeFallback}>%</span>}
        {highlight && !isClaimed && !isFocusStatus(status) ? (
          <span className={styles.nodeBadge}>{highlight}</span>
        ) : null}
      </span>
      <span className={styles.nodeTitle}>{promotion.title}</span>
      <span className={styles.nodeVisits}>
        <UtensilsCrossed size={12} strokeWidth={2.2} aria-hidden="true" />
        {isClaimed ? 'Hecho' : progressLabel}
      </span>
      {isClaimed ? <span className={styles.nodeStamp}>✓ Reclamado</span> : null}
    </button>
  )
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
  onOpenPromotion,
}: PromotionLadderMapModalProps) {
  const navigate = useNavigate()
  const [visitOpen, setVisitOpen] = useState(false)
  const [menuNodes, setMenuNodes] = useState<MenuNode[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (group) {
      setVisitOpen(false)
    }
  }, [group?.companyId])

  // Panel a pantalla completa: sin scroll de fondo, foco en "volver" y Esc para cerrar.
  useEffect(() => {
    if (!group) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !visitOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [group, onClose, visitOpen])

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
  const mapPercentY = (y: number) => toMapPercentY(y, sortedLadder.length)
  const completions = getCompanyLadderCompletions(
    group.companyId,
    ladderRuntime.ladderCompletionsByCompany,
    claimedPromotions,
    sortedLadder.length,
  )
  const theme: LadderMapTheme = pickLadderMapTheme(`${group.companyId}:${completions}`)
  const themeStyle = theme.cssVars as CSSProperties
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

  const nodeStatus = (promotion: PublicPromotion) =>
    getLadderNodeStatus(
      promotion,
      sortedLadder,
      claimedPromotions,
      ladderRuntime,
      confirmedCounts,
      pendingCounts,
    )
  const nodeProgress = (promotion: PublicPromotion) =>
    getLadderProgress(promotion, confirmedCounts, ladderRuntime.ladderBaselinesByCompany)

  const activeStatus = activePromotion ? nodeStatus(activePromotion) : 'locked'
  const activeProgress = activePromotion ? nodeProgress(activePromotion) : null
  const activeClaimLimit = activePromotion?.maxClaimsPerCustomer ?? null
  const claimLimitReached = Boolean(
    activePromotion
    && activeClaimLimit != null
    && activeClaimLimit > 0
    && claimedPromotions.filter((claim) => claim.promotionId === activePromotion.id).length >= activeClaimLimit,
  )
  const claimWindowClosed = Boolean(
    activePromotion?.claimWindowEnabled
    && isWithinPromotionHours(activePromotion, new Date()) === false,
  )
  const canClaim = activeStatus === 'claimable' && !claimLimitReached && !claimWindowClosed
  const progressLabel = activeProgress && activeProgress.required > 0
    ? `${activeProgress.current}/${activeProgress.required}`
    : null

  const goReserve = () => {
    navigate(bookingHref)
    onClose()
  }

  const goRestaurant = () => {
    navigate(restaurantHref)
    onClose()
  }

  const handleVisit = () => {
    if (visitPath === 'reserve') {
      goReserve()
      return
    }
    setVisitOpen(true)
  }

  const handlePressStep = (promotion: PublicPromotion, status: LadderNodeStatus) => {
    if (status === 'claimable' && !(promotion.id === activePromotion?.id && (claimLimitReached || claimWindowClosed))) {
      onClaim(promotion)
      return
    }
    onOpenPromotion?.(promotion)
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
        <div className={styles.floatingBar}>
          <button
            ref={closeRef}
            type="button"
            className={styles.backChip}
            onClick={onClose}
            aria-label="Volver"
          >
            ←
          </button>
          <div className={styles.topMeta}>
            <p className={styles.topTitle}>{group.companyName}</p>
            <p className={styles.topSub}>
              {progressLabel ? `Vas a por el premio · ${progressLabel} consumos` : 'Mapa de premios'}
            </p>
          </div>
          <button
            type="button"
            className={styles.viewRestaurant}
            onClick={goRestaurant}
            aria-label={`Ver la ficha de ${group.companyName}`}
          >
            <svg className={styles.viewRestaurantIcon} viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 17V8.2L10 3.5l6 4.7V17H12V12H8v5H4Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className={styles.mapScroll}>
          <div className={styles.treasureMap}>
            <PromotionLadderMapThemeArt themeId={theme.id} />

            <div className={styles.overlayHud}>
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

                const status = nodeStatus(promotion)
                const { current, required } = nodeProgress(promotion)

                return (
                  <div
                    key={promotion.id}
                    className={`${styles.mapNode} ${isFocusStatus(status) ? styles.mapNodeFocus : ''}`}
                    style={{ left: `${position.x}%`, top: `${mapPercentY(position.y)}%` }}
                  >
                    <span className={`${styles.waypointPin} ${waypointPinClass(status)}`}>
                      {index + 1}
                    </span>
                    <MapNodeCard
                      promotion={promotion}
                      index={index}
                      status={status}
                      current={current}
                      required={required}
                      onPress={() => handlePressStep(promotion, status)}
                    />
                  </div>
                )
              })}

              <p className={styles.scaleBar}>1 visita = 1 sello en el mapa</p>
            </div>
          </div>
        </div>

        <div className={styles.dock}>
          {activePromotion ? (
            <div className={styles.dockMeta}>
              <p className={styles.dockHint}>{activePromotion.title}</p>
              {claimLimitReached ? (
                <p className={styles.dockProgress}>
                  🔒 Ya has reclamado este premio {activeClaimLimit === 1 ? 'la única vez permitida' : `las ${activeClaimLimit} veces permitidas`}
                </p>
              ) : claimWindowClosed && activePromotion ? (
                <p className={styles.dockProgress}>
                  🔒 Este premio se canjea de {activePromotion.activeFromTime} a {activePromotion.activeToTime}
                  {progressLabel ? ` · ${progressLabel}` : ''}
                </p>
              ) : progressLabel ? (
                <p className={styles.dockProgress}>
                  {canClaim ? `Listo para reclamar · ${progressLabel}` : `Progreso · ${progressLabel}`}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className={styles.dockRow}>
            <button type="button" className={styles.dockPrimary} onClick={handleVisit}>
              {visitPath === 'reserve' ? 'Reservar' : 'Registrar consumo'}
            </button>
            <button
              type="button"
              className={canClaim ? styles.dockClaimReady : styles.dockClaim}
              onClick={() => activePromotion && onClaim(activePromotion)}
              disabled={!canClaim}
              title={canClaim ? undefined : 'Completa las visitas para reclamar el premio'}
            >
              Reclamar
            </button>
          </div>
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
