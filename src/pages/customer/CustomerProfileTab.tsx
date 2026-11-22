import type { PublicDiscoveryRestaurant } from '../../utils/publicDiscovery'
import { browseListFrom } from '../../utils/restaurantBrowse'
import { fetchDiscoveryRestaurantsBySlugs } from '../../services/publicDiscovery'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import LevelPlayerCard from '../../components/LevelPlayerCard'
import { useAuth } from '../../context/AuthContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import { logout } from '../../services/auth'
import { deleteCustomerAccount } from '../../services/customerAccount'
import { useFavoriteRestaurants } from '../../hooks/useFavoriteRestaurants'
import { listMyReviews, type CustomerReviewSummary } from '../../services/userReviews'
import { listProductClaims, type ProductClaimRecord } from '../../services/productClaims'
import { getLevelProfileBackground } from '../../utils/levelProfileBackground'
import { getLevelProfileBodyTheme } from '../../utils/levelProfileBodyThemes'
import { getLevelRankingStripTheme } from '../../utils/levelRankingStripThemes'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../../utils/cloudinaryUrl'
import LegalLinks from '../../components/LegalLinks'
import SupportMessageModal from '../../components/SupportMessageModal'
import CustomerPreferencesCard from '../../components/CustomerPreferencesCard'
import { cleanReviewExcerpt } from '../../utils/reviewCommentTags'
import styles from './CustomerProfileTab.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

const QUICK_ACCENTS = ['coral', 'gold', 'magenta', 'sunset'] as const

function CustomerProfileTab() {
  const { profile, user, refreshProfile } = useAuth()
  const { favoriteSlugs, isUpdatingFavorite, toggleFavorite } = useFavoriteRestaurants()
  const {
    loading,
    displayReservations,
    claimedPromotions,
    restaurants,
    level,
    levelProgress,
    xpToNext,
    state,
  } = useCustomerGamificationContext()
  const [reviews, setReviews] = useState<CustomerReviewSummary[]>([])
  const [productClaims, setProductClaims] = useState<ProductClaimRecord[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  // Los restaurantes cargados son los de tus reservas: un favorito donde aún no
  // has reservado se pide aparte (antes no salía y el contador se quedaba corto).
  const [extraFavorites, setExtraFavorites] = useState<PublicDiscoveryRestaurant[]>([])
  const missingFavoriteKey = favoriteSlugs
    .filter((slug) => !restaurants.some((restaurant) => restaurant.slug.trim().toLowerCase() === slug))
    .join(',')
  useEffect(() => {
    if (!missingFavoriteKey) {
      setExtraFavorites([])
      return
    }
    let cancelled = false
    void fetchDiscoveryRestaurantsBySlugs(missingFavoriteKey.split(','))
      .then((items) => {
        if (!cancelled) setExtraFavorites(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [missingFavoriteKey])

  const favoriteRestaurants = useMemo(
    () => [...restaurants, ...extraFavorites].filter((restaurant, index, list) =>
      favoriteSlugs.includes(restaurant.slug.trim().toLowerCase())
      && list.findIndex((other) => other.slug === restaurant.slug) === index,
    ),
    [restaurants, extraFavorites, favoriteSlugs],
  )

  // Todas, también las hechas como invitado con tu correo: igual que «Mis reservas» y la app.
  const activeReservations = useMemo(
    () => displayReservations.filter((reservation) => reservation.status !== 'cancelled').length,
    [displayReservations],
  )

  async function handleDeleteAccount() {
    setDeleteError('')
    setDeleting(true)
    try {
      await deleteCustomerAccount(deleteConfirm.trim())
      await logout()
    } catch (error) {
      setDeleteError(friendlyErrorMessage(error, 'No se pudo eliminar la cuenta.'))
      setDeleting(false)
    }
  }

  if (!profile || loading) {
    return <div className={styles.loading}>Cargando perfil…</div>
  }

  const levelNumber = level.level
  const stripTheme = getLevelRankingStripTheme(levelNumber)
  const bodyTheme = getLevelProfileBodyTheme(levelNumber)
  const levelBackground = getLevelProfileBackground(levelNumber)

  const photo = profile.photoUrl
    ? optimizeCloudinaryUrl(profile.photoUrl, CLOUDINARY_DISPLAY.photoPreview)
    : ''

  // Antes salía el principio del correo; ahora el @usuario elegido.
  const profileHandle = profile.username ? `@${profile.username}` : ''

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
          <LevelPlayerCard
            level={levelNumber}
            levelTitle={level.title}
            displayName={profile.displayName}
            username={profile.username || undefined}
            xp={state.xp}
            levelProgress={levelProgress}
            photoUrl={photo || undefined}
            location={[profile.homeCity, profile.homeCountry].filter(Boolean).join(' · ') || undefined}
          />

          {!profileHandle ? (
            <div className={styles.identityMeta}>
              <Link to="/cuenta/completar-perfil?edit=1" className={styles.handle}>Elige tu @usuario</Link>
            </div>
          ) : null}
          {xpToNext != null ? (
            <p className={styles.progressHint}>Te faltan {xpToNext.toLocaleString('es-ES')} XP para subir de nivel</p>
          ) : null}
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
            <strong>Reservas y consumo</strong>
            <span>Por ir, pasadas y visitas</span>
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
                    {review.commentExcerpt ? ` · ${cleanReviewExcerpt(review.commentExcerpt)}` : ''}
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
                    <Link to={`/reservar/${restaurant.slug}`}
                      state={{ browse: browseListFrom(favoriteRestaurants, restaurant.slug) }} className={styles.favoriteMediaLink}>
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
                      disabled={isUpdatingFavorite(restaurant.slug)}
                      aria-busy={isUpdatingFavorite(restaurant.slug)}
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

        <CustomerPreferencesCard
          birthday={profile?.birthday ?? ''}
          hideFromRanking={profile?.hideFromRanking === true}
          hideVisitsFromFriends={profile?.hideVisitsFromFriends === true}
          onSaved={refreshProfile}
        />

        <div className={styles.legalRow}>
          <LegalLinks from="/app/perfil" />
        </div>
        <div className={styles.actions}>
          <Link to="/cuenta/completar-perfil?edit=1" className={styles.secondaryBtn}>
            Editar preferencias
          </Link>
          {/* Quien entra con Google o Apple no tiene contraseña de Adelia que cambiar. */}
          {user?.providerData.some((provider) => provider.providerId === 'password') ? (
            <Link to="/cuenta/cambiar-contrasena" className={styles.secondaryBtn}>
              Cambiar contraseña
            </Link>
          ) : null}
          <button type="button" className={styles.secondaryBtn} onClick={() => setSuggestionOpen(true)}>
            Enviar una sugerencia
          </button>
          <button type="button" className={styles.logoutBtn} onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>

        {suggestionOpen ? (
          <SupportMessageModal kind="suggestion" onClose={() => setSuggestionOpen(false)} />
        ) : null}

        <section className={styles.deleteSection} aria-labelledby="delete-account-title">
          <h2 id="delete-account-title">Eliminar cuenta</h2>
          <p>
            Borra tu perfil, Compite, amigos y datos de cuenta. Las reservas pasadas se anonimizan
            para el restaurante. Esta acción no se puede deshacer.
          </p>
          {!deleteOpen ? (
            <button
              type="button"
              className={styles.deleteOpenBtn}
              onClick={() => {
                setDeleteOpen(true)
                setDeleteError('')
              }}
            >
              Quiero eliminar mi cuenta
            </button>
          ) : (
            <div className={styles.deletePanel}>
              <label htmlFor="delete-confirm">
                Escribe <strong>ELIMINAR</strong> para confirmar
              </label>
              <input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                autoComplete="off"
                disabled={deleting}
              />
              {deleteError ? <p className={styles.deleteError} role="alert">{deleteError}</p> : null}
              <div className={styles.deleteActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={deleting}
                  onClick={() => {
                    setDeleteOpen(false)
                    setDeleteConfirm('')
                    setDeleteError('')
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.deleteConfirmBtn}
                  disabled={deleting || deleteConfirm.trim().toUpperCase() !== 'ELIMINAR'}
                  onClick={() => void handleDeleteAccount()}
                >
                  {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default CustomerProfileTab
