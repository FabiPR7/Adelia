import { useEffect, useRef, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import mapTexture from '../../assets/map-theme-island.webp'
import type { PublicPromotion } from '../../services/publicPromotions'
import { CLOUDINARY_DISPLAY, ensureHttpsUrl, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import { resolvePromotionHighlight, resolvePromotionMinimumSpend } from '../../utils/promotionOffer'
import { sortCompanyLadderPromotions } from '../../utils/promotionReservationProgress'
import {
  formatDistance,
  getPromotionHeroUrl,
  promotionTypeLabel,
  type RestaurantPromoGroup,
} from './promoAppDisplay'
import styles from './PromoApp.module.css'

function CompassMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden="true" focusable="false">
      <circle cx="44" cy="44" r="40" fill="rgba(255,248,230,0.96)" stroke="#8a6a2a" strokeWidth="2" />
      <circle cx="44" cy="44" r="18" fill="rgba(201,162,39,0.14)" stroke="rgba(138,106,42,0.45)" strokeWidth="1" />
      <path d="M44 12 L49 44 L44 39 L39 44 Z" fill="#b91c1c" />
      <path d="M44 76 L39 44 L44 49 L49 44 Z" fill="#1f2937" />
      <path d="M12 44 L44 39 L39 44 L44 49 Z" fill="#b91c1c" opacity="0.75" />
      <path d="M76 44 L44 49 L49 44 L44 39 Z" fill="#1f2937" opacity="0.75" />
      <circle cx="44" cy="44" r="3.2" fill="#c9a227" stroke="#5c3d1e" strokeWidth="0.8" />
    </svg>
  )
}

export function RestaurantAvatar({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string
  photoUrl: string
  size?: 'md' | 'lg'
}) {
  const className = size === 'lg' ? styles.avatarLg : styles.avatar
  const photo = photoUrl
    ? optimizeCloudinaryUrl(ensureHttpsUrl(photoUrl), CLOUDINARY_DISPLAY.photoThumb)
    : ''

  return photo ? (
    <img src={photo} alt="" className={className} loading="lazy" decoding="async" />
  ) : (
    <span className={`${className} ${styles.avatarFallback}`} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

interface PromoAppCardProps {
  promotion: PublicPromotion
  onOpen: (promotion: PublicPromotion) => void
  /** Tarjeta cuadrada para rejilla. */
  tile?: boolean
  showRestaurant?: boolean
  stamp?: string
  index?: number
  /** Versión baja para las filas por restaurante: sin descripción. */
  compact?: boolean
  /** Si no se puede usar ahora: texto corto del candado ("Agotada", "13:00–16:00"…). */
  lockLabel?: string | null
}

export function PromoAppCard({
  promotion,
  onOpen,
  tile = false,
  showRestaurant = false,
  stamp,
  index = 0,
  compact = false,
  lockLabel = null,
}: PromoAppCardProps) {
  const hero = getPromotionHeroUrl(promotion, tile ? 'photoPreview' : 'photoThumb')
  const highlight = resolvePromotionHighlight(promotion, index)
  const minSpend = resolvePromotionMinimumSpend(promotion)

  return (
    <button
      type="button"
      className={`${styles.card} ${tile ? styles.cardTile : ''} ${compact ? styles.cardCompact : ''} ${stamp ? styles.cardStamped : ''} ${lockLabel ? styles.cardLocked : ''}`}
      onClick={() => onOpen(promotion)}
      aria-label={lockLabel ? `${promotion.title}. No disponible ahora: ${lockLabel}` : undefined}
    >
      <span className={styles.cardMedia}>
        {hero ? (
          <img src={hero} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.cardFallback} aria-hidden="true">%</span>
        )}
        {highlight ? <span className={styles.cardBadge}>{highlight}</span> : null}
        {stamp ? <span className={styles.cardStamp}>{stamp}</span> : null}
        {lockLabel ? (
          <span className={styles.cardLock}>
            <Lock size={12} strokeWidth={2.4} aria-hidden="true" />
            {lockLabel}
          </span>
        ) : null}
      </span>

      <span className={styles.cardBody}>
        {showRestaurant ? <span className={styles.cardRestaurant}>{promotion.companyName}</span> : null}
        <span className={styles.cardTitle}>{promotion.title}</span>
        {!tile && !compact && promotion.description ? (
          <span className={styles.cardDescription}>{promotion.description}</span>
        ) : null}
        <span className={styles.cardMeta}>
          <span className={styles.typeChip}>{promotionTypeLabel(promotion.type)}</span>
          {!tile && promotion.detail ? <span className={styles.cardDetail}>{promotion.detail}</span> : null}
        </span>
        {minSpend ? <span className={styles.cardMinSpend}>{minSpend}</span> : null}
      </span>
    </button>
  )
}

export function TreasureMapsCard({
  mapCount,
  inProgressCount = 0,
  onOpen,
}: {
  mapCount: number
  /** Mapas que ya has empezado: se dicen primero. */
  inProgressCount?: number
  onOpen: () => void
}) {
  const mapsLabel = mapCount === 0
    ? 'Pronto habrá nuevos senderos'
    : mapCount === 1
      ? '1 restaurante con mapa activo'
      : `${mapCount} restaurantes con mapa activo`
  const countLabel = inProgressCount > 0
    ? `${inProgressCount} en curso · ${mapsLabel}`
    : mapsLabel

  return (
    <button type="button" className={styles.mapsCard} onClick={onOpen}>
      <img src={mapTexture} alt="" className={styles.mapsTexture} />
      <span className={styles.mapsWash} aria-hidden="true" />
      <span className={styles.mapsFrame} aria-hidden="true" />
      <span className={styles.mapsContent}>
        <span className={styles.mapsLeft}>
          <span className={styles.livePill}>
            <span className={styles.liveDot} aria-hidden="true" />
            Mapas del tesoro
          </span>
          <span className={styles.mapsTitle}>Investiga y completa los mapas</span>
          <span className={styles.mapsMeta}>{countLabel}</span>
        </span>
        <span className={styles.mapsRight}>
          <span className={styles.compassWrap}>
            <CompassMark />
          </span>
          <span className={styles.ctaChip}>Explorar →</span>
        </span>
      </span>
    </button>
  )
}

export function LadderMapCard({ steps, onOpen }: { steps: PublicPromotion[]; onOpen: () => void }) {
  const sorted = sortCompanyLadderPromotions(steps)
  if (sorted.length === 0) return null

  return (
    <button type="button" className={`${styles.mapsCard} ${styles.ladderCard}`} onClick={onOpen}>
      <img src={mapTexture} alt="" className={styles.mapsTexture} />
      <span className={styles.mapsWash} aria-hidden="true" />
      <span className={styles.mapsFrame} aria-hidden="true" />
      <span className={styles.ladderContent}>
        <span className={styles.ladderTop}>
          <span className={styles.compassWrapLg}>
            <CompassMark size={50} />
          </span>
          <span className={styles.mapsLeft}>
            <span className={styles.livePill}>
              <span className={styles.liveDot} aria-hidden="true" />
              Mapa activo
            </span>
            <span className={styles.mapsTitle}>
              {sorted.length} premio{sorted.length === 1 ? '' : 's'} por visitar
            </span>
            <span className={styles.mapsMeta}>Reserva o consume y avanza en el sendero</span>
          </span>
        </span>

        <span className={styles.stepsRow} aria-hidden="true">
          {sorted.map((step, index) => {
            const isLast = index === sorted.length - 1
            return (
              <span key={step.id} className={styles.stepItem}>
                <span className={isLast ? styles.stepTreasure : styles.stepChip}>
                  {isLast ? '★' : index + 1}
                </span>
                {!isLast ? <span className={styles.stepDash} /> : null}
              </span>
            )
          })}
        </span>

        <span className={styles.ladderCta}>
          <span className={styles.mapsMeta}>Abre el mapa para ver cada premio</span>
          <span className={styles.ctaChip}>Abrir mapa →</span>
        </span>
      </span>
    </button>
  )
}

/** Pantalla que entra desde la derecha (como al navegar en la app) por encima de la lista. */
export function PromoSidePanel({
  label,
  contentKey,
  onClose,
  children,
}: {
  label: string
  /** Cambia al pasar de una pantalla a otra dentro del panel: vuelve arriba. */
  contentKey: string
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    const handleKey = (event: KeyboardEvent) => {
      // Si hay un diálogo encima (mapa, reclamar…), Esc es suyo.
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) {
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
  }, [contentKey])

  return (
    <div className={styles.panelOverlay} onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className={styles.panel}
        role="region"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div key={contentKey} className={styles.panelContent}>
          {children}
        </div>
      </div>
    </div>
  )
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Carrusel que avanza solo una tarjeta cada pocos segundos y se para al tocarlo. */
function useAutoAdvance(intervalMs: number, itemCount: number) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const rail = railRef.current
    if (!rail || itemCount < 2 || prefersReducedMotion()) return

    const pause = () => {
      pausedRef.current = true
    }
    const resume = () => {
      pausedRef.current = false
    }
    rail.addEventListener('pointerenter', pause)
    rail.addEventListener('pointerleave', resume)
    rail.addEventListener('focusin', pause)
    rail.addEventListener('focusout', resume)
    rail.addEventListener('touchstart', pause, { passive: true })

    const timer = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return
      if (rail.scrollWidth <= rail.clientWidth + 4) return
      const first = rail.firstElementChild as HTMLElement | null
      const step = first ? first.offsetWidth + 10 : rail.clientWidth * 0.6
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4
      rail.scrollTo({ left: atEnd ? 0 : rail.scrollLeft + step, behavior: 'smooth' })
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
      rail.removeEventListener('pointerenter', pause)
      rail.removeEventListener('pointerleave', resume)
      rail.removeEventListener('focusin', pause)
      rail.removeEventListener('focusout', resume)
      rail.removeEventListener('touchstart', pause)
    }
  }, [intervalMs, itemCount])

  return railRef
}

interface RestaurantPromosRowProps {
  group: RestaurantPromoGroup
  index: number
  onOpenPromotion: (promotion: PublicPromotion) => void
  onOpenRestaurant: (group: RestaurantPromoGroup) => void
  /** Motivo corto del candado de cada promo, si ahora no se puede usar. */
  lockLabelFor?: (promotion: PublicPromotion) => string | null
}

export function RestaurantPromosRow({
  group,
  index,
  onOpenPromotion,
  onOpenRestaurant,
  lockLabelFor,
}: RestaurantPromosRowProps) {
  // Cada fila con un ritmo distinto para que no avancen todas a la vez.
  const railRef = useAutoAdvance(3200 + (index % 3) * 500, group.promotions.length)
  const distance = formatDistance(group.distanceKm)
  const count = group.promotions.length

  return (
    <section className={styles.row} aria-label={`Promociones de ${group.companyName}`}>
      <button type="button" className={styles.rowHeader} onClick={() => onOpenRestaurant(group)}>
        <RestaurantAvatar name={group.companyName} photoUrl={group.companyPhotoUrl} />
        <span className={styles.rowCopy}>
          <span className={styles.rowName}>{group.companyName}</span>
          <span className={styles.rowCount}>
            {count} {count === 1 ? 'promoción' : 'promociones'}
            {distance ? ` · a ${distance}` : ''}
          </span>
        </span>
        <span className={styles.rowLink}>Ver →</span>
      </button>

      <div ref={railRef} className={styles.rail}>
        {group.promotions.map((promotion, promoIndex) => (
          <div key={promotion.id} className={styles.railItem}>
            <PromoAppCard
              promotion={promotion}
              index={promoIndex}
              compact
              lockLabel={lockLabelFor?.(promotion) ?? null}
              onOpen={onOpenPromotion}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
