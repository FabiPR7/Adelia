import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import PublicRestaurantReviews from './PublicRestaurantReviews'
import RestaurantRouteMapModal from './RestaurantRouteMapModal'
import RestaurantPhotoCollage from './RestaurantPhotoCollage'
import type { PublicBookingCompany } from '../../services/publicApi'
import { getCompanyMainPhotoUrl } from '../../utils/companyPhotos'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import { formatRestaurantLocation } from '../../utils/publicBooking'
import { toGeoCoordinates } from '../../utils/mapCoordinates'
import FavoriteButton from '../FavoriteButton'
import FacilityIcon from '../FacilityIcon'
import SlidingFitRow from './SlidingFitRow'
import {
  getAmenityIcon,
  getAmenityLabel,
  getAmenityTone,
  getPriceRangeSymbol,
  getVenueTypeLabel,
} from '../../data/companyProfileFacilities'
import {
  companyAcceptsReservations,
  companyRequiresReservation,
  reservationModeHint,
} from '../../data/companyReservationMode'
import styles from './BookingRestaurantLanding.module.css'

interface BookingRestaurantLandingProps {
  company: PublicBookingCompany
  menuHref: string
  promotionsHref: string
  backHref?: string | null
  backLabel?: string
  onReserve: () => void
}

const BUBBLE_VARIANTS = ['bubbleA', 'bubbleB', 'bubbleC', 'bubbleD', 'bubbleE'] as const
const AMENITY_TIP_MS = 1000

function UtensilsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 3.2v5.3c0 1 .8 1.8 1.8 1.8h.4c1 0 1.8-.8 1.8-1.8V3.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M5 3.2V6M9 3.2V6M7.2 10.3V20.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M15.2 20.8V8.4c0-2.6 1.4-4.4 3.6-5.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M15.2 8.4h3.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function PercentTagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="8.2" r="2.15" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="16" cy="15.8" r="2.15" stroke="currentColor" strokeWidth="1.9" />
      <path d="M15.6 6.4 8.4 17.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function CalendarCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3.4 10.2h17.2M8 3.4v3.4M16 3.4v3.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="m8.6 16.1 2.2 2.2 4.7-4.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AmenityHintButton({
  id,
  label,
  icon,
}: {
  id: string
  label: string
  icon: string
}) {
  const [open, setOpen] = useState(false)
  const [tipKey, setTipKey] = useState(0)
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null)
  const timerRef = useRef<number | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tone = getAmenityTone(id)

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const showTip = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      setTipPos({ left: rect.left + rect.width / 2, top: rect.top })
    }

    setOpen(true)
    setTipKey((current) => current + 1)

    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      setOpen(false)
      timerRef.current = null
    }, AMENITY_TIP_MS)
  }

  return (
    <li className={styles.amenityItem}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.amenityIcon} ${open ? styles.amenityIconOn : ''}`}
        style={{ color: tone.ink, background: tone.wash, borderColor: `${tone.ink}33` }}
        aria-label={label}
        onClick={showTip}
      >
        <FacilityIcon name={icon} />
      </button>
      {open && tipPos
        ? createPortal(
            <span
              key={tipKey}
              className={styles.amenityTip}
              role="status"
              style={{ left: tipPos.left, top: tipPos.top }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </li>
  )
}

export default function BookingRestaurantLanding({
  company,
  menuHref,
  promotionsHref,
  backHref = '/',
  backLabel = '← Menú principal',
  onReserve,
}: BookingRestaurantLandingProps) {
  const [routeMapOpen, setRouteMapOpen] = useState(false)
  const locationLine = formatRestaurantLocation(company)
  const restaurantCoords = toGeoCoordinates(company.latitude, company.longitude)
  const mainPhotoIndex = company.mainPhotoIndex ?? 0

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

  const mainPhotoUrl = getCompanyMainPhotoUrl(allPhotos, mainPhotoIndex)
  const heroImage = mainPhotoUrl
    ? optimizeCloudinaryUrl(mainPhotoUrl, CLOUDINARY_DISPLAY.photoGallery)
    : null

  return (
    <div className={styles.page}>
      <div className={styles.ambientOrbs} aria-hidden="true">
        <span className={styles.orbA} />
        <span className={styles.orbB} />
        <span className={styles.orbC} />
      </div>

      <section className={styles.hero} aria-label="Foto principal del restaurante">
        {backHref ? (
          <Link to={backHref} className={styles.backButton}>
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
            ) : (
              <span className={styles.heroInitial}>{company.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
        )}

        <div className={styles.heroOverlayTop} aria-hidden="true" />
        <div className={styles.heroOverlayBottom} aria-hidden="true" />
        <div className={styles.heroGrain} aria-hidden="true" />

        <div className={styles.heroContent}>
          <div className={styles.nameBlock}>
            <h1 className={styles.name}>{company.name}</h1>
          </div>

          {locationLine && (
            <div className={styles.locationRow}>
              <p className={styles.location}>
                <svg className={styles.locationIcon} viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"
                  />
                </svg>
                <span>{locationLine}</span>
              </p>
              <button
                type="button"
                className={styles.locationButton}
                onClick={() => setRouteMapOpen(true)}
              >
                Ver ubicación
              </button>
            </div>
          )}
        </div>
      </section>

      <RestaurantRouteMapModal
        isOpen={routeMapOpen}
        onClose={() => setRouteMapOpen(false)}
        restaurantName={company.name}
        addressQuery={locationLine}
        restaurantCoords={restaurantCoords}
      />

      <div className={styles.body}>
        <section className={`${styles.profileMeta} ${styles.revealCard}`} aria-label="Perfil del local">
          <div className={styles.venueRow}>
            <p className={styles.venueTypes}>{venueLine || 'Restaurante'}</p>
            <div className={styles.quickActions}>
              <Link to={menuHref} className={styles.quickMenu} aria-label="Carta" title="Carta">
                <UtensilsIcon />
                <span className={styles.quickLabel}>Carta</span>
              </Link>
              <Link to={promotionsHref} className={styles.quickPromo} aria-label="Promociones" title="Promos">
                <PercentTagIcon />
                <span className={styles.quickLabel}>Promos</span>
              </Link>
              {companyAcceptsReservations(company.reservationMode) ? (
                <button
                  type="button"
                  className={styles.quickReserve}
                  onClick={onReserve}
                  aria-label="Reservar"
                  title="Reservar"
                >
                  <CalendarCheckIcon />
                  <span className={styles.quickLabel}>Reserva</span>
                </button>
              ) : null}
            </div>
          </div>
          {amenityItems.length > 0 ? (
            <ul className={styles.amenityStrip} aria-label="Servicios del local">
              {amenityItems.map((item) => (
                <AmenityHintButton
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </ul>
          ) : null}

          {company.characteristics.length > 0 ? (
            <SlidingFitRow ariaLabel="Características" className={styles.characteristicRow}>
              {company.characteristics.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className={styles[BUBBLE_VARIANTS[index % BUBBLE_VARIANTS.length]]}
                >
                  {item}
                </li>
              ))}
            </SlidingFitRow>
          ) : null}
        </section>

        <div className={`${styles.featureRow} ${styles.revealCardDelayed}`}>
          <RestaurantPhotoCollage
            photos={allPhotos}
            videos={company.videos ?? []}
            mainPhotoIndex={mainPhotoIndex}
            fallbackLabel={company.name}
            restaurantName={company.name}
          />
          <p className={styles.reservationModeNote}>
            {companyRequiresReservation(company.reservationMode)
              ? 'Reserva obligatoria.'
              : companyAcceptsReservations(company.reservationMode)
                ? 'Reserva opcional. También puedes venir sin mesa.'
                : reservationModeHint(company.reservationMode)}
          </p>
        </div>

        <div className={styles.infoRow}>
          <section className={`${styles.infoCard} ${styles.revealInfo}`} aria-label="Contacto">
            <h2 className={styles.cardLabel}>
              <span className={styles.cardLabelDot} aria-hidden="true" />
              <span className={styles.cardLabelText}>Contacto</span>
            </h2>
            {company.phone && (
              <p className={styles.contactLine}>
                <span className={styles.contactIcon} aria-hidden="true">☎</span>
                <a href={`tel:${company.phone.replace(/\s/g, '')}`}>{company.phone}</a>
              </p>
            )}
            {company.contactEmail && (
              <p className={styles.contactLine}>
                <span className={styles.contactIcon} aria-hidden="true">✉</span>
                <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>
              </p>
            )}
            {!company.phone && !company.contactEmail && (
              <p className={styles.emptyHint}>Sin datos de contacto.</p>
            )}
          </section>

          <section
            className={`${styles.infoCard} ${styles.descriptionCard} ${styles.revealInfoDelayed}`}
            aria-label="Descripción"
          >
            <h2 className={styles.cardLabel}>
              <span className={styles.cardLabelDot} aria-hidden="true" />
              <span className={styles.cardLabelTextShort}>Desc.</span>
              <span className={styles.cardLabelTextFull}>Descripción</span>
            </h2>
            {company.description ? (
              <p className={styles.description}>{company.description}</p>
            ) : (
              <p className={styles.emptyHint}>Sin descripción publicada.</p>
            )}
          </section>
        </div>
      </div>

      <PublicRestaurantReviews
        companySlug={company.slug}
        companyName={company.name}
      />
    </div>
  )
}
