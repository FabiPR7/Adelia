import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import GamificationRankingStripCard from '../../components/GamificationRankingStripCard'
import { useAuth } from '../../context/AuthContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import { logout } from '../../services/auth'
import { useFavoriteRestaurants } from '../../hooks/useFavoriteRestaurants'
import { listMyReviews, type CustomerReviewSummary } from '../../services/userReviews'
import { listProductClaims, type ProductClaimRecord } from '../../services/productClaims'
import { getLevelProfileBackground } from '../../utils/levelProfileBackground'
import { getLevelProfileBodyTheme } from '../../utils/levelProfileBodyThemes'
import { getLevelRankingStripTheme } from '../../utils/levelRankingStripThemes'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import LegalLinks from '../../components/LegalLinks'
import styles from './CustomerProfileTab.module.css'

const QUICK_ACCENTS = ['coral', 'gold', 'magenta', 'sunset'] as const

function CustomerProfileTab() {
  const { profile, user } = useAuth()
  const { favoriteSlugs, toggleFavorite } = useFavoriteRestaurants()
  const {
    loading,
    reservations,
    claimedPromotions,
    restaurants,
    level,
    levelProgress,
    xpToNext,
    state,
  } = useCustomerGamificationContext()
  const [reviews, setReviews] = useState<CustomerReviewSummary[]>([])
  const [productClaims, setProductClaims] = useState<ProductClaimRecord[]>([])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      listMyReviews(),
      user?.uid ? listProductClaims(user.uid) : Promise.resolve([]),
    ]).then(([reviewItems, claimItems]) => {
      if (!cancelled) {
        setReviews(reviewItems)
        setProductClaims(claimItems)
      }
    })
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  const favoriteRestaurants = useMemo(
    () => restaurants.filter((restaurant) => favoriteSlugs.includes(restaurant.slug)),
    [restaurants, favoriteSlugs],
  )

  const activeReservations = useMemo(
    () => reservations.filter((reservation) => reservation.status !== 'cancelled').length,
    [reservations],
  )

  if (!profile || loading) {
    return <div className={styles.loading}>Cargando perfil…</div>
  }

  const levelNumber = level.level
  const stripTheme = getLevelRankingStripTheme(levelNumber)
  const bodyTheme = getLevelProfileBodyTheme(levelNumber)
  const levelBackground = getLevelProfileBackground(levelNumber)
  const progressPercent = Math.round(levelProgress * 100)

  const photo = profile.photoUrl
    ? optimizeCloudinaryUrl(profile.photoUrl, CLOUDINARY_DISPLAY.photoPreview)
    : ''

  const locationLabel = [profile.homeCity, profile.homeMunicipality].filter(Boolean).join(', ')
  const profileHandle = `@${profile.email.split('@')[0] ?? 'usuario'}`

  const pageStyle = {
    '--profile-accent': stripTheme.cardBorder,
    '--profile-accent-soft': `color-mix(in srgb, ${stripTheme.cardBorder} 22%, transparent)`,
    '--profile-glow': bodyTheme.pageGlow,
    '--profile-pill-number-bg': bodyTheme.pillNumberBg,
    '--profile-pill-number-color': bodyTheme.pillNumberColor,
    '--profile-pill-title-bg': bodyTheme.pillTitleBg,
    '--profile-pill-title-color': bodyTheme.pillTitleColor,
    '--profile-chip-bg': bodyTheme.chipBg,
    '--profile-chip-text': bodyTheme.pillTitleColor,
    '--profile-chip-border': bodyTheme.chipBorder,
  } as CSSProperties

  return (
    <div className={styles.page} style={pageStyle}>
      <div className={styles.pageBackdrop} aria-hidden="true">
        <img src={levelBackground} alt="" className={styles.pageBgArt} />
        <div className={styles.pageBgOverlay} />
        <div className={styles.pageBgGlow} />
      </div>

      <div className={styles.content}>
        <header className={styles.topBar}>
          <p className={styles.eyebrow}>Tu perfil</p>
          <Link to="/cuenta/completar-perfil?edit=1" className={styles.editLink}>
            Editar
          </Link>
        </header>

        <section className={styles.showcase}>
          <GamificationRankingStripCard
            level={levelNumber}
            levelTitle={level.title}
            displayName={profile.displayName}
            xp={state.xp}
            levelProgress={levelProgress}
            photoUrl={photo || undefined}
            highlight
            profileSize
            className={styles.heroStrip}
          />

          <div className={styles.levelPill} aria-label={`Nivel ${levelNumber}, ${level.title}`}>
            <span className={styles.levelPillNumber}>Nivel {levelNumber}</span>
            <span className={styles.levelPillTitle}>{level.title}</span>
          </div>

          <div className={styles.identityMeta}>
            <span className={styles.handle}>{profileHandle}</span>
            {locationLabel ? <span className={styles.location}>📍 {locationLabel}</span> : null}
          </div>

          <p className={styles.progressHint}>
            {progressPercent}% al siguiente nivel
            {xpToNext != null
              ? ` · faltan ${xpToNext.toLocaleString('es-ES')} XP`
              : null}
          </p>
        </section>

        <section className={styles.metrics}>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon} aria-hidden="true">⚡</span>
            <strong>{state.xp.toLocaleString('es-ES')}</strong>
            <span>XP total</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon} aria-hidden="true">📅</span>
            <strong>{activeReservations}</strong>
            <span>Reservas</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon} aria-hidden="true">❤️</span>
            <strong>{favoriteRestaurants.length}</strong>
            <span>Favoritos</span>
          </div>
        </section>

        <section className={styles.quickGrid}>
          <Link to="/app/misiones" className={`${styles.quickCard} ${styles.quick_coral}`}>
            <span className={styles.quickIcon} aria-hidden="true">🏆</span>
            <strong>Misiones</strong>
            <span>Sube de nivel</span>
          </Link>
          <Link to="/app/reservas" className={`${styles.quickCard} ${styles.quick_gold}`}>
            <span className={styles.quickIcon} aria-hidden="true">📅</span>
            <strong>Reservas</strong>
            <span>Por ir y hechas</span>
          </Link>
          <Link to="/app/promociones" className={`${styles.quickCard} ${styles.quick_magenta}`}>
            <span className={styles.quickIcon} aria-hidden="true">🎁</span>
            <strong>Promos</strong>
            <span>Exclusivas</span>
          </Link>
          <Link to="/app/explorar" className={`${styles.quickCard} ${styles.quick_sunset}`}>
            <span className={styles.quickIcon} aria-hidden="true">🔍</span>
            <strong>Buscar</strong>
            <span>Nuevo local</span>
          </Link>
        </section>

        {profile.foodPreferences.length > 0 && (
          <section className={styles.panel}>
            <h2>Tus gustos</h2>
            <div className={styles.chips}>
              {profile.foodPreferences.map((item) => (
                <span key={item} className={styles.chip}>
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Promos y reseñas</h2>
            <span>{claimedPromotions.length + reviews.length + productClaims.length}</span>
          </div>
          {claimedPromotions.length === 0 && reviews.length === 0 && productClaims.length === 0 ? (
            <div className={styles.emptyFavorites}>
              <p>Tus canjes y reseñas aparecen aquí, fuera del documento de perfil.</p>
              <Link to="/app/promociones">Ver promociones</Link>
            </div>
          ) : (
            <ul className={styles.activityList}>
              {claimedPromotions.slice(0, 4).map((claim) => (
                <li key={`${claim.promotionId}-${claim.claimedAt}`} className={styles.activityItem}>
                  <strong>{claim.title}</strong>
                  <span>{claim.companyName}</span>
                </li>
              ))}
              {reviews.slice(0, 4).map((review) => (
                <li key={review.id} className={styles.activityItem}>
                  <strong>{review.companyName}</strong>
                  <span>
                    {review.rating} Adelinas
                    {review.commentExcerpt ? ` · ${review.commentExcerpt}` : ''}
                  </span>
                </li>
              ))}
              {productClaims.slice(0, 4).map((claim) => (
                <li key={claim.id} className={styles.activityItem}>
                  <strong>Consumo verificado</strong>
                  <span>
                    {(claim.totalCents / 100).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Favoritos</h2>
            <span>{favoriteRestaurants.length}</span>
          </div>

          {favoriteRestaurants.length === 0 ? (
            <div className={styles.emptyFavorites}>
              <p>Toca el corazón en un restaurante para guardarlo. También cuenta para misiones.</p>
              <Link to="/app/explorar">Ir a buscar</Link>
            </div>
          ) : (
            <div className={styles.favoritesGrid}>
              {favoriteRestaurants.map((restaurant, index) => {
                const imageUrl = restaurant.photoUrl
                  ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoGallery)
                  : ''
                const accent = QUICK_ACCENTS[index % QUICK_ACCENTS.length]

                return (
                  <article
                    key={restaurant.slug}
                    className={`${styles.favoriteCard} ${styles[`favorite_${accent}`]}`}
                  >
                    <Link to={`/reservar/${restaurant.slug}`} className={styles.favoriteMediaLink}>
                      {imageUrl ? (
                        <img src={imageUrl} alt="" />
                      ) : (
                        <div className={styles.favoriteFallback} aria-hidden="true">
                          🍷
                        </div>
                      )}
                      <div className={styles.favoriteOverlay}>
                        <h3>{restaurant.name}</h3>
                        <p>{restaurant.municipality || restaurant.location}</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      className={styles.unfavorite}
                      onClick={() => toggleFavorite(restaurant.slug)}
                      aria-label={`Quitar ${restaurant.name} de favoritos`}
                    >
                      ✕
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <div className={styles.legalRow}>
          <LegalLinks from="/app/perfil" />
        </div>
        <div className={styles.actions}>
          <Link to="/cuenta/completar-perfil?edit=1" className={styles.secondaryBtn}>
            Editar preferencias
          </Link>
          <button type="button" className={styles.logoutBtn} onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

export default CustomerProfileTab
