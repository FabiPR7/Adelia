import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PublicBookingShell from '../components/PublicBookingShell'
import { cancelPublicReservation, fetchPublicBookingPage, type PublicBookingCompany } from '../services/publicApi'
import styles from './PublicCancelReservation.module.css'

function PublicCancelReservation() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [company, setCompany] = useState<PublicBookingCompany | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingCompany, setIsLoadingCompany] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!slug) {
        setLoadError('Enlace no válido.')
        setIsLoadingCompany(false)
        return
      }

      try {
        const data = await fetchPublicBookingPage(slug)
        if (!cancelled) {
          setCompany(data.company)
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el restaurante.')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCompany(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug])

  const handleCancel = async () => {
    if (!token) {
      setError('Falta el token de cancelación en el enlace.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const message = await cancelPublicReservation(token)
      setResultMessage(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la reserva.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingCompany) {
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

  return (
    <PublicBookingShell
      company={company}
      legalFrom={`/reservar/${slug}/cancelar`}
      profileHref={`/reservar/${slug}/restaurante`}
      reserveHref={`/reservar/${slug}`}
    >
      <main className={styles.main}>
        <section className={styles.card}>
          <h1>Cancelar reserva</h1>

          {!token ? (
            <p className={styles.error}>Este enlace no es válido. Revisa el correo de confirmación.</p>
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
                ¿Seguro que quieres cancelar tu reserva en <strong>{company.name}</strong>?
              </p>
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
