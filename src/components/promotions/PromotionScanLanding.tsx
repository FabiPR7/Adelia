import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { isCustomerPromoLocked } from '../../data/cancellationPenalties'
import { useAuth } from '../../context/AuthContext'
import type { PublicPromotion } from '../../services/publicPromotions'
import {
  buildPromotionBookingHref,
  canRedeemPromotionAsCustomer,
} from '../../utils/promotionBooking'
import { formatPromotionMinimumSpendBookingNote } from '../../utils/promotionOffer'
import PromotionOfferCard from './PromotionOfferCard'
import styles from './PromotionScanLanding.module.css'

interface PromotionScanLandingProps {
  promotion: PublicPromotion
  variant?: 'public' | 'preview'
  onClosePreview?: () => void
}

const SPARKS = [
  { left: '8%', top: '18%', delay: 0.18, size: 7 },
  { left: '88%', top: '14%', delay: 0.26, size: 5 },
  { left: '14%', top: '68%', delay: 0.34, size: 6 },
  { left: '92%', top: '58%', delay: 0.22, size: 8 },
  { left: '4%', top: '42%', delay: 0.4, size: 4 },
  { left: '78%', top: '78%', delay: 0.3, size: 5 },
  { left: '48%', top: '6%', delay: 0.16, size: 6 },
  { left: '62%', top: '88%', delay: 0.44, size: 4 },
] as const

const easeOut = [0.16, 1, 0.3, 1] as const

function PromotionScanLanding({
  promotion,
  variant = 'public',
  onClosePreview,
}: PromotionScanLandingProps) {
  const { user, profile, isLoading: authLoading } = useAuth()
  const reduceMotion = useReducedMotion()
  const isPreview = variant === 'preview'
  const canRedeem = canRedeemPromotionAsCustomer(user, profile)
  const promoLocked = isCustomerPromoLocked(profile)
  const landingPath = `/reservar/${encodeURIComponent(promotion.companySlug)}/promo/${encodeURIComponent(promotion.id)}`
  const bookingHref = buildPromotionBookingHref(promotion.companySlug, promotion.id)
  const registerHref = `/cuenta/registro?redirect=${encodeURIComponent(landingPath)}`
  const loginHref = `/cuenta/entrar?redirect=${encodeURIComponent(landingPath)}`
  const minSpendNote = formatPromotionMinimumSpendBookingNote(promotion)
  const backdropUrl = promotion.photoUrl || promotion.companyPhotoUrl
  const showGuestCtas = isPreview || (!authLoading && !canRedeem)
  const showLockedCtas = !isPreview && !authLoading && canRedeem && promoLocked
  const showRedeemCtas = !isPreview && !authLoading && canRedeem && !promoLocked
  const description = promotion.description.trim()
  const instant = reduceMotion ? 0 : undefined

  return (
    <motion.div
      className={styles.page}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      {backdropUrl ? (
        <motion.div
          className={styles.backdrop}
          style={{ backgroundImage: `url(${backdropUrl})` }}
          aria-hidden="true"
          initial={reduceMotion ? false : { scale: 1.28, opacity: 0 }}
          animate={{ scale: 1.12, opacity: 0.5 }}
          transition={{ duration: 1.15, ease: easeOut }}
        />
      ) : null}
      <div className={styles.veil} aria-hidden="true" />
      <div className={styles.flare} aria-hidden="true" />

      {SPARKS.map((spark, index) => (
        <motion.span
          key={index}
          className={styles.spark}
          style={{ left: spark.left, top: spark.top, width: spark.size, height: spark.size }}
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.35, 1], scale: [0, 1.35, 0.85, 1] }}
          transition={{ delay: instant ?? spark.delay, duration: 1.4, ease: easeOut }}
        />
      ))}

      <div className={styles.shell}>
        {isPreview ? (
          <div className={styles.previewBar}>
            <span>Vista previa · así lo ven al escanear el QR</span>
            {onClosePreview ? (
              <button type="button" className={styles.closePreview} onClick={onClosePreview}>
                Cerrar
              </button>
            ) : null}
          </div>
        ) : (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: instant ?? 0.15, duration: 0.4 }}
          >
            <Link to={`/reservar/${promotion.companySlug}`} className={styles.backLink}>
              ← {promotion.companyName}
            </Link>
          </motion.div>
        )}

        <motion.p
          className={styles.kicker}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: instant ?? 0.28, duration: 0.45, ease: easeOut }}
        >
          Premio exclusivo
        </motion.p>
        <motion.h1
          className={styles.headline}
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: instant ?? 0.38, duration: 0.5, ease: easeOut }}
        >
          {showRedeemCtas ? 'Este premio es tuyo' : 'Gánalo ahora'}
        </motion.h1>

        <motion.div
          className={styles.placeChip}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: instant ?? 0.48, duration: 0.4, ease: easeOut }}
        >
          {promotion.companyPhotoUrl ? (
            <img src={promotion.companyPhotoUrl} alt="" />
          ) : (
            <span className={styles.placeFallback} aria-hidden="true">
              🍽
            </span>
          )}
          <span>{promotion.companyName}</span>
        </motion.div>

        <motion.div
          className={styles.hero}
          initial={reduceMotion ? false : { opacity: 0, y: 72, scale: 0.62, rotate: -8 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 260, damping: 16, mass: 0.85, delay: 0.12 }
          }
        >
          <span className={styles.heroGlow} aria-hidden="true" />
          <span className={styles.heroShine} aria-hidden="true" />
          <PromotionOfferCard promotion={promotion} index={0} hero />
        </motion.div>

        {description ? (
          <motion.p
            className={styles.blurb}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: instant ?? 0.62, duration: 0.4 }}
          >
            {description}
          </motion.p>
        ) : null}

        {minSpendNote ? (
          <motion.p
            className={styles.minSpend}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: instant ?? 0.7, duration: 0.35 }}
          >
            {minSpendNote}
          </motion.p>
        ) : null}

        <motion.div
          className={styles.actions}
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: instant ?? 0.72, duration: 0.5, ease: easeOut }}
        >
          {showGuestCtas ? (
            <>
              <Link to={registerHref} className={styles.primaryCta}>
                Quiero este premio
              </Link>
              <Link to={loginHref} className={styles.secondaryCta}>
                Ya tengo cuenta
              </Link>
              <p className={styles.ctaHint}>Gratis · tarda unos segundos</p>
            </>
          ) : null}

          {showLockedCtas ? (
            <>
              <p className={styles.lockNote}>
                Tienes las promociones bloqueadas. Puedes reservar mesa sin canjear el premio.
              </p>
              <Link to={`/reservar/${promotion.companySlug}?reservar=1`} className={styles.primaryCta}>
                Reservar mesa
              </Link>
            </>
          ) : null}

          {showRedeemCtas ? (
            <Link to={bookingHref} className={styles.primaryCta}>
              Reclamar ahora
            </Link>
          ) : null}
        </motion.div>
      </div>
    </motion.div>
  )
}

export default PromotionScanLanding
