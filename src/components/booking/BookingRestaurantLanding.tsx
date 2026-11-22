import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CalendarCheck, Clock, Mail, MapPin, Navigation, Phone, Tag } from 'lucide-react'
import PublicRestaurantReviews from './PublicRestaurantReviews'
import { useReviewWriter } from './WriteReviewButton'
import RestaurantRouteMapModal from './RestaurantRouteMapModal'
import RestaurantPhotoCollage from './RestaurantPhotoCollage'
import AdelinaCoin from '../AdelinaCoin'
import FacilityIcon from '../FacilityIcon'
import FavoriteButton from '../FavoriteButton'
import SupportMessageModal from '../SupportMessageModal'
import { useAuth } from '../../context/AuthContext'
import type { PublicBookingCompany } from '../../services/publicApi'
import { fetchPublicPromotionsBySlug, type PublicPromotion } from '../../services/publicPromotions'
import { computeAverageReviewRating } from '../../types/review'
import { getCompanyMainPhotoUrl } from '../../utils/companyPhotos'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import { formatRestaurantLocation } from '../../utils/publicBooking'
import { toGeoCoordinates } from '../../utils/mapCoordinates'
import { getDaySchedule } from '../../utils/reservationSlots'
import { getDaySchedulePeriods } from '../../utils/schedule'
import { resolvePromotionDetail, resolvePromotionHighlight } from '../../utils/promotionOffer'
import {
  getAmenityIcon,
  getAmenityLabel,
  getPriceRangeSymbol,
  getVenueTypeLabel,
} from '../../data/companyProfileFacilities'
import type { BookingRules } from '../../types/bookingRules'
import RestaurantPrestige from './RestaurantPrestige'
import { useRestaurantBrowse } from './useRestaurantBrowse'
import styles from './BookingRestaurantLanding.module.css'

const MAX_TEASER_PROMOTIONS = 3
const VISIBLE_AMENITIES = 12
/** Los distintivos largos («3 reservas o consumos») van en letra pequeña para caber. */
const SHORT_BADGE_LENGTH = 7

interface BookingRestaurantLandingProps {
  company: PublicBookingCompany
  menuHref: string
  promotionsHref: string
  backHref?: string | null
  backLabel?: string
  onReserve: () => void
  /** Reglas de reserva que manda el servidor (si se puede reservar y el aviso). */
  booking: BookingRules
}

function formatTodaySchedule(company: PublicBookingCompany): string | null {
  if (!company.schedule) {
    return null
  }

  const today = getDaySchedule(new Date(), company.schedule)
  if (!today) {
    return null
  }
  if (!today.active) {
    return 'Hoy cerrado'
  }

  const periods = getDaySchedulePeriods(today)
    .filter((period) => period.open && period.close)
    .map((period) => `${period.open}–${period.close}`)

  return periods.length > 0 ? `Hoy de ${periods.join(' y ')}` : null
}

export default function BookingRestaurantLanding({
  company,
  menuHref,
  promotionsHref,
  backHref = '/',
  backLabel = '← Menú principal',
  onReserve,
  booking,
}: BookingRestaurantLandingProps) {
  const [routeMapOpen, setRouteMapOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const { profile } = useAuth()
  const pageRef = useRef<HTMLDivElement>(null)
  const browseNav = useRestaurantBrowse(company.slug, pageRef)
  const { neighbors } = browseNav
  const isCustomer = profile?.role === 'customer'
  const [promotions, setPromotions] = useState<PublicPromotion[]>([])
  const [reviewsKey, setReviewsKey] = useState(0)
  const reviewWriter = useReviewWriter(company, promotions, () => setReviewsKey((key) => key + 1))
  const [showAllAmenities, setShowAllAmenities] = useState(false)
  const locationLine = formatRestaurantLocation(company)
  const restaurantCoords = toGeoCoordinates(company.latitude, company.longitude)
  const mainPhotoIndex = company.mainPhotoIndex ?? 0
  // Lo decide el servidor (por ejemplo, sin mesas no se puede reservar).
  const acceptsReservations = booking.canReserve

  useEffect(() => {
    let cancelled = false

    void fetchPublicPromotionsBySlug(company.slug)
      .then((items) => {
        if (!cancelled) {
          setPromotions(items)
        }
      })
      .catch(() => {
        // Sin promociones la ficha sigue igual: solo se oculta el bloque.
      })

    return () => {
      cancelled = true
    }
  }, [company.slug])

  const allPhotos = useMemo(() => {
    if (company.photos.length > 0) {
      return company.photos
    }

    return company.logoUrl ? [company.logoUrl] : []
  }, [company.photos, company.logoUrl])

  const venueLabels = useMemo(
    () => company.venueTypes.map(getVenueTypeLabel).filter(Boolean),
    [company.venueTypes],
  )
  const priceSymbol = getPriceRangeSymbol(company.priceRange)
  const venueLine = [...venueLabels, priceSymbol].filter(Boolean).join(' · ')
  const amenityItems = useMemo(
    () =>
      company.amenities.map((id) => ({
        id,
        label: getAmenityLabel(id),
        icon: getAmenityIcon(id),
      })),
    [company.amenities],
  )

  const rating = company.reviewCount > 0
    ? computeAverageReviewRating(company.reviewRatingSum, company.reviewCount)
    : 0
  const ratingLabel = rating > 0
    ? rating.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : null
  const todaySchedule = formatTodaySchedule(company)
  const reservationNote = booking.note
  // Sin reservas: el botón se ve apagado y al pulsarlo lo explica (igual que la app).
  const [noReservationsOpen, setNoReservationsOpen] = useState(false)
  useEffect(() => {
    if (!noReservationsOpen) return
    const timer = window.setTimeout(() => setNoReservationsOpen(false), 4500)
    return () => window.clearTimeout(timer)
  }, [noReservationsOpen])
  const reserveOrExplain = acceptsReservations ? onReserve : () => setNoReservationsOpen(true)
  const reserveOffClass = acceptsReservations ? '' : ` ${styles.reserveOff}`

  const mainPhotoUrl = getCompanyMainPhotoUrl(allPhotos, mainPhotoIndex)
  const heroImage = mainPhotoUrl
    ? optimizeCloudinaryUrl(mainPhotoUrl, CLOUDINARY_DISPLAY.photoGallery)
    : null
  const teaserPromotions = promotions.slice(0, MAX_TEASER_PROMOTIONS)
  const visibleAmenities = showAllAmenities ? amenityItems : amenityItems.slice(0, VISIBLE_AMENITIES)
  const hiddenAmenityCount = amenityItems.length - visibleAmenities.length

  return (
    <div
      // Al pasar de restaurante se vuelve a montar para repetir la entrada.
      key={company.slug}
      ref={pageRef}
      className={[
        styles.page,
        styles.pageWithBar,
        browseNav.enter === 'next' ? styles.enterFromRight : '',
        browseNav.enter === 'prev' ? styles.enterFromLeft : '',
      ].filter(Boolean).join(' ')}
      {...browseNav.touchHandlers}
    >
      <section className={styles.hero} aria-label="Foto principal del restaurante">
        {neighbors ? (
          <nav className={styles.browsePill} aria-label="Pasar de restaurante">
            <button
              type="button"
              className={styles.browseArrow}
              onClick={() => browseNav.goTo('prev')}
              disabled={!neighbors.prev}
              aria-label="Restaurante anterior"
            >
              ‹
            </button>
            <span className={styles.browseText}>
              {neighbors.position} de {neighbors.total}
            </span>
            <button
              type="button"
              className={styles.browseArrow}
              onClick={() => browseNav.goTo('next')}
              disabled={!neighbors.next}
              aria-label="Restaurante siguiente"
            >
              ›
            </button>
          </nav>
        ) : null}
        {backHref ? (
          <Link to={backHref} className={styles.backButton} data-tour="tour-restaurant-back">
            {backLabel}
          </Link>
        ) : null}

        <FavoriteButton
          slug={company.slug}
          name={company.name}
          companyId={company.id}
          variant="overlayEnd"
        />

        {heroImage ? (
          <img src={heroImage} alt="" className={styles.heroImage} fetchPriority="high" decoding="async" />
        ) : (
          <div className={styles.heroFallback} aria-hidden="true">
            {company.logoUrl ? (
              <img
                src={optimizeCloudinaryUrl(company.logoUrl, CLOUDINARY_DISPLAY.logo)}
                alt=""
                className={styles.heroLogo}
              />
            ) : null}
          </div>
        )}

        <div className={styles.heroShade} aria-hidden="true" />

        <div className={styles.heroContent}>
          {venueLine ? <p className={styles.venueLine}>{venueLine}</p> : null}
          <h1 className={styles.name}>{company.name}</h1>

          <ul className={styles.heroMeta}>
            {ratingLabel ? (
              <li>
                <AdelinaCoin size="sm" variant="review" alt="" />
                <strong>{ratingLabel}</strong>
                <span>
                  {company.reviewCount} {company.reviewCount === 1 ? 'reseña' : 'reseñas'}
                </span>
              </li>
            ) : null}
            {todaySchedule ? (
              <li>
                <Clock size={15} aria-hidden="true" />
                <span>{todaySchedule}</span>
              </li>
            ) : null}
            {locationLine ? (
              <li>
                <MapPin size={15} aria-hidden="true" />
                <span>{locationLine}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <RestaurantRouteMapModal
        isOpen={routeMapOpen}
        onClose={() => setRouteMapOpen(false)}
        restaurantName={company.name}
        addressQuery={locationLine}
        restaurantCoords={restaurantCoords}
      />

      <div className={styles.actionsWrap}>
        <div
          className={styles.actions}
          data-tour="tour-restaurant-actions"
          data-tour-measure="children"
        >
          <button
            type="button"
            className={`${styles.actionPrimary}${reserveOffClass}`}
            onClick={reserveOrExplain}
            aria-disabled={!acceptsReservations}
          >
            <CalendarCheck size={20} aria-hidden="true" />
            Reservar mesa
          </button>
          <Link to={menuHref} className={styles.actionSecondary}>
            <BookOpen size={20} aria-hidden="true" />
            Ver la carta
          </Link>
          <Link to={promotionsHref} className={styles.actionSecondary}>
            <Tag size={20} aria-hidden="true" />
            Promociones
            {promotions.length > 0 ? <span className={styles.actionCount}>{promotions.length}</span> : null}
          </Link>
        </div>
      </div>

      <RestaurantPrestige slug={company.slug} />

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {teaserPromotions.length > 0 ? (
            <section className={styles.section} aria-labelledby="restaurant-promos-title">
              <div className={styles.sectionHeader}>
                <h2 id="restaurant-promos-title">Promociones en {company.name}</h2>
                <Link to={promotionsHref} className={styles.sectionLink}>
                  Ver todas
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <ul className={styles.promoList}>
                {teaserPromotions.map((promotion, index) => {
                  const detail = resolvePromotionDetail(promotion)
                  const highlight = resolvePromotionHighlight(promotion, index)

                  return (
                    <li key={promotion.id}>
                      <Link
                        to={`/reservar/${company.slug}/promo/${promotion.id}`}
                        className={styles.promoCard}
                      >
                        <span
                          className={`${styles.promoBadge} ${highlight.length > SHORT_BADGE_LENGTH ? styles.promoBadgeLong : ''}`}
                        >
                          {highlight}
                        </span>
                        <span className={styles.promoText}>
                          <strong>{promotion.title}</strong>
                          {detail ? <span>{detail}</span> : null}
                        </span>
                        <ArrowRight size={18} aria-hidden="true" className={styles.promoArrow} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {allPhotos.length > 0 || (company.videos?.length ?? 0) > 0 ? (
          <section className={styles.section} aria-label="Fotos del local">
            <RestaurantPhotoCollage
              photos={allPhotos}
              videos={company.videos ?? []}
              mainPhotoIndex={mainPhotoIndex}
              fallbackLabel={company.name}
              restaurantName={company.name}
            />
          </section>
          ) : null}

          <Link to={menuHref} className={styles.menuCard}>
            <span className={styles.menuIcon}>
              <BookOpen size={26} aria-hidden="true" />
            </span>
            <span className={styles.menuText}>
              <strong>La carta</strong>
              <span>Platos, bebidas y precios antes de ir.</span>
            </span>
            <span className={styles.menuCta}>
              Ver la carta
              <ArrowRight size={16} aria-hidden="true" />
            </span>
          </Link>

          <section className={styles.section} aria-labelledby="restaurant-about-title">
            <h2 id="restaurant-about-title" className={styles.sectionTitle}>Sobre el local</h2>
            {company.description ? (
              <p className={styles.description}>{company.description}</p>
            ) : null}

            {company.characteristics.length > 0 ? (
              <ul className={styles.tagList} aria-label="Características">
                {company.characteristics.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : null}

            {amenityItems.length > 0 ? (
              <>
                <h3 className={styles.subTitle}>Servicios</h3>
                <ul className={styles.amenityList} aria-label="Servicios del local">
                  {visibleAmenities.map((item) => (
                    <li key={item.id}>
                      <FacilityIcon name={item.icon} />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
                {hiddenAmenityCount > 0 ? (
                  <button
                    type="button"
                    className={styles.moreButton}
                    onClick={() => setShowAllAmenities(true)}
                  >
                    Ver los {amenityItems.length} servicios
                  </button>
                ) : null}
              </>
            ) : null}
          </section>
        </div>

        <aside className={styles.aside}>
          <div className={styles.asideCard}>
            <h2>Reserva tu mesa</h2>
            {acceptsReservations && reservationNote ? <p>{reservationNote}</p> : null}
            <button
              type="button"
              className={`${styles.asideReserve}${reserveOffClass}`}
              onClick={reserveOrExplain}
              aria-disabled={!acceptsReservations}
            >
              Reservar mesa
            </button>

            <ul className={styles.contactList}>
              {todaySchedule ? (
                <li>
                  <Clock size={18} aria-hidden="true" />
                  <span>{todaySchedule}</span>
                </li>
              ) : null}
              {locationLine ? (
                <li>
                  <MapPin size={18} aria-hidden="true" />
                  <span>{locationLine}</span>
                </li>
              ) : null}
              {company.phone ? (
                <li>
                  <Phone size={18} aria-hidden="true" />
                  <a href={`tel:${company.phone.replace(/\s/g, '')}`}>{company.phone}</a>
                </li>
              ) : null}
              {company.contactEmail ? (
                <li>
                  <Mail size={18} aria-hidden="true" />
                  <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>
                </li>
              ) : null}
            </ul>

            {locationLine ? (
              <button type="button" className={styles.routeButton} onClick={() => setRouteMapOpen(true)}>
                <Navigation size={16} aria-hidden="true" />
                Cómo llegar
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      <div className={styles.reviews}>
        <PublicRestaurantReviews
          companySlug={company.slug}
          companyName={company.name}
          refreshKey={reviewsKey}
          headerAction={reviewWriter.button}
          pinned={reviewWriter.pinned}
          hiddenReviewId={reviewWriter.hiddenReviewId}
        />
        {reviewWriter.overlays}
      </div>

      {isCustomer ? (
        <div className={styles.reportRow}>
          <span>¿No te dieron la promoción o no respetaron tu reserva?</span>
          <button type="button" className={styles.reportButton} onClick={() => setReportOpen(true)}>
            Reportar un problema
          </button>
        </div>
      ) : null}

      {reportOpen ? (
        <SupportMessageModal
          kind="report"
          companyId={company.id}
          companyName={company.name}
          onClose={() => setReportOpen(false)}
        />
      ) : null}

      {noReservationsOpen ? (
        <div className={styles.noReservationsToast} role="alert">
          <strong>Sin reservas en Adelia</strong>
          <span>Este local no cuenta con gestión de reservas en Adelia. Puedes ver su carta y sus promos, o ir directamente.</span>
          <button type="button" onClick={() => setNoReservationsOpen(false)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ) : null}

      <div className={styles.mobileBar}>
          <Link to={menuHref} className={styles.mobileBarLink}>
            <BookOpen size={18} aria-hidden="true" />
            Carta
          </Link>
          <Link to={promotionsHref} className={styles.mobileBarLink}>
            <Tag size={18} aria-hidden="true" />
            Promos
          </Link>
          <button
            type="button"
            className={`${styles.mobileBarReserve}${reserveOffClass}`}
            onClick={reserveOrExplain}
            aria-disabled={!acceptsReservations}
          >
            Reservar mesa
          </button>
        </div>
    </div>
  )
}
