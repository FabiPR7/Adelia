import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { Link } from 'react-router-dom'
import PublicRestaurantReviews from './PublicRestaurantReviews'
import RestaurantRouteMapModal from './RestaurantRouteMapModal'
import type { PublicBookingCompany } from '../../services/publicApi'
import { getCompanyMainPhotoUrl } from '../../utils/companyPhotos'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import { formatRestaurantLocation } from '../../utils/publicBooking'
import { toGeoCoordinates } from '../../utils/mapCoordinates'
import FavoriteButton from '../FavoriteButton'
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

function PhotoCarousel({
  photos,
  fallbackLabel,
}: {
  photos: string[]
  fallbackLabel: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    setActiveIndex(0)
  }, [photos])

  useEffect(() => {
    if (photos.length <= 1) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setIsTransitioning(true)
      setActiveIndex((current) => (current + 1) % photos.length)
      window.setTimeout(() => setIsTransitioning(false), 520)
    }, 4500)

    return () => {
      window.clearInterval(timer)
    }
  }, [photos])

  const goTo = useCallback((index: number) => {
    if (photos.length === 0) {
      return
    }

    setIsTransitioning(true)
    setActiveIndex((index + photos.length) % photos.length)
    window.setTimeout(() => setIsTransitioning(false), 520)
  }, [photos.length])

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) {
      return
    }

    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    touchStartX.current = null

    if (Math.abs(delta) < 36) {
      return
    }

    goTo(activeIndex + (delta < 0 ? 1 : -1))
  }

  if (photos.length === 0) {
    return (
      <div className={styles.carouselBox} aria-label="Galería de fotos">
        <div className={styles.carouselFallback}>
          {fallbackLabel.charAt(0).toUpperCase()}
        </div>
      </div>
    )
  }

  const progress = photos.length > 1 ? ((activeIndex + 1) / photos.length) * 100 : 100

  return (
    <div
      className={`${styles.carouselBox} ${isTransitioning ? styles.carouselBoxActive : ''}`}
      aria-label="Galería de fotos"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.carouselShine} aria-hidden="true" />

      <div
        className={styles.carouselTrack}
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {photos.map((photo, index) => (
          <div key={photo} className={styles.carouselSlide}>
            <img
              src={optimizeCloudinaryUrl(photo, CLOUDINARY_DISPLAY.photoThumb)}
              alt=""
              className={`${styles.carouselImage} ${index === activeIndex ? styles.carouselImageActive : ''}`}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={index === 0 ? 'high' : 'low'}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <div className={styles.carouselCounter} aria-hidden="true">
            {activeIndex + 1}/{photos.length}
          </div>
          <div className={styles.carouselProgress} aria-hidden="true">
            <span className={styles.carouselProgressBar} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.carouselDots}>
            {photos.map((photo, index) => (
              <button
                key={photo}
                type="button"
                className={`${styles.carouselDot} ${index === activeIndex ? styles.carouselDotActive : ''}`}
                onClick={() => goTo(index)}
                aria-label={`Foto ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
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
            <span className={styles.nameEyebrow}>Restaurante</span>
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
        <div className={styles.featureRow}>
          <section className={`${styles.characteristicsCard} ${styles.revealCard}`} aria-label="Características">
            <h2 className={styles.cardLabel}>
              <span className={styles.cardLabelDot} aria-hidden="true" />
              <span className={styles.cardLabelTextShort}>Caract.</span>
              <span className={styles.cardLabelTextFull}>Características</span>
            </h2>
            {company.characteristics.length > 0 ? (
              <ul className={styles.characteristics}>
                {company.characteristics.map((item, index) => (
                  <li
                    key={item}
                    className={styles[BUBBLE_VARIANTS[index % BUBBLE_VARIANTS.length]]}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyHint}>Sin características publicadas.</p>
            )}
          </section>

          <div className={`${styles.carouselWrap} ${styles.revealCardDelayed}`}>
            <h2 className={styles.carouselLabel}>
              <span className={styles.cardLabelDot} aria-hidden="true" />
              <span className={styles.cardLabelText}>Fotos</span>
            </h2>
            <PhotoCarousel photos={allPhotos} fallbackLabel={company.name} />
          </div>
        </div>

        <div className={`${styles.actions} ${styles.revealActions}`}>
          <Link to={menuHref} className={styles.menuButton}>
            <span className={styles.buttonIcon} aria-hidden="true">📋</span>
            Ver carta
          </Link>
          <Link to={promotionsHref} className={styles.promotionsButton}>
            <span className={styles.buttonIcon} aria-hidden="true">🎁</span>
            Promos
          </Link>
          <button type="button" className={styles.reserveButton} onClick={onReserve}>
            <span className={styles.buttonGlow} aria-hidden="true" />
            <span className={styles.buttonIcon} aria-hidden="true">✦</span>
            Reservar
          </button>
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
