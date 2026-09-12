import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion'
import type { PublicPromotion } from '../../services/publicPromotions'
import { PROMOTION_TYPE_LABELS } from '../../types/company'
import {
  formatReservationOrConsumptionCount,
  resolvePromotionMinimumSpend,
} from '../../utils/promotionOffer'
import { formatDistanceKm, haversineDistanceKm } from '../../utils/geo'
import PromotionPhotoCollage from './PromotionPhotoCollage'
import { IconBookmark, IconCalendar, IconChevronLeft, IconClose } from './PromoIcons'
import styles from './PromotionSwipeDeck.module.css'

interface PromotionSwipeDeckProps {
  promotions: PublicPromotion[]
  coords: { lat: number; lng: number } | null
  savedIds: Set<string>
  promoLocked: boolean
  onToggleSave: (promotion: PublicPromotion) => void
  onReserve: (promotion: PublicPromotion) => void
  onRestart: () => void
}

interface SwipeCardHandle {
  fling: (dir: 'left' | 'right') => void
}

function typeLabel(type: string): string {
  return PROMOTION_TYPE_LABELS[type as keyof typeof PROMOTION_TYPE_LABELS] ?? type
}

interface PromoDetail {
  key: string
  label: string
  info: string
  strong?: boolean
}

/** Cada "detalle" de la promo con su explicación al pulsarlo. Sin duplicados. */
function buildPromoDetails(
  promotion: PublicPromotion,
  distanceKm: number | null,
): PromoDetail[] {
  const details: PromoDetail[] = []
  const visits = promotion.requiredReservations

  if (visits && visits > 0) {
    details.push({
      key: 'visits',
      label: formatReservationOrConsumptionCount(visits),
      info: `Para conseguir esta promoción tienes que acudir ${visits} ${
        visits === 1 ? 'vez' : 'veces'
      } al restaurante, ya sea reservando mesa o con un consumo verificado en el local. Cada visita válida suma una.`,
    })
  }

  const spend = resolvePromotionMinimumSpend(promotion)
  if (spend) {
    const amount = spend.replace(/^Gasto mínimo:\s*/, '')
    details.push({
      key: 'spend',
      label: `Mín. ${amount}`,
      strong: true,
      info: `Cada reserva o consumo que hagas para esta promoción tiene que ser de al menos ${amount} para que cuente.`,
    })
  }

  if (
    (promotion.type === 'time_limited' || promotion.type === 'attendance') &&
    promotion.activeFromTime?.trim() &&
    promotion.activeToTime?.trim()
  ) {
    const from = promotion.activeFromTime.trim()
    const to = promotion.activeToTime.trim()
    details.push({
      key: 'window',
      label: `${from}–${to}`,
      info:
        promotion.type === 'attendance'
          ? `Asistencia puntual: solo es válida entre las ${from} y las ${to}. Al llegar al local tienes ${
              promotion.arrivalWindowMinutes ?? 30
            } minutos para confirmar tu asistencia o pierdes la promo.`
          : `Esta promoción solo está activa entre las ${from} y las ${to}. Reserva una hora dentro de esa franja.`,
    })
  }

  if (promotion.maxRedemptions != null) {
    const left = Math.max(
      0,
      promotion.maxRedemptions - (promotion.currentRedemptions ?? 0),
    )
    details.push({
      key: 'spots',
      label: left > 0 ? `${left} ${left === 1 ? 'cupo' : 'cupos'}` : 'Sin cupos',
      info:
        left > 0
          ? `Quedan ${left} de ${promotion.maxRedemptions} canjes. Cuando se agoten, la promoción deja de estar disponible.`
          : `Se han agotado los ${promotion.maxRedemptions} canjes de esta promoción.`,
    })
  }

  if (distanceKm != null) {
    details.push({
      key: 'distance',
      label: formatDistanceKm(distanceKm),
      info: `El restaurante está a unos ${formatDistanceKm(
        distanceKm,
      )} de tu ubicación actual.`,
    })
  }

  if (details.length === 0) {
    details.push({
      key: 'type',
      label: typeLabel(promotion.type),
      info: 'Consulta las condiciones completas en la página del restaurante.',
    })
  }

  return details
}

function PromoCover({
  promotion,
  imageWidth = 1080,
}: {
  promotion: PublicPromotion
  imageWidth?: number
}) {
  const productRefs = promotion.productRefs ?? []
  const hasVisual =
    productRefs.some((ref) => ref.photoUrl.trim()) ||
    Boolean(promotion.photoUrl?.trim()) ||
    Boolean(promotion.companyPhotoUrl?.trim())

  if (!hasVisual) {
    return <div className={styles.coverFallback} aria-hidden="true" />
  }

  return (
    <PromotionPhotoCollage
      productRefs={productRefs}
      fallbackPhotoUrl={promotion.photoUrl || promotion.companyPhotoUrl}
      size="card"
      imageWidth={imageWidth}
      className={styles.coverMedia}
      alt={promotion.title}
    />
  )
}

function PromoOverlay({
  promotion,
  details,
  onOpenDetail,
}: {
  promotion: PublicPromotion
  details: PromoDetail[]
  onOpenDetail: (detail: PromoDetail) => void
}) {
  return (
    <div className={styles.overlay}>
      <p className={styles.restaurant}>{promotion.companyName}</p>
      <h3 className={styles.title}>{promotion.title}</h3>
      {promotion.description?.trim() ? (
        <p className={styles.description}>{promotion.description}</p>
      ) : null}
      <div className={styles.chips}>
        {details.map((detail) => (
          <button
            key={detail.key}
            type="button"
            className={`${styles.chip} ${detail.strong ? styles.chipStrong : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onOpenDetail(detail)
            }}
          >
            {detail.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const SwipeCard = forwardRef<
  SwipeCardHandle,
  {
    promotion: PublicPromotion
    distanceKm: number | null
    reduceMotion: boolean
    onSkip: () => void
    onToggleSave: () => void
    onDetailChange: (open: boolean) => void
  }
>(function SwipeCard(
  { promotion, distanceKm, reduceMotion, onSkip, onToggleSave, onDetailChange },
  ref,
) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-260, 260], [-16, 16])
  const nopeOpacity = useTransform(x, [-140, -40], [1, 0])
  const saveOpacity = useTransform(x, [40, 140], [0, 1])
  const busyRef = useRef(false)
  const [openDetail, setOpenDetail] = useState<PromoDetail | null>(null)
  const details = useMemo(
    () => buildPromoDetails(promotion, distanceKm),
    [promotion, distanceKm],
  )

  useEffect(() => {
    onDetailChange(openDetail !== null)
    return () => onDetailChange(false)
  }, [openDetail, onDetailChange])

  const fling = (dir: 'left' | 'right') => {
    // Derecha = guardar (marca y la tarjeta se queda). Izquierda = pasar (sale y avanza).
    if (dir === 'right') {
      onToggleSave()
      return
    }

    if (busyRef.current) {
      return
    }
    busyRef.current = true

    if (reduceMotion) {
      onSkip()
      return
    }

    animate(x, -480, {
      duration: 0.32,
      ease: [0.32, 0, 0.28, 1],
      onComplete: onSkip,
    })
  }

  useImperativeHandle(ref, () => ({ fling }))

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.x > 120 || info.velocity.x > 600) {
      fling('right')
    } else if (info.offset.x < -120 || info.velocity.x < -600) {
      fling('left')
    }
  }

  return (
    <motion.article
      className={styles.card}
      style={reduceMotion ? undefined : { x, rotate }}
      drag={reduceMotion || openDetail ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.75}
      onDragEnd={reduceMotion ? undefined : handleDragEnd}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.92, transition: { duration: 0.16 } }
      }
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <PromoCover promotion={promotion} />
      <div className={styles.scrimTop} aria-hidden="true" />
      <div className={styles.scrimBottom} aria-hidden="true" />

      {promotion.highlight?.trim() ? (
        <span className={styles.highlight}>{promotion.highlight}</span>
      ) : null}

      {!reduceMotion ? (
        <>
          <motion.span
            className={`${styles.stamp} ${styles.stampNope}`}
            style={{ opacity: nopeOpacity }}
            aria-hidden="true"
          >
            Pasar
          </motion.span>
          <motion.span
            className={`${styles.stamp} ${styles.stampSave}`}
            style={{ opacity: saveOpacity }}
            aria-hidden="true"
          >
            Guardar
          </motion.span>
        </>
      ) : null}

      <PromoOverlay
        promotion={promotion}
        details={details}
        onOpenDetail={setOpenDetail}
      />

      {openDetail ? (
        <div
          className={styles.detailLayer}
          onPointerDownCapture={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={styles.detailBackdrop}
            onClick={() => setOpenDetail(null)}
            aria-label="Cerrar detalle"
          />
          <div className={styles.detailSheet} role="dialog" aria-label={openDetail.label}>
            <button
              type="button"
              className={styles.detailClose}
              onClick={() => setOpenDetail(null)}
              aria-label="Cerrar"
            >
              <IconClose className={styles.detailCloseIcon} />
            </button>
            <p className={styles.detailHeading}>{openDetail.label}</p>
            <p className={styles.detailBody}>{openDetail.info}</p>
          </div>
        </div>
      ) : null}
    </motion.article>
  )
})

export default function PromotionSwipeDeck({
  promotions,
  coords,
  savedIds,
  promoLocked,
  onToggleSave,
  onReserve,
  onRestart,
}: PromotionSwipeDeckProps) {
  const reduceMotion = Boolean(useReducedMotion())
  const [index, setIndex] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const cardRef = useRef<SwipeCardHandle>(null)

  const distances = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const promotion of promotions) {
      if (
        coords &&
        promotion.companyLatitude != null &&
        promotion.companyLongitude != null
      ) {
        map.set(
          promotion.id,
          haversineDistanceKm(coords, {
            lat: promotion.companyLatitude,
            lng: promotion.companyLongitude,
          }),
        )
      } else {
        map.set(promotion.id, null)
      }
    }
    return map
  }, [promotions, coords])

  const current = promotions[index]
  const upcoming = promotions[index + 1]
  const total = promotions.length

  const advance = () => {
    setIndex((value) => value + 1)
  }

  const toggleSaveCurrent = () => {
    if (current) {
      onToggleSave(current)
    }
  }

  const skipCurrent = () => {
    if (cardRef.current) {
      cardRef.current.fling('left')
    } else {
      advance()
    }
  }

  const handleReserve = () => {
    if (current && !promoLocked) {
      onReserve(current)
    }
  }

  const handleBack = () => {
    setIndex((value) => Math.max(0, value - 1))
  }

  const handleRestart = () => {
    setIndex(0)
    onRestart()
  }

  if (total === 0) {
    return (
      <div className={styles.deck}>
        <div className={styles.done}>
          <p className={styles.doneTitle}>Nada por descubrir ahora mismo</p>
          <p className={styles.doneText}>Vuelve más tarde: las promos se renuevan a menudo.</p>
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className={styles.deck}>
        <div className={styles.done}>
          <p className={styles.doneTitle}>Has visto todas las promociones</p>
          <p className={styles.doneText}>¿Repasamos desde el principio?</p>
          <button type="button" className={styles.restartButton} onClick={handleRestart}>
            Volver a empezar
          </button>
        </div>
      </div>
    )
  }

  const isSaved = savedIds.has(current.id)

  return (
    <div className={styles.deck}>
      {promoLocked ? (
        <p className={styles.lockedNote}>
          Con las promociones bloqueadas no puedes reservar con promoción. Puedes
          seguir mirándolas y guardarlas.
        </p>
      ) : null}

      <div className={styles.stage}>
        {upcoming ? (
          <div className={styles.peek} aria-hidden="true">
            <PromoCover promotion={upcoming} imageWidth={640} />
            <div className={styles.peekWash} />
          </div>
        ) : null}

        {index > 0 && !detailOpen ? (
          <button
            type="button"
            className={styles.navBack}
            onClick={handleBack}
            aria-label="Volver a la promoción anterior"
          >
            <IconChevronLeft className={styles.navBackIcon} />
          </button>
        ) : null}

        <AnimatePresence initial={false}>
          <SwipeCard
            key={current.id}
            ref={cardRef}
            promotion={current}
            distanceKm={distances.get(current.id) ?? null}
            reduceMotion={reduceMotion}
            onSkip={advance}
            onToggleSave={toggleSaveCurrent}
            onDetailChange={setDetailOpen}
          />
        </AnimatePresence>

        {!detailOpen ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.fab} ${styles.fabSkip}`}
              onClick={skipCurrent}
              aria-label="Pasar a la siguiente"
            >
              <IconClose className={styles.fabIcon} />
            </button>
            <button
              type="button"
              className={`${styles.fab} ${styles.fabReserve}`}
              onClick={handleReserve}
              disabled={promoLocked}
              aria-label={`Reservar en ${current.companyName}`}
            >
              <IconCalendar className={styles.fabIcon} />
            </button>
            <button
              type="button"
              className={`${styles.fab} ${styles.fabSave} ${isSaved ? styles.fabSaveOn : ''}`}
              onClick={toggleSaveCurrent}
              aria-pressed={isSaved}
              aria-label={isSaved ? 'Quitar de guardadas' : 'Guardar promoción'}
            >
              <IconBookmark className={styles.fabIcon} filled={isSaved} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
