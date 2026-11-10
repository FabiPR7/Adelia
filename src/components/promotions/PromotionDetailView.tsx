import { Link } from 'react-router-dom'
import { Info, Lock, UtensilsCrossed } from 'lucide-react'
import { companyAcceptsReservations } from '../../data/companyReservationMode'
import type { PublicPromotion } from '../../services/publicPromotions'
import { CLOUDINARY_DISPLAY, ensureHttpsUrl, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import {
  formatPromotionOfferSummary,
  resolvePromotionHighlight,
  resolvePromotionMinimumSpend,
} from '../../utils/promotionOffer'
import { sortCompanyLadderPromotions } from '../../utils/promotionReservationProgress'
import type { PromotionAvailability } from '../../utils/promotionAvailability'
import { RestaurantAvatar } from './PromoAppCards'
import { formatDistance, getPromotionHeroUrl, isLadderStep, promotionTypeLabel } from './promoAppDisplay'
import styles from './PromoApp.module.css'

interface PromotionDetailViewProps {
  promotion: PublicPromotion
  companyPromotions: PublicPromotion[]
  distanceKm: number | null
  saved: boolean
  promoLocked: boolean
  claimedAt?: string
  /** Texto de estado de la reserva vinculada (promos con horario). */
  reservationStatusLine?: string | null
  onBack: () => void
  onReserve: (promotion: PublicPromotion) => void
  onToggleSave: (promotion: PublicPromotion) => void
  onOpenLadderMap: (promotion: PublicPromotion) => void
  onVerify?: () => void
  /** Si se puede usar ahora y, si no, por qué (candado). */
  availability?: PromotionAvailability | null
}

function buildFacts(promotion: PublicPromotion, availability?: PromotionAvailability | null) {
  const facts: Array<{ label: string; value: string; accent?: boolean }> = []
  const visits = promotion.requiredReservations ?? 0

  if (promotion.offer) {
    facts.push({ label: 'Oferta', value: formatPromotionOfferSummary(promotion.offer), accent: true })
  }
  if (isLadderStep(promotion)) {
    facts.push({ label: 'Visitas', value: visits === 1 ? '1 consumo' : `${visits} consumos`, accent: true })
  }
  const minSpend = resolvePromotionMinimumSpend(promotion)
  if (minSpend) {
    facts.push({ label: 'Consumo mín.', value: minSpend.replace(/^Gasto mínimo:\s*/, '') })
  }
  if (promotion.activeFromTime && promotion.activeToTime) {
    if (promotion.type === 'time_limited' || promotion.type === 'attendance') {
      facts.push({ label: 'Horario', value: `${promotion.activeFromTime} – ${promotion.activeToTime}` })
    } else if (promotion.claimWindowEnabled) {
      facts.push({ label: 'Canje', value: `${promotion.activeFromTime} – ${promotion.activeToTime}` })
    }
  }
  if (promotion.type === 'attendance' && promotion.arrivalWindowMinutes) {
    facts.push({ label: 'Asistencia', value: `${promotion.arrivalWindowMinutes} min` })
  }
  if (promotion.maxRedemptions != null && promotion.maxRedemptions > 0) {
    const left = Math.max(0, promotion.maxRedemptions - (promotion.currentRedemptions ?? 0))
    facts.push({ label: 'Plazas', value: `${left} de ${promotion.maxRedemptions}` })
  }
  if (availability?.usesLabel) {
    facts.push({
      label: 'Tus usos',
      value: availability.usesLeft != null
        ? `${availability.usesLeft} ${availability.usesLeft === 1 ? 'restante' : 'restantes'}`
        : 'Sin límite',
      accent: availability.usesLeft === 0,
    })
  }
  return facts
}

function buildHowSteps(promotion: PublicPromotion): string[] {
  const visits = promotion.requiredReservations ?? 0
  if (isLadderStep(promotion)) {
    return [
      'Reserva o consume en el local',
      `Acumula ${visits || 'tus'} visita${visits === 1 ? '' : 's'}`,
      'Desbloquea y reclama el premio',
    ]
  }
  if (promotion.activeFromTime && promotion.activeToTime) {
    return [
      'Elige una hora dentro del tramo',
      'Reserva tu mesa con la promo',
      'Disfruta la oferta en el local',
    ]
  }
  return [
    'Abre la reserva con esta promo',
    'Confirma día, hora y mesa',
    'Canjea la oferta en el local',
  ]
}

function PromotionDetailView({
  promotion,
  companyPromotions,
  distanceKm,
  saved,
  promoLocked,
  claimedAt,
  reservationStatusLine,
  onBack,
  onReserve,
  onToggleSave,
  onOpenLadderMap,
  onVerify,
  availability = null,
}: PromotionDetailViewProps) {
  const hero = getPromotionHeroUrl(promotion, 'photoGallery')
  const highlight = resolvePromotionHighlight(promotion)
  const facts = buildFacts(promotion, availability)
  const lockedNow = Boolean(availability?.locked)
  const blocked = lockedNow && availability?.action !== 'reserve'
  const howSteps = buildHowSteps(promotion)
  const isLadder = isLadderStep(promotion)
  const visits = promotion.requiredReservations ?? 0
  const canReserve = companyAcceptsReservations(promotion.reservationMode ?? 'optional')
  const distance = formatDistance(distanceKm)
  const restaurantHref = `/reservar/${encodeURIComponent(promotion.companySlug)}`
  const ladderSteps = isLadder
    ? sortCompanyLadderPromotions(companyPromotions.filter((item) => item.companyId === promotion.companyId))
    : []
  const ladderIndex = ladderSteps.findIndex((item) => item.id === promotion.id)
  const products = promotion.productRefs ?? []

  return (
    <article className={styles.detail}>
      <header className={styles.detailHero}>
        {hero ? (
          <img src={hero} alt="" className={styles.detailHeroImage} />
        ) : (
          <span className={styles.detailHeroFallback} aria-hidden="true">%</span>
        )}
        <span className={styles.detailScrim} aria-hidden="true" />
        <div className={styles.detailHeroTop}>
          <button type="button" className={styles.backChipDark} onClick={onBack} aria-label="Volver">
            ←
          </button>
          {highlight ? <span className={styles.highlightPill}>{highlight}</span> : null}
        </div>
        <div className={styles.detailHeroBottom}>
          <span className={styles.heroType}>{promotionTypeLabel(promotion.type)}</span>
          <h1 className={styles.heroTitle}>{promotion.title}</h1>
        </div>
      </header>

      <div className={styles.detailBody}>
        <Link to={restaurantHref} className={styles.companyCard}>
          <RestaurantAvatar name={promotion.companyName} photoUrl={promotion.companyPhotoUrl} size="lg" />
          <span className={styles.companyCopy}>
            <span className={styles.companyEyebrow}>Restaurante{distance ? ` · a ${distance}` : ''}</span>
            <span className={styles.companyName}>{promotion.companyName}</span>
          </span>
          <span className={styles.companyLink}>Ver ficha</span>
        </Link>

        {lockedNow && availability ? (
          <div className={styles.lockCard} role="status">
            <span className={styles.lockIcon} aria-hidden="true">
              <Lock size={18} strokeWidth={2.4} />
            </span>
            <div className={styles.lockCopy}>
              <strong>{availability.title}</strong>
              <p>{availability.message}</p>
            </div>
          </div>
        ) : null}

        {availability && (availability.notes.length > 0 || (!lockedNow && availability.usesLabel)) ? (
          <ul className={styles.noteList}>
            {!lockedNow && availability.usesLabel ? (
              <li>
                <Info size={14} strokeWidth={2.4} aria-hidden="true" />
                {availability.usesLabel}
              </li>
            ) : null}
            {availability.notes.map((note) => (
              <li key={note}>
                <Info size={14} strokeWidth={2.4} aria-hidden="true" />
                {note}
              </li>
            ))}
          </ul>
        ) : null}

        {claimedAt ? (
          <p className={styles.statusBanner} role="status">
            Reclamada el {new Date(claimedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
          </p>
        ) : null}

        {reservationStatusLine ? (
          <div className={styles.statusCard}>
            <p>{reservationStatusLine}</p>
            {onVerify ? (
              <button type="button" className={styles.statusAction} onClick={onVerify}>
                Verificar consumo
              </button>
            ) : null}
          </div>
        ) : null}

        {promotion.description || promotion.detail ? (
          <div className={styles.storyCard}>
            {promotion.description ? <p className={styles.storyText}>{promotion.description}</p> : null}
            {promotion.detail ? <p className={styles.storyDetail}>{promotion.detail}</p> : null}
          </div>
        ) : null}

        {facts.length > 0 ? (
          <dl className={styles.factsGrid}>
            {facts.map((fact) => (
              <div key={fact.label} className={fact.accent ? styles.factTileAccent : styles.factTile}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {isLadder && visits > 0 ? (
          <div className={styles.visitsHero}>
            <span className={styles.visitsBadge} aria-hidden="true">
              <UtensilsCrossed size={20} strokeWidth={2} />
              <strong>{visits}</strong>
            </span>
            <span className={styles.visitsCopy}>
              <strong>{visits === 1 ? '1 reserva o consumo' : `${visits} reservas o consumos`}</strong>
              <span>Cuando el local confirme tu visita, avanzas en el mapa de premios.</span>
            </span>
          </div>
        ) : null}

        {isLadder ? (
          <button type="button" className={styles.mapEntry} onClick={() => onOpenLadderMap(promotion)}>
            <span className={styles.mapEntryCopy}>
              <span className={styles.mapEntryEyebrow}>Escalera</span>
              <span className={styles.mapEntryTitle}>
                {ladderSteps.length > 1
                  ? `Premio ${Math.max(ladderIndex, 0) + 1} de ${ladderSteps.length}`
                  : 'Tu mapa de premios'}
              </span>
              <span className={styles.mapEntrySub}>Mira tu progreso y reclama el premio</span>
            </span>
            <span className={styles.ctaChip}>Mapa →</span>
          </button>
        ) : null}

        <section className={styles.howCard} aria-label="Cómo funciona">
          <h2 className={styles.sectionTitle}>Cómo funciona</h2>
          <ol className={styles.howList}>
            {howSteps.map((step, index) => (
              <li key={step}>
                <span className={styles.howIndex} aria-hidden="true">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        {products.length > 0 ? (
          <section aria-label="Productos incluidos">
            <h2 className={styles.sectionTitle}>
              Incluye{products.length > 1 ? ` · ${products.length}` : ''}
            </h2>
            <div className={styles.productsGrid}>
              {products.map((product) => (
                <div key={product.nodeId || product.name} className={styles.productCard}>
                  {product.photoUrl ? (
                    <img
                      src={optimizeCloudinaryUrl(ensureHttpsUrl(product.photoUrl), CLOUDINARY_DISPLAY.photoThumb)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.productFallback} aria-hidden="true">
                      {product.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={styles.productName}>{product.name}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <Link to={restaurantHref} className={styles.secondaryLink}>
          Ver restaurante y más promos
        </Link>
      </div>

      <div className={styles.ctaBar}>
        <button
          type="button"
          className={saved ? styles.saveButtonOn : styles.saveButton}
          aria-pressed={saved}
          onClick={() => onToggleSave(promotion)}
        >
          {saved ? '★ Guardada' : '☆ Guardar'}
        </button>
        {isLadder ? (
          <button type="button" className={styles.primaryButton} onClick={() => onOpenLadderMap(promotion)}>
            Ver mi progreso
          </button>
        ) : blocked ? (
          <Link to={restaurantHref} className={styles.primaryButtonMuted}>
            <Lock size={16} strokeWidth={2.4} aria-hidden="true" />
            Ver otras promos del local
          </Link>
        ) : canReserve && !promoLocked ? (
          <button type="button" className={styles.primaryButton} onClick={() => onReserve(promotion)}>
            {lockedNow ? 'Reservar para esa franja' : 'Reservar con esta promo'}
          </button>
        ) : (
          <Link to={restaurantHref} className={styles.primaryButton}>
            Ver restaurante
          </Link>
        )}
      </div>
    </article>
  )
}

export default PromotionDetailView
