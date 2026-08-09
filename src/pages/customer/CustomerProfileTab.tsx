import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import GamificationRankingStripCard from '../../components/GamificationRankingStripCard'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../services/auth'
import { getAllCompanies, getCustomerReservations } from '../../services/firestore'
import { useCustomerGamification } from '../../hooks/useCustomerGamification'
import { useFavoriteRestaurants } from '../../hooks/useFavoriteRestaurants'
import { fetchPublicPromotions } from '../../services/publicPromotions'
import { hasRestaurantProfile } from '../../utils/publicBooking'
import {
  mapCompanyToDiscoveryRestaurant,
  mapCompanyToPublicBooking,
  type PublicDiscoveryRestaurant,
} from '../../utils/publicDiscovery'
import { getLevelProfileBackground } from '../../utils/levelProfileBackground'
import { getLevelProfileBodyTheme } from '../../utils/levelProfileBodyThemes'
import { getLevelRankingStripTheme } from '../../utils/levelRankingStripThemes'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import styles from './CustomerProfileTab.module.css'

const QUICK_ACCENTS = ['coral', 'gold', 'magenta', 'sunset'] as const

function CustomerProfileTab() {
  const { profile } = useAuth()
  const { favoriteSlugs, toggleFavorite } = useFavoriteRestaurants()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [reservations, setReservations] = useState<Awaited<ReturnType<typeof getCustomerReservations>>>([])
  const [promotionCompanyIds, setPromotionCompanyIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) {
      return
    }

    let cancelled = false

    void Promise.all([
      getAllCompanies().then((companies) =>
        companies
          .filter((company) => hasRestaurantProfile(mapCompanyToPublicBooking(company)))
          .map(mapCompanyToDiscoveryRestaurant),
      ),
      getCustomerReservations(profile.email),
      fetchPublicPromotions().catch(() => []),
    ])
      .then(([restaurantData, reservationData, promotions]) => {
        if (!cancelled) {
          setRestaurants(restaurantData)
          setReservations(reservationData)
          setPromotionCompanyIds(new Set(promotions.map((promotion) => promotion.companyId)))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile])

  const favoriteRestaurants = useMemo(
    () => restaurants.filter((restaurant) => favoriteSlugs.includes(restaurant.slug)),
    [restaurants, favoriteSlugs],
  )

  const activeReservations = useMemo(
    () => reservations.filter((reservation) => reservation.status !== 'cancelled').length,
    [reservations],
  )

  const gamification = useCustomerGamification({
    reservations,
    favoriteSlugs,
    restaurants,
    promotionCompanyIds,
    enabled: Boolean(profile),
  })

  if (!profile || loading) {
    return <div className={styles.loading}>Cargando perfil…</div>
  }

  const level = gamification.level.level
  const stripTheme = getLevelRankingStripTheme(level)
  const bodyTheme = getLevelProfileBodyTheme(level)
  const levelBackground = getLevelProfileBackground(level)
  const progressPercent = Math.round(gamification.levelProgress * 100)

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
            level={level}
            levelTitle={gamification.level.title}
            displayName={profile.displayName}
            xp={gamification.state.xp}
            levelProgress={gamification.levelProgress}
            photoUrl={photo || undefined}
            highlight
            profileSize
            className={styles.heroStrip}
          />

          <div className={styles.levelPill} aria-label={`Nivel ${level}, ${gamification.level.title}`}>
            <span className={styles.levelPillNumber}>Nivel {level}</span>
            <span className={styles.levelPillTitle}>{gamification.level.title}</span>
          </div>

          <div className={styles.identityMeta}>
            <span className={styles.handle}>{profileHandle}</span>
            {locationLabel ? <span className={styles.location}>📍 {locationLabel}</span> : null}
          </div>

          <p className={styles.progressHint}>
            {progressPercent}% al siguiente nivel
            {gamification.xpToNext != null
              ? ` · faltan ${gamification.xpToNext.toLocaleString('es-ES')} XP`
              : null}
          </p>
        </section>

        <section className={styles.metrics}>
          <div className={styles.metricCard}>
            <span className={styles.metricIcon} aria-hidden="true">⚡</span>
            <strong>{gamification.state.xp.toLocaleString('es-ES')}</strong>
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
            <h2>Favoritos</h2>
            <span>{favoriteRestaurants.length}</span>
          </div>

          {favoriteRestaurants.length === 0 ? (
            <div className={styles.emptyFavorites}>
              <p>Guarda restaurantes mientras exploras el carrusel.</p>
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
