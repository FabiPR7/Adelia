import { useEffect, useState } from 'react'
import { getCompanyPlan } from '../data/companyPlans'
import { LIFETIME_OFFER, lifetimeOfferHref, lifetimeOfferTimeLeft } from '../data/lifetimeOffer'
import styles from './LifetimeOfferHero.module.css'

interface LifetimeOfferHeroProps {
  companyId?: string | null
  /** "Ahora no": baja a los planes mensuales y anuales. */
  onSeePlans: () => void
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <span className={styles.timeBox}>
      <strong>{String(value).padStart(2, '0')}</strong>
      <span>{label}</span>
    </span>
  )
}

/** Ventana de la oferta de lanzamiento: lo primero que se ve en los precios. */
function LifetimeOfferHero({ companyId, onSeePlans }: LifetimeOfferHeroProps) {
  const [left, setLeft] = useState(() => lifetimeOfferTimeLeft())
  const local = getCompanyPlan('premium')
  const monthly = local.priceMonthly
  // Meses de cuota que cuesta la oferta: se amortiza enseguida.
  const monthsToPayOff = monthly > 0 ? Math.ceil(LIFETIME_OFFER.price / monthly) : null

  useEffect(() => {
    const timer = window.setInterval(() => setLeft(lifetimeOfferTimeLeft()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className={styles.hero} aria-labelledby="lifetime-offer-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            Oferta de lanzamiento · solo hasta el 1/1/2027
          </p>
          <h2 id="lifetime-offer-title" className={styles.title}>
            Adelia {LIFETIME_OFFER.planName} <em>para siempre</em>
          </h2>
          <p className={styles.lead}>
            Un único pago y no vuelves a pagar nunca más. Todo el plan {LIFETIME_OFFER.planName}, con las
            mejoras que vayan llegando, mientras exista tu restaurante en Adelia.
          </p>

          <ul className={styles.perks}>
            {local.chips.slice(0, 5).map((chip) => (
              <li key={chip}>{chip}</li>
            ))}
            <li>Sin cuotas</li>
            <li>Sin comisión por reserva</li>
          </ul>

          <div className={styles.countdown} aria-label="Tiempo que queda de oferta">
            <span className={styles.countdownLabel}>La oferta termina en</span>
            <div className={styles.timeRow}>
              <TimeBox value={left.days} label="días" />
              <TimeBox value={left.hours} label="horas" />
              <TimeBox value={left.minutes} label="min" />
            </div>
          </div>
        </div>

        <div className={styles.priceCard}>
          <p className={styles.priceEyebrow}>Pago único</p>
          <p className={styles.price}>
            <span className={styles.amount}>{LIFETIME_OFFER.priceLabel}</span>
            <span className={styles.currency}>€</span>
          </p>
          <p className={styles.priceNote}>
            {monthly > 0 ? (
              <>
                + IVA · en vez de <s>{monthly.toFixed(2).replace('.', ',')} € al mes</s>
                {monthsToPayOff ? ` · lo amortizas en ${monthsToPayOff} meses` : ''}
              </>
            ) : '+ IVA · para siempre'}
          </p>
          <a className={styles.buy} href={lifetimeOfferHref(companyId)}>
            Lo quiero de por vida
          </a>
          <p className={styles.secure}>
            {LIFETIME_OFFER.checkoutUrl
              ? 'Pago seguro con Lemon Squeezy · Factura incluida'
              : 'Escríbenos y te reservamos la oferta antes de que termine'}
          </p>
          <button type="button" className={styles.skip} onClick={onSeePlans}>
            Ahora no, ver planes mensuales y anuales ↓
          </button>
        </div>
      </div>
    </section>
  )
}

export default LifetimeOfferHero
