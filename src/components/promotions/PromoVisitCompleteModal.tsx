import { useEffect, useMemo, useRef, useState } from 'react'
import type { PromoVisitCompletePath } from '../../data/companyReservationMode'
import type { MenuNode } from '../../types/company'
import type { PublicPromotion } from '../../services/publicPromotions'
import { promoMinimumCents } from '../../data/inventoryItems'
import { normalizePromotionPinCode, validatePromotionPinCode } from '../../utils/promotionPin'
import {
  buildProductCartLineItems,
  formatCentsAsEuros,
  formatMinimumSpendTarget,
  formatVerificationTotalLabel,
  parseEuroInputToCents,
  sumProductCartCents,
  type ProductCartQuantities,
} from '../../utils/minimumSpendVerification'
import MinSpendProductCart from '../reservations/MinSpendProductCart'
import type { RegisterConsumptionInput } from '../../services/firestore'
import styles from '../reservations/MinimumSpendVerificationModal.module.css'

type FlowStep = 'choice' | 'mode' | 'total' | 'products' | 'review' | 'pin' | 'success'
type CaptureMode = 'total' | 'products'

interface PromoVisitCompleteModalProps {
  open: boolean
  companyName: string
  path: PromoVisitCompletePath
  promotion: PublicPromotion | null
  menuNodes: MenuNode[]
  menuLoading: boolean
  onClose: () => void
  onReserve: () => void
  onRegisterConsumption: (input: RegisterConsumptionInput) => Promise<void>
}

export default function PromoVisitCompleteModal({
  open,
  companyName,
  path,
  promotion,
  menuNodes,
  menuLoading,
  onClose,
  onReserve,
  onRegisterConsumption,
}: PromoVisitCompleteModalProps) {
  const requiredCents = promoMinimumCents(
    promotion?.minimumSpendCents,
    promotion?.minimumSpendEnabled,
  )
  const requiresMinimum = requiredCents > 0
  const initialStep: FlowStep = path === 'consume' ? 'mode' : 'choice'
  const [step, setStep] = useState<FlowStep>(initialStep)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('products')
  const [totalInput, setTotalInput] = useState('')
  const [quantities, setQuantities] = useState<ProductCartQuantities>({})
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const openedRef = useRef(false)

  const products = useMemo(
    () => menuNodes.filter(
      (node) => node.nodeType === 'product' && node.active && node.priceCents != null,
    ),
    [menuNodes],
  )

  const computedTotalCents = captureMode === 'total'
    ? (parseEuroInputToCents(totalInput) ?? 0)
    : sumProductCartCents(quantities, products)
  const hasDeclaredConsumption = captureMode === 'total'
    ? parseEuroInputToCents(totalInput) != null
    : buildProductCartLineItems(quantities, products).length > 0
  const meetsMinimum = !requiresMinimum || computedTotalCents >= requiredCents

  useEffect(() => {
    if (!open) {
      openedRef.current = false
      return
    }

    if (openedRef.current) {
      return
    }

    openedRef.current = true
    setStep(path === 'consume' ? 'mode' : 'choice')
    setCaptureMode('products')
    setTotalInput('')
    setQuantities({})
    setPin('')
    setError('')
    setSubmitting(false)
  }, [open, path])

  useEffect(() => {
    if (open && step === 'pin') {
      pinInputRef.current?.focus()
    }
  }, [open, step])

  if (!open || path === 'reserve') {
    return null
  }

  const goBackFromCapture = () => {
    setError('')
    setStep('mode')
  }

  const handleContinueFromCapture = () => {
    if (captureMode === 'total') {
      const raw = totalInput.trim()
      if (!raw) {
        if (requiresMinimum) {
          setError('Indica un importe total válido.')
          return
        }
        setError('')
        setStep('pin')
        return
      }
      if (parseEuroInputToCents(totalInput) == null) {
        setError('Indica un importe total válido.')
        return
      }
    } else if (buildProductCartLineItems(quantities, products).length === 0) {
      if (requiresMinimum) {
        setError('Añade al menos un producto.')
        return
      }
      setError('')
      setStep('pin')
      return
    }

    setError('')
    setStep('review')
  }

  const handlePinSubmit = async () => {
    if (requiresMinimum && !meetsMinimum) {
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
      const payload: RegisterConsumptionInput = !hasDeclaredConsumption
        ? { pin, mode: 'skip' }
        : captureMode === 'total'
          ? {
              pin,
              mode: 'total',
              declaredTotalCents: parseEuroInputToCents(totalInput) ?? 0,
            }
          : {
              pin,
              mode: 'products',
              productSelections: buildProductCartLineItems(quantities, products),
            }

      await onRegisterConsumption(payload)
      setStep('success')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo registrar el consumo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const backFromPin = () => {
    setError('')
    if (hasDeclaredConsumption) {
      setStep('review')
      return
    }
    setStep(captureMode === 'total' ? 'total' : 'products')
  }

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        event.stopPropagation()
        onClose()
      }}
      role="presentation"
    >
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-complete-title"
      >
        {step === 'choice' ? (
          <>
            <h2 id="visit-complete-title" className={styles.title}>
              ¿Cómo completas la oferta?
            </h2>
            <p className={styles.message}>
              En <strong>{companyName}</strong> la reserva es opcional. Puedes
              registrar un consumo ahora o reservar mesa.
            </p>
            <div className={styles.actionsStack}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setStep('mode')}
              >
                Registrar consumo
              </button>
              <button type="button" className={styles.secondaryButton} onClick={onReserve}>
                Reservar
              </button>
              <button type="button" className={styles.secondaryButton} onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        ) : null}

        {step === 'mode' ? (
          <>
            <h2 id="visit-complete-title" className={styles.title}>
              Registrar consumo
            </h2>
            <p className={styles.message}>
              {requiresMinimum ? (
                <>
                  Esta oferta pide un gasto mínimo de{' '}
                  <strong>{formatMinimumSpendTarget(requiredCents)}</strong>. Indica
                  productos o el precio, y el restaurante lo valida con el PIN.
                </>
              ) : (
                <>
                  Indica productos o el precio (opcional) y pide el PIN al restaurante
                  para registrar el consumo.
                </>
              )}
            </p>
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
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  if (path === 'choose') {
                    setStep('choice')
                    return
                  }
                  onClose()
                }}
              >
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
            <h2 id="visit-complete-title" className={styles.title}>Importe total</h2>
            <p className={styles.message}>
              {requiresMinimum
                ? `Indica el total consumido. Mínimo ${formatMinimumSpendTarget(requiredCents)}.`
                : 'Indica el total consumido. Puedes dejarlo vacío si no quieres detallarlo.'}
            </p>
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
              <button type="button" className={styles.secondaryButton} onClick={goBackFromCapture}>
                Atrás
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleContinueFromCapture}>
                {requiresMinimum || hasDeclaredConsumption ? 'Revisar' : 'Continuar'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'products' ? (
          <>
            <h2 id="visit-complete-title" className={styles.title}>Productos consumidos</h2>
            {requiresMinimum ? (
              <p className={styles.message}>
                Añade lo consumido. Mínimo {formatMinimumSpendTarget(requiredCents)}.
              </p>
            ) : (
              <p className={styles.message}>
                Añade productos si quieres. También puedes continuar sin detallarlos.
              </p>
            )}
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
              <button type="button" className={styles.secondaryButton} onClick={goBackFromCapture}>
                Atrás
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleContinueFromCapture}
                disabled={menuLoading}
              >
                {requiresMinimum || hasDeclaredConsumption ? 'Revisar' : 'Continuar'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <h2 id="visit-complete-title" className={styles.title}>Resumen para el empleado</h2>
            <div className={styles.reviewCard}>
              {requiresMinimum ? (
                <div className={styles.reviewRow}>
                  <span>Mínimo promo</span>
                  <strong>{formatMinimumSpendTarget(requiredCents)}</strong>
                </div>
              ) : null}
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
              {requiresMinimum ? (
                <p className={`${styles.reviewResult} ${meetsMinimum ? styles.reviewOk : styles.reviewFail}`}>
                  {meetsMinimum ? 'Cumple el gasto mínimo' : 'No alcanza el gasto mínimo'}
                </p>
              ) : null}
            </div>
            <p className={styles.pinHint}>
              {requiresMinimum && !meetsMinimum
                ? 'Corrige el consumo hasta alcanzar el gasto mínimo antes de validar con PIN.'
                : 'Si el resumen es correcto, pide el PIN al empleado para registrar el consumo.'}
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
                disabled={requiresMinimum && !meetsMinimum}
              >
                Validar con PIN
              </button>
            </div>
          </>
        ) : null}

        {step === 'pin' ? (
          <>
            <h2 id="visit-complete-title" className={styles.title}>PIN del restaurante</h2>
            <p className={styles.pinHint}>
              El empleado debe introducir el PIN. Sin ese código no se crea el consumo
              ni suma a la oferta.
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
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={backFromPin}
                disabled={submitting}
              >
                Atrás
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handlePinSubmit()}
                disabled={submitting || (requiresMinimum && !meetsMinimum)}
              >
                {submitting ? 'Registrando…' : 'Registrar'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'success' ? (
          <>
            <h2 id="visit-complete-title" className={styles.title}>
              Consumo registrado
            </h2>
            <p className={styles.message}>
              Este consumo cuenta para la oferta de {companyName}.
            </p>
            <div className={styles.actionsStack}>
              <button type="button" className={styles.successButton} onClick={onClose}>
                Entendido
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
