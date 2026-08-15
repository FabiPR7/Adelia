import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { formatDepositAuthorizationSummary } from '../../utils/reservationDeposit'
import styles from './ReservationDepositPayment.module.css'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ?? ''

export interface ReservationDepositPaymentHandle {
  confirmDeposit: () => Promise<void>
}

interface ReservationDepositPaymentProps {
  clientSecret: string
  stripeAccountId: string
  amountCents: number
  pax: number
  perGuestCents: number
  cancellationHours?: number | null
  onReadyChange?: (ready: boolean) => void
  onError?: (message: string | null) => void
}

export function formatDepositEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

function LockIcon() {
  return (
    <span className={styles.lockIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M7 10V8a5 5 0 0 1 10 0v2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <rect
          x="5"
          y="10"
          width="14"
          height="11"
          rx="2.2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
        <path
          d="M12 16.7v1.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

const DepositPaymentFields = forwardRef<
  ReservationDepositPaymentHandle,
  Omit<ReservationDepositPaymentProps, 'clientSecret' | 'stripeAccountId'>
>(function DepositPaymentFields({ amountCents, pax, perGuestCents, cancellationHours, onReadyChange }, ref) {
  const stripe = useStripe()
  const elements = useElements()

  useEffect(() => {
    onReadyChange?.(Boolean(stripe && elements))
  }, [stripe, elements, onReadyChange])

  useImperativeHandle(ref, () => ({
    confirmDeposit: async () => {
      if (!stripe || !elements) {
        throw new Error('El formulario de pago aún no está listo.')
      }

      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      })

      if (result.error) {
        throw new Error(result.error.message ?? 'No se pudo autorizar la fianza.')
      }

      const status = result.paymentIntent?.status

      if (
        status
        && status !== 'requires_capture'
        && status !== 'processing'
        && status !== 'succeeded'
      ) {
        throw new Error('La fianza no quedó autorizada. Revisa los datos de la tarjeta e inténtalo de nuevo.')
      }
    },
  }), [stripe, elements])

  return (
    <div className={styles.panel}>
      <div className={styles.policy}>
        <p className={styles.policyText}>
          {formatDepositAuthorizationSummary(pax, perGuestCents, cancellationHours)}
        </p>
      </div>

      <div className={styles.secureCard}>
        <header className={styles.secureHeader}>
          <div className={styles.secureTitleRow}>
            <LockIcon />
            <div>
              <h4 className={styles.secureHeading}>Pago seguro de la fianza</h4>
              <p className={styles.secureSubheading}>
                Introduce los datos de tu tarjeta. Solo se autoriza el importe, no se cobra ahora.
              </p>
            </div>
          </div>
          <span className={styles.amountBadge}>{formatDepositEuros(amountCents)}</span>
        </header>

        <div className={styles.paymentFields}>
          <PaymentElement
            options={{
              layout: 'tabs',
              wallets: {
                applePay: 'never',
                googlePay: 'never',
              },
            }}
          />
        </div>

        <footer className={styles.secureFooter}>
          <span>Conexión cifrada</span>
          <span className={styles.secureFooterDot} aria-hidden="true">·</span>
          <span className={styles.stripeBadge}>Procesado por Stripe</span>
          <span className={styles.secureFooterDot} aria-hidden="true">·</span>
          <span>No guardamos tu tarjeta</span>
        </footer>
      </div>
    </div>
  )
})

const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#5c4a3a',
    colorBackground: '#ffffff',
    colorText: '#3d3229',
    colorTextSecondary: '#6b5d52',
    colorTextPlaceholder: '#9a8b7e',
    colorDanger: '#b54a4a',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSizeBase: '15px',
    borderRadius: '10px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(92, 74, 58, 0.22)',
      boxShadow: 'none',
      padding: '12px 14px',
    },
    '.Input:focus': {
      border: '1px solid rgba(92, 74, 58, 0.55)',
      boxShadow: '0 0 0 3px rgba(92, 74, 58, 0.1)',
    },
    '.Label': {
      fontWeight: '600',
      fontSize: '13px',
      marginBottom: '6px',
    },
    '.Tab': {
      border: '1px solid rgba(92, 74, 58, 0.16)',
      boxShadow: 'none',
    },
    '.Tab--selected': {
      borderColor: 'rgba(92, 74, 58, 0.4)',
      boxShadow: '0 0 0 1px rgba(92, 74, 58, 0.12)',
    },
  },
}

const ReservationDepositPayment = forwardRef<
  ReservationDepositPaymentHandle,
  ReservationDepositPaymentProps
>(function ReservationDepositPayment({
  clientSecret,
  stripeAccountId,
  amountCents,
  pax,
  perGuestCents,
  cancellationHours,
  onReadyChange,
  onError,
}, ref) {
  const stripePromise = useMemo(() => {
    if (!publishableKey || !stripeAccountId) {
      return null
    }

    return loadStripe(publishableKey, { stripeAccount: stripeAccountId })
  }, [stripeAccountId])

  const options = useMemo(
    () => ({
      clientSecret,
      locale: 'es' as const,
      appearance: stripeAppearance,
    }),
    [clientSecret],
  )

  if (!publishableKey) {
    return (
      <p className={styles.error}>
        Falta configurar Stripe en el entorno (`VITE_STRIPE_PUBLISHABLE_KEY`).
      </p>
    )
  }

  if (!stripePromise) {
    return (
      <div className={styles.loadingCard}>
        <span className={styles.loadingSpinner} aria-hidden="true" />
        <span>Preparando pago seguro…</span>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <DepositPaymentFields
        ref={ref}
        amountCents={amountCents}
        pax={pax}
        perGuestCents={perGuestCents}
        cancellationHours={cancellationHours}
        onReadyChange={onReadyChange}
        onError={onError}
      />
    </Elements>
  )
})

export default ReservationDepositPayment
