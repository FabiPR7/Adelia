import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PublicBookingShell from '../components/PublicBookingShell'
import {
  cancelPublicReservation,
  fetchPublicBookingPage,
  fetchPublicCancelPreview,
  type PublicBookingCompany,
  type PublicCancelPreview,
  type PublicCancelXpPenalty,
} from '../services/publicApi'
import { buildPublicDepositCancelWarningMessage } from '../utils/reservationDeposit'
import { companyAcceptsReservations } from '../data/companyReservationMode'
import {
  formatCancelPenaltyPreview,
  formatCancelPenaltyResult,
} from '../data/cancellationPenalties'
import styles from './PublicCancelReservation.module.css'

function formatReservationWhen(startTime: string | null): string | null {
  if (!startTime) {
    return null
  }

  const date = new Date(startTime)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function PublicCancelReservation() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [company, setCompany] = useState<PublicBookingCompany | null>(null)
  const [cancelPreview, setCancelPreview] = useState<PublicCancelPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [resultPenalty, setResultPenalty] = useState<PublicCancelXpPenalty | null>(null)
  const [useShield, setUseShield] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!slug || !token) {
        if (!slug) {
          setLoadError('Enlace no válido.')
        }
        setIsLoading(false)
        return
      }

      try {
        const [bookingPage, preview] = await Promise.all([
          fetchPublicBookingPage(slug),
          fetchPublicCancelPreview(token),
        ])

        if (!cancelled) {
          setCompany(bookingPage.company)
          setCancelPreview(preview)
          setUseShield((preview.cancelShieldCount ?? 0) > 0)
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'No se pudo cargar la cancelación.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug, token])

  const depositWarning = useMemo(() => {
    if (
      !cancelPreview?.hasAuthorizedDeposit
      || !cancelPreview.depositAmountCents
    ) {
      return null
    }

    return buildPublicDepositCancelWarningMessage(
      cancelPreview.depositAmountCents,
      cancelPreview.willChargeDeposit,
      cancelPreview.depositCancellationHours,
    )
  }, [cancelPreview])

  const reservationWhen = formatReservationWhen(cancelPreview?.startTime ?? null)

  const handleCancel = async () => {
    if (!token) {
      setError('Falta el token de cancelación en el enlace.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await cancelPublicReservation(token, { useCancelShield: useShield })
      setResultMessage(result.message)
      setResultPenalty(result.xpPenalty ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la reserva.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className={styles.pageLoading}>
        <p>Cargando…</p>
      </div>
    )
  }

  if (loadError || !company) {
    return (
      <div className={styles.pageLoading}>
        <p>{loadError ?? 'Restaurante no encontrado.'}</p>
      </div>
    )
  }

  const displayCompanyName = cancelPreview?.companyName || company.name

  return (
    <PublicBookingShell
      company={company}
      legalFrom={`/reservar/${slug}/cancelar`}
      reserveHref={companyAcceptsReservations(company.reservationMode) ? `/reservar/${slug}` : null}
    >
      <main className={styles.main}>
        <section className={styles.card}>
          <h1>Cancelar reserva</h1>

          {!token ? (
            <p className={styles.error}>Este enlace no es válido. Revisa el correo de confirmación.</p>
          ) : cancelPreview?.alreadyCancelled ? (
            <>
              <p className={styles.error}>Esta reserva ya estaba cancelada.</p>
              <Link to={`/reservar/${slug}`} className={styles.primaryLink}>
                Volver a reservar
              </Link>
            </>
          ) : resultMessage ? (
            <>
              <p className={styles.success}>{resultMessage}</p>
              {resultPenalty?.shielded ? (
                <div className={styles.xpPenaltyHint}>
                  <p className={styles.xpPenaltyLoss}>Escudo de Mesa usado</p>
                  <p>{resultPenalty.warning}</p>
                </div>
              ) : resultPenalty ? (
                <div className={styles.xpPenaltyResult}>
                  <p className={styles.xpPenaltyLoss}>
                    {resultPenalty.xpLost > 0
                      ? `−${resultPenalty.xpLost} XP (−${resultPenalty.percent}%)`
                      : 'Aviso registrado'}
                  </p>
                  <p>{formatCancelPenaltyResult(resultPenalty)}</p>
                  <p className={styles.xpPenaltyCount}>
                    Cancelación {resultPenalty.strikeCount} de 5
                  </p>
                </div>
              ) : null}
              <Link to={`/reservar/${slug}`} className={styles.primaryLink}>
                Volver a reservar
              </Link>
            </>
          ) : (
            <>
              <p>
                ¿Seguro que quieres cancelar tu reserva en <strong>{displayCompanyName}</strong>?
              </p>
              {reservationWhen ? (
                <p className={styles.reservationMeta}>
                  {reservationWhen}
                  {cancelPreview?.pax ? ` · ${cancelPreview.pax} comensales` : ''}
                </p>
              ) : null}
              {depositWarning ? (
                <p
                  className={
                    cancelPreview?.willChargeDeposit
                      ? styles.depositWarningCharge
                      : styles.depositWarningSafe
                  }
                >
                  {depositWarning}
                </p>
              ) : null}
              {cancelPreview?.xpPenalty && !useShield ? (
                <p className={styles.xpPenaltyWarning}>
                  {formatCancelPenaltyPreview(cancelPreview.xpPenalty)}
                  {' '}
                  Será tu cancelación {cancelPreview.xpPenalty.strikeCount} de 5.
                </p>
              ) : cancelPreview?.xpPenalty && useShield ? (
                <p className={styles.xpPenaltyHint}>
                  El Escudo de Mesa cubrirá esta cancelación: no perderás XP ni sumarás aviso.
                </p>
              ) : (
                <p className={styles.xpPenaltyHint}>
                  Si esta reserva está vinculada a una cuenta Adelia, cancelar te restará puntos de
                  experiencia (12% la primera vez, y cada vez más).
                </p>
              )}
              {(cancelPreview?.cancelShieldCount ?? 0) > 0 ? (
                <label className={styles.shieldToggle}>
                  <input
                    type="checkbox"
                    checked={useShield}
                    onChange={(event) => setUseShield(event.target.checked)}
                  />
                  Usar Escudo de Mesa ({cancelPreview?.cancelShieldCount})
                </label>
              ) : null}
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => void handleCancel()}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Cancelando…' : 'Confirmar cancelación'}
              </button>
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}
        </section>
      </main>
    </PublicBookingShell>
  )
}

export default PublicCancelReservation
