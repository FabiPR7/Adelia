import { useEffect, useMemo, useRef, useState } from 'react'
import type { MenuNode } from '../../types/company'
import type { Reservation } from '../../types'
import type { PublicPromotion } from '../../services/publicPromotions'
import { verifyReservationMinimumSpend } from '../../services/minimumSpendApi'
import { normalizePromotionPinCode, validatePromotionPinCode } from '../../utils/promotionPin'
import {
  formatReservationPrizeDateTime,
  isTimeLimitedPromotionReservation,
} from '../../utils/reservationPromotionEligibility'
import { resolvePromotionHighlight } from '../../utils/promotionOffer'
import PromotionPhotoCollage from '../promotions/PromotionPhotoCollage'
import {
  buildProductCartLineItems,
  formatCentsAsEuros,
  formatMinimumSpendTarget,
  formatVerificationTotalLabel,
  parseEuroInputToCents,
  sumProductCartCents,
  type ProductCartQuantities,
} from '../../utils/minimumSpendVerification'
import MinSpendProductCart from './MinSpendProductCart'
import styles from './MinimumSpendVerificationModal.module.css'

type FlowStep = 'intro' | 'mode' | 'total' | 'products' | 'review' | 'pin' | 'success'
type CaptureMode = 'total' | 'products'

interface MinimumSpendVerificationModalProps {
  reservation: Reservation | null
  restaurantName: string
  promotion?: PublicPromotion | null
  menuNodes: MenuNode[]
  menuLoading: boolean
  onClose: () => void
  onVerified: (reservationId: string, result: Awaited<ReturnType<typeof verifyReservationMinimumSpend>>) => void
}

export default function MinimumSpendVerificationModal({
  reservation,
  restaurantName,
  promotion = null,
  menuNodes,
  menuLoading,
  onClose,
  onVerified,
}: MinimumSpendVerificationModalProps) {
  const [step, setStep] = useState<FlowStep>('intro')
  const [captureMode, setCaptureMode] = useState<CaptureMode>('products')
  const [totalInput, setTotalInput] = useState('')
  const [quantities, setQuantities] = useState<ProductCartQuantities>({})
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [meetsMinimumSpend, setMeetsMinimumSpend] = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const openedReservationIdRef = useRef<string | null>(null)

  const products = useMemo(
    () => menuNodes.filter(
      (node) => node.nodeType === 'product' && node.active && node.priceCents != null,
    ),
    [menuNodes],
  )

  const minimumSpendCents = reservation?.minimumSpendCents ?? 0
  const isTimeLimitedPromo = reservation
    ? isTimeLimitedPromotionReservation(reservation, promotion)
    : false
  const computedTotalCents = captureMode === 'total'
    ? (parseEuroInputToCents(totalInput) ?? 0)
    : sumProductCartCents(quantities, products)

  useEffect(() => {
    if (!reservation) {
      openedReservationIdRef.current = null
      return
    }

    if (openedReservationIdRef.current === reservation.id) {
      return
    }

    openedReservationIdRef.current = reservation.id
    setStep('intro')
    setCaptureMode('products')
    setTotalInput('')
    setQuantities({})
    setPin('')
    setError('')
    setSubmitting(false)
    setMeetsMinimumSpend(false)
  }, [reservation])

  useEffect(() => {
    if (step === 'pin') {
      pinInputRef.current?.focus()
    }
  }, [step])

  if (!reservation) {
    return null
  }

  if (minimumSpendCents <= 0) {
    return null
  }

  const handleContinueFromCapture = () => {
    if (captureMode === 'total') {
      const cents = parseEuroInputToCents(totalInput)
      if (cents == null) {
        setError('Indica un importe total válido.')
        return
      }
    } else if (buildProductCartLineItems(quantities, products).length === 0) {
      setError('Añade al menos un producto.')
      return
    }

    setError('')
    setStep('review')
  }

  const meetsDeclaredMinimum = computedTotalCents >= minimumSpendCents

  const handlePinSubmit = async () => {
    if (minimumSpendCents <= 0) {
      setError('Esta reserva no requiere verificación de gasto mínimo.')
      return
    }

    if (!meetsDeclaredMinimum) {
      setError('El consumo indicado no alcanza el gasto mínimo requerido.')
      return
    }
    const validationError = validatePromotionPinCode(pin)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const payload = captureMode === 'total'
        ? {
            pin,
            mode: 'total' as const,
            declaredTotalCents: parseEuroInputToCents(totalInput) ?? 0,
          }
        : {
            pin,
            mode: 'products' as const,
            productSelections: buildProductCartLineItems(quantities, products),
          }

      const result = await verifyReservationMinimumSpend(reservation.id, payload)
      setMeetsMinimumSpend(result.meetsMinimumSpend)
      onVerified(reservation.id, result)
      setStep('success')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo verificar el gasto mínimo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.dialog} ${step === 'success' && meetsMinimumSpend && isTimeLimitedPromo ? styles.dialogSuccess : ''}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="min-spend-title"
      >
        {step === 'intro' ? (
          <>
            <h2 id="min-spend-title" className={styles.title}>
              {isTimeLimitedPromo ? 'Verifica para reclamar tu premio' : 'Verificar gasto mínimo'}
            </h2>
            <p className={styles.message}>
              {isTimeLimitedPromo ? (
                <>
                  Verifica el gasto mínimo con productos de la carta o indicando el precio total
                  para reclamar <strong>{promotion?.title ?? 'tu premio'}</strong> en{' '}
                  <strong>{restaurantName}</strong>.
                </>
              ) : (
                <>
                  Muestra esta pantalla a un empleado de <strong>{restaurantName}</strong> para
                  verificar tu consumo y la promo.
                </>
              )}
            </p>
            <p className={styles.target}>
              Gasto mínimo requerido: <strong>{formatMinimumSpendTarget(minimumSpendCents)}</strong>
            </p>
            <div className={styles.actionsStack}>
              <button type="button" className={styles.primaryButton} onClick={() => setStep('mode')}>
                Continuar
              </button>
              <button type="button" className={styles.secondaryButton} onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        ) : null}

        {step === 'mode' ? (
          <>
            <h2 id="min-spend-title" className={styles.title}>¿Cómo quieres indicar el consumo?</h2>
            <div className={styles.modeGrid}>
              <button
                type="button"
                className={`${styles.modeCard} ${captureMode === 'products' ? styles.modeCardActive : ''}`}
                onClick={() => setCaptureMode('products')}
              >
                <strong>Productos de la carta</strong>
                <span>Elige platos y sumamos el total automáticamente.</span>
              </button>
              <button
                type="button"
                className={`${styles.modeCard} ${captureMode === 'total' ? styles.modeCardActive : ''}`}
                onClick={() => setCaptureMode('total')}
              >
                <strong>Importe total</strong>
                <span>Introduce el total de la cuenta directamente.</span>
              </button>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep('intro')}>
                Atrás
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setStep(captureMode === 'total' ? 'total' : 'products')}
              >
                Siguiente
              </button>
            </div>
          </>
        ) : null}

        {step === 'total' ? (
          <>
            <h2 id="min-spend-title" className={styles.title}>Importe total</h2>
            <p className={styles.message}>Indica el total consumido en el restaurante.</p>
            <label className={styles.totalField}>
              Total en euros
              <input
                type="text"
                inputMode="decimal"
                value={totalInput}
                placeholder="Ej. 24,50"
                onChange={(event) => {
                  setTotalInput(event.target.value)
                  setError('')
                }}
              />
            </label>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep('mode')}>
                Atrás
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleContinueFromCapture}>
                Revisar
              </button>
            </div>
          </>
        ) : null}

        {step === 'products' ? (
          <>
            <h2 id="min-spend-title" className={styles.title}>Productos consumidos</h2>
            {menuLoading ? (
              <p className={styles.message}>Cargando carta…</p>
            ) : (
              <MinSpendProductCart
                menuNodes={menuNodes}
                quantities={quantities}
                onChange={(next) => {
                  setQuantities(next)
                  setError('')
                }}
              />
            )}
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep('mode')}>
                Atrás
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleContinueFromCapture}
                disabled={menuLoading}
              >
                Revisar
              </button>
            </div>
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <h2 id="min-spend-title" className={styles.title}>Resumen para el empleado</h2>
            <div className={styles.reviewCard}>
              <div className={styles.reviewRow}>
                <span>Mínimo promo</span>
                <strong>{formatMinimumSpendTarget(minimumSpendCents)}</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>Total indicado</span>
                <strong>{formatVerificationTotalLabel(computedTotalCents)}</strong>
              </div>
              {captureMode === 'products' ? (
                <ul className={styles.reviewList}>
                  {buildProductCartLineItems(quantities, products).map((entry) => {
                    const product = products.find((item) => item.id === entry.nodeId)
                    if (!product || product.priceCents == null) {
                      return null
                    }

                    return (
                      <li key={entry.nodeId}>
                        {entry.quantity} × {product.name} ({formatCentsAsEuros(product.priceCents)})
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              <p className={`${styles.reviewResult} ${computedTotalCents >= minimumSpendCents ? styles.reviewOk : styles.reviewFail}`}>
                {computedTotalCents >= minimumSpendCents
                  ? 'Cumple el gasto mínimo'
                  : 'No alcanza el gasto mínimo'}
              </p>
            </div>
            <p className={styles.pinHint}>
              {meetsDeclaredMinimum
                ? 'Si el resumen es correcto, pide el PIN al empleado para confirmar la verificación.'
                : 'Corrige el consumo hasta alcanzar el gasto mínimo antes de validar con PIN.'}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setStep(captureMode === 'total' ? 'total' : 'products')}
              >
                Editar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setStep('pin')}
                disabled={!meetsDeclaredMinimum}
              >
                Validar con PIN
              </button>
            </div>
          </>
        ) : null}

        {step === 'pin' ? (
          <>
            <h2 id="min-spend-title" className={styles.title}>PIN del empleado</h2>
            <p className={styles.pinHint}>
              El empleado debe introducir el PIN del restaurante para confirmar esta verificación.
            </p>
            <input
              ref={pinInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              className={styles.pinInput}
              value={pin}
              placeholder="••••"
              aria-label="Código PIN de 4 dígitos"
              onChange={(event) => {
                setPin(normalizePromotionPinCode(event.target.value))
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handlePinSubmit()
                }
              }}
            />
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep('review')} disabled={submitting}>
                Atrás
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => void handlePinSubmit()} disabled={submitting || !meetsDeclaredMinimum}>
                {submitting ? 'Verificando…' : 'Confirmar'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'success' ? (
          <div className={styles.successScreen}>
            <div
              className={`${styles.successBadge} ${meetsMinimumSpend ? styles.successBadgeOk : styles.successBadgeWarn}`}
              aria-hidden="true"
            >
              {meetsMinimumSpend ? '✓' : '!'}
            </div>
            <h2 id="min-spend-title" className={styles.successTitle}>
              {meetsMinimumSpend && isTimeLimitedPromo
                ? '¡Felicidades!'
                : meetsMinimumSpend
                  ? 'Gasto mínimo verificado'
                  : 'Gasto mínimo no alcanzado'}
            </h2>

            {meetsMinimumSpend && isTimeLimitedPromo && promotion ? (
              <article className={styles.successPromoCard}>
                <div className={styles.successPromoVisual}>
                  <PromotionPhotoCollage
                    productRefs={promotion.productRefs ?? []}
                    fallbackPhotoUrl={promotion.photoUrl || promotion.companyPhotoUrl}
                    size="card"
                    className={styles.successPromoCollage}
                    alt={promotion.title}
                  />
                  <div className={styles.successPromoVisualOverlay} aria-hidden="true" />
                  <span className={styles.successPromoHighlight}>
                    {resolvePromotionHighlight(promotion, 0)}
                  </span>
                  <span className={styles.successPromoWon}>Premio conseguido</span>
                </div>
                <div className={styles.successPromoBody}>
                  <h3 className={styles.successPromoTitle}>{promotion.title}</h3>
                  <p className={styles.successPromoRestaurant}>
                    {promotion.companyName || restaurantName}
                  </p>
                </div>
              </article>
            ) : null}

            <p className={styles.successMessage}>
              {meetsMinimumSpend && isTimeLimitedPromo ? (
                <>
                  Conseguiste{' '}
                  <strong>{promotion?.title?.trim() || 'tu premio'}</strong>
                  {' '}en tu visita.
                </>
              ) : meetsMinimumSpend
                ? 'Tu consumo queda registrado y cuenta para la promoción.'
                : 'Tu visita queda registrada, pero no suma progreso en la promoción.'}
            </p>

            {meetsMinimumSpend && isTimeLimitedPromo ? (
              <p className={styles.successDatePill}>
                {formatReservationPrizeDateTime(reservation.startTime)}
              </p>
            ) : null}

            <div className={styles.actionsStack}>
              <button type="button" className={styles.successButton} onClick={onClose}>
                Entendido
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
