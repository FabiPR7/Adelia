import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import PublicBookingShell from '../components/PublicBookingShell'
import { fetchPublicBookingPage, type PublicBookingCompany } from '../services/publicApi'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import { formatRestaurantLocation, hasRestaurantProfile } from '../utils/publicBooking'
import styles from './PublicRestaurantProfile.module.css'

function PublicRestaurantProfile() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const legalFrom = `${location.pathname}${location.search}`
  const reserveHref = `/reservar/${slug}`

  const [company, setCompany] = useState<PublicBookingCompany | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchPublicBookingPage(slug)
        if (!cancelled) {
          setCompany(data.company)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Restaurante no encontrado.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [slug])

  if (isLoading) {
    return (
      <div className={styles.loadingPage}>
        <p>Cargando restaurante…</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className={styles.loadingPage}>
        <p>{error ?? 'Restaurante no encontrado.'}</p>
        <Link to={reserveHref}>Volver a reservar</Link>
      </div>
    )
  }

  if (!hasRestaurantProfile(company)) {
    return <Navigate to={reserveHref} replace />
  }

  const locationLine = formatRestaurantLocation(company)
  const heroPhoto = company.photos[0]
    ? optimizeCloudinaryUrl(company.photos[0], CLOUDINARY_DISPLAY.photoGallery)
    : null
  const galleryPhotos = company.photos.map((photo) =>
    optimizeCloudinaryUrl(photo, CLOUDINARY_DISPLAY.photoGallery),
  )

  return (
    <PublicBookingShell company={company} legalFrom={legalFrom} reserveHref={reserveHref}>
      <section
        className={styles.hero}
        style={heroPhoto ? { backgroundImage: `url(${heroPhoto})` } : undefined}
      >
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          {company.logoUrl ? (
            <img
              src={optimizeCloudinaryUrl(company.logoUrl, CLOUDINARY_DISPLAY.logo)}
              alt=""
              className={styles.heroLogo}
            />
          ) : (
            <span className={styles.heroLogoFallback}>{company.name.charAt(0).toUpperCase()}</span>
          )}
          <h2 className={styles.heroTitle}>{company.name}</h2>
          {locationLine && <p className={styles.heroLocation}>{locationLine}</p>}
          {company.characteristics.length > 0 && (
            <div className={styles.heroTags}>
              {company.characteristics.slice(0, 4).map((item) => (
                <span key={item} className={styles.heroTag}>
                  {item}
                </span>
              ))}
            </div>
          )}
          <Link to={reserveHref} className={styles.heroCta}>
            Reservar mesa
          </Link>
        </div>
      </section>

      <main className={styles.main}>
        <div className={styles.contentGrid}>
          <div className={styles.primaryColumn}>
            {company.description && (
              <section className={styles.card}>
                <span className={styles.cardEyebrow}>Sobre nosotros</span>
                <h3 className={styles.cardTitle}>Conoce {company.name}</h3>
                <p className={styles.description}>{company.description}</p>
              </section>
            )}

            {company.characteristics.length > 0 && (
              <section className={styles.card}>
                <span className={styles.cardEyebrow}>Experiencia</span>
                <h3 className={styles.cardTitle}>Lo que nos define</h3>
                <div className={styles.characteristics}>
                  {company.characteristics.map((item) => (
                    <span key={item} className={styles.characteristic}>
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {galleryPhotos.length > 0 && (
              <section className={styles.card}>
                <span className={styles.cardEyebrow}>Galería</span>
                <h3 className={styles.cardTitle}>Un vistazo al local</h3>
                <div className={styles.galleryFeatured}>
                  <img
                    src={galleryPhotos[activePhoto] ?? galleryPhotos[0]}
                    alt=""
                    className={styles.galleryFeaturedImage}
                  />
                </div>
                {galleryPhotos.length > 1 && (
                  <div className={styles.galleryThumbs}>
                    {galleryPhotos.map((photo, index) => (
                      <button
                        key={`${photo}-${index}`}
                        type="button"
                        className={`${styles.galleryThumb} ${
                          index === activePhoto ? styles.galleryThumbActive : ''
                        }`}
                        onClick={() => setActivePhoto(index)}
                        aria-label={`Ver foto ${index + 1}`}
                      >
                        <img src={photo} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {company.videos.length > 0 && (
              <section className={styles.card}>
                <span className={styles.cardEyebrow}>Vídeo</span>
                <h3 className={styles.cardTitle}>Ambiente en movimiento</h3>
                <div className={styles.videoGrid}>
                  {company.videos.map((video, index) => (
                    <video
                      key={`${video}-${index}`}
                      src={video}
                      className={styles.video}
                      controls
                      preload="none"
                      playsInline
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className={styles.sideColumn}>
            <div className={styles.contactCard}>
              <span className={styles.cardEyebrow}>Contacto</span>
              <h3 className={styles.contactTitle}>Visítanos</h3>

              {company.location && (
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Dirección</span>
                  <p>{company.location}</p>
                  {(company.municipality || company.postalCode || company.country) && (
                    <p className={styles.contactMuted}>
                      {[company.municipality, company.postalCode, company.country]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              )}

              {company.phone && (
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Teléfono</span>
                  <a href={`tel:${company.phone}`}>{company.phone}</a>
                </div>
              )}

              {company.contactEmail && (
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Email</span>
                  <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>
                </div>
              )}

              <Link to={reserveHref} className={styles.contactCta}>
                Reservar ahora
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <div className={styles.mobileCtaBar}>
        <Link to={reserveHref} className={styles.mobileCta}>
          Reservar mesa
        </Link>
      </div>
    </PublicBookingShell>
  )
}

export default PublicRestaurantProfile
