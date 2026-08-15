import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canRedeemPromotionAsCustomer } from '../utils/promotionBooking'
import styles from './MenuPromotionsFab.module.css'

interface MenuPromotionsFabProps {
  slug: string
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.giftSvg} aria-hidden="true">
      <path
        d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8M4 7h16M12 7v15M12 7H8.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Zm0 0h3.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7ZM7 7h10v5H7V7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.tagSvg} aria-hidden="true">
      <path
        d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82ZM7 7h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MenuPromotionsFab({ slug }: MenuPromotionsFabProps) {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const [authPromptOpen, setAuthPromptOpen] = useState(false)

  const promotionsHref = `/reservar/${encodeURIComponent(slug)}/promociones`
  const authRedirect = encodeURIComponent(promotionsHref)

  const handleClick = () => {
    if (isLoading) {
      return
    }

    if (canRedeemPromotionAsCustomer(user, profile)) {
      navigate(promotionsHref)
      return
    }

    setAuthPromptOpen(true)
  }

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={handleClick}
        aria-label="Ver ofertas, regalos y descuentos"
        disabled={isLoading}
      >
        <span className={styles.fabGlow} aria-hidden="true" />
        <span className={styles.iconCluster} aria-hidden="true">
          <span className={styles.mainIconWrap}>
            <GiftIcon />
          </span>
          <span className={`${styles.miniBadge} ${styles.miniBadgeDiscount}`}>
            <TagIcon />
            <span>%</span>
          </span>
          <span className={`${styles.miniBadge} ${styles.miniBadgeFree}`}>2×1</span>
        </span>
        <span className={styles.fabCopy}>
          <strong>Ofertas</strong>
          <small>Gratis · Descuentos</small>
        </span>
      </button>

      {authPromptOpen ? (
        <div
          className={styles.overlay}
          onClick={() => setAuthPromptOpen(false)}
          role="presentation"
        >
          <div
            className={styles.dialog}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-promos-auth-title"
          >
            <div className={styles.dialogHero} aria-hidden="true">
              <span className={styles.dialogIconWrap}>
                <GiftIcon />
              </span>
              <div className={styles.dialogChips}>
                <span className={styles.dialogChip}>🎁 Regalos</span>
                <span className={styles.dialogChip}>% Descuentos</span>
                <span className={styles.dialogChip}>2×1 Gratis</span>
              </div>
            </div>
            <h2 id="menu-promos-auth-title">Regístrate como usuario</h2>
            <p>
              Para ver y canjear ofertas necesitas una cuenta de cliente en Adelia. Es gratis y no
              es la cuenta de restaurante.
            </p>
            <div className={styles.actions}>
              <Link
                to={`/cuenta/registro?redirect=${authRedirect}`}
                className={styles.primaryAction}
              >
                Registrarme como usuario
              </Link>
              <Link
                to={`/cuenta/entrar?redirect=${authRedirect}`}
                className={styles.secondaryAction}
              >
                Ya tengo cuenta de usuario
              </Link>
            </div>
            <button
              type="button"
              className={styles.dismissButton}
              onClick={() => setAuthPromptOpen(false)}
            >
              Ahora no
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default MenuPromotionsFab
