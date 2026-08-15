import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PublicBookingShell from '../components/PublicBookingShell'
import {
  cancelPublicReservation,
  fetchPublicBookingPage,
  fetchPublicCancelPreview,
  type PublicBookingCompany,
  type PublicCancelPreview,
} from '../services/publicApi'
import { buildPublicDepositCancelWarningMessage } from '../utils/reservationDeposit'
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
      const result = await cancelPublicReservation(token)
      setResultMessage(result.message)
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
      reserveHref={`/reservar/${slug}`}
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
