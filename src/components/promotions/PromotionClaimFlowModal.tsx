import { useEffect, useRef, useState } from 'react'
import type { PublicPromotion } from '../../services/publicPromotions'
import { validatePromotionPin } from '../../services/publicPromotions'
import { normalizePromotionPinCode, validatePromotionPinCode } from '../../utils/promotionPin'
import styles from './PromotionClaimFlowModal.module.css'

type FlowStep = 'location' | 'not_at_restaurant' | 'pin' | 'success'

interface PromotionClaimFlowModalProps {
  promotion: PublicPromotion | null
  onClose: () => void
  onClaimed: (promotion: PublicPromotion) => Promise<void>
}

export default function PromotionClaimFlowModal({
  promotion,
  onClose,
  onClaimed,
}: PromotionClaimFlowModalProps) {
  const [step, setStep] = useState<FlowStep>('location')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const openedPromotionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!promotion) {
      openedPromotionIdRef.current = null
      return
    }

    if (openedPromotionIdRef.current === promotion.id) {
      return
    }

    openedPromotionIdRef.current = promotion.id
    setStep('location')
    setPin('')
    setError('')
    setSubmitting(false)
  }, [promotion])

  useEffect(() => {
    if (step === 'pin') {
      pinInputRef.current?.focus()
    }
  }, [step])

  if (!promotion) {
    return null
  }

  const handlePinSubmit = async () => {
    const validationError = validatePromotionPinCode(pin)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const valid = await validatePromotionPin(promotion.companyId, pin)
      if (!valid) {
        setError('Código PIN incorrecto. Pídeselo de nuevo al empleado.')
        setSubmitting(false)
        return
      }

      await onClaimed(promotion)
      setStep('success')
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : 'No se pudo validar el código.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-flow-title"
      >
        {step === 'location' ? (
          <>
            <h2 id="claim-flow-title" className={styles.title}>
              ¿Estás en el restaurante?
            </h2>
            <p className={styles.message}>
              Para reclamar <strong>{promotion.title}</strong> debes estar en{' '}
              <span className={styles.restaurantName}>{promotion.companyName}</span>.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setStep('not_at_restaurant')}
              >
                No
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setStep('pin')}
              >
                Sí
              </button>
            </div>
          </>
        ) : null}

        {step === 'not_at_restaurant' ? (
          <>
            <h2 id="claim-flow-title" className={styles.title}>
              No puedes reclamar ahora
            </h2>
            <p className={styles.message}>
              No puedes reclamar sin estar en el establecimiento. Acude al restaurante
              y vuelve a intentarlo cuando estés allí.
            </p>
            <div className={styles.actionsStack}>
              <button type="button" className={styles.primaryButton} onClick={onClose}>
                Entendido
              </button>
            </div>
          </>
        ) : null}

        {step === 'pin' ? (
          <>
            <h2 id="claim-flow-title" className={styles.title}>
              Valida tu promoción
            </h2>
            <p className={styles.pinHint}>
              Solicita el código PIN al empleado del restaurante e introdúcelo aquí
              para validar la reserva.
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
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handlePinSubmit()}
                disabled={submitting}
              >
                {submitting ? 'Validando…' : 'Validar'}
              </button>
            </div>
          </>
        ) : null}

        {step === 'success' ? (
          <>
            <span className={styles.successEmoji} aria-hidden="true">✓</span>
            <h2 id="claim-flow-title" className={styles.title}>
              Promoción reclamada
            </h2>
            <p className={styles.message}>
              Tu promoción ha quedado registrada. Puedes ver los detalles en la pestaña
              Reclamadas.
            </p>
            <div className={styles.actionsStack}>
              <button type="button" className={styles.successButton} onClick={onClose}>
                Ver reclamadas
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
