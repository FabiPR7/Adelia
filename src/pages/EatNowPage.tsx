import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requestUserLocation } from '../utils/requestUserLocation'
import { formatDistanceKm, haversineDistanceKm } from '../utils/geo'
import { fetchNowPage, nowBookingHref, nowStatus, type NowRestaurant, type NowWhere } from '../services/nowAvailability'
import styles from './EatNowPage.module.css'

const PAX_OPTIONS: Array<number | null> = [null, 1, 2, 3, 4, 5, 6, 7, 8]

type Where = NowWhere

/**
 * «Comer ahora»: para cuando hay prisa. Todos los sitios abiertos cerca, de 12 en 12:
 * primero los que tienen mesa para reservar ya; después, los que puede que tengan sitio.
 * Decir cuántos sois es opcional.
 */
function EatNowPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pax, setPax] = useState<number | null>(null)
  const [where, setWhere] = useState<Where | null>(null)
  const [locating, setLocating] = useState(true)
  const [cityInput, setCityInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<NowRestaurant[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [windowMinutes, setWindowMinutes] = useState(30)
  // Si cambias de sitio o de comensales, lo que llegue de la búsqueda anterior se ignora.
  const searchId = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Comer ahora · Adelia'
  }, [])

  // Primero tu ubicación; si no se puede, tu ciudad del perfil; si no, la escribes tú.
  useEffect(() => {
    let cancelled = false
    setLocating(true)
    requestUserLocation('')
      .then((location) => {
        if (!cancelled) setWhere({ near: location.coords })
      })
      .catch(() => {
        if (cancelled) return
        const city = (profile as { homeCity?: string } | null)?.homeCity?.trim() ?? ''
        if (city) setWhere({ city })
      })
      .finally(() => {
        if (!cancelled) setLocating(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile])

  /** Pide una página (y las siguientes si esa no trae ningún local abierto). */
  const loadPage = useCallback(async (target: Where, people: number | null, from: string | null) => {
    if (from == null) searchId.current += 1
    const id = searchId.current
    setLoading(true)
    setError(null)
    if (from == null) {
      setItems([])
      setDone(false)
    }
    try {
      let next = from
      for (let tries = 0; tries < 4; tries += 1) {
        const page = await fetchNowPage(target, people, next)
        if (id !== searchId.current) return
        setWindowMinutes(page.windowMinutes)
        next = page.nextCursor
        setItems((current) => {
          const seen = new Set(current.map((item) => item.id))
          return [...current, ...page.restaurants.filter((item) => !seen.has(item.id))]
        })
        if (page.restaurants.length > 0 || !next) break
      }
      setCursor(next)
      setDone(next == null)
    } catch (err) {
      if (id === searchId.current) {
        setError(err instanceof Error ? err.message : 'No se pudieron buscar mesas para ahora.')
      }
    } finally {
      if (id === searchId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (where) void loadPage(where, pax, null)
  }, [where, pax, loadPage])

  // Al acercarse al final de la lista se cargan los siguientes.
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !where || !cursor || loading || error) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadPage(where, pax, cursor)
    }, { rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [where, pax, cursor, loading, error, loadPage])

  const submitCity = (event: FormEvent) => {
    event.preventDefault()
    if (cityInput.trim().length >= 2) setWhere({ city: cityInput.trim() })
  }

  const origin = where && 'near' in where ? where.near : null

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Volver">
          ←
        </button>
        <p className={styles.eyebrow}>Comer ahora</p>
        <h1 className={styles.title}>Mesa libre, ya</h1>
        <p className={styles.lead}>
          Sitios abiertos cerca de ti: con mesa para reservar en los próximos {windowMinutes} minutos o donde puede que haya sitio.
        </p>

        <div className={styles.paxRow} role="radiogroup" aria-label="¿Cuántos sois? (opcional)">
          <span className={styles.paxLabel}>¿Cuántos sois? (opcional)</span>
          {PAX_OPTIONS.map((option) => (
            <button
              key={option ?? 'all'}
              type="button"
              role="radio"
              aria-checked={pax === option}
              className={`${styles.paxChip} ${pax === option ? styles.paxChipOn : ''}`}
              onClick={() => setPax(option)}
            >
              {option == null ? 'Todos' : option === 8 ? '8+' : option}
            </button>
          ))}
        </div>
        <p className={styles.tip}>Antes de ir, asegúrate de que entráis todos.</p>
      </header>

      <main className={styles.main}>
        {!where && !locating ? (
          <form className={styles.cityForm} onSubmit={submitCity}>
            <p>No hemos podido usar tu ubicación. ¿En qué ciudad estás?</p>
            <div className={styles.cityRow}>
              <input
                value={cityInput}
                onChange={(event) => setCityInput(event.target.value)}
                placeholder="Logroño, Madrid…"
                aria-label="Ciudad"
              />
              <button type="submit" className={styles.primary}>Buscar</button>
            </div>
          </form>
        ) : null}

        {error ? (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            {where ? <button type="button" className={styles.secondary} onClick={() => void loadPage(where, pax, items.length > 0 ? cursor : null)}>Reintentar</button> : null}
          </div>
        ) : null}

        {done && !loading && !error && items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Ahora mismo no hay sitios abiertos cerca</p>
            <p>{pax == null ? 'Prueba más tarde o reserva para otro momento.' : 'Prueba con «Todos» o con menos personas.'}</p>
            <Link className={styles.primary} to="/">Ver todos los restaurantes</Link>
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className={styles.list}>
            {items.map((item) => {
              const distance = origin && item.latitude != null && item.longitude != null
                ? formatDistanceKm(haversineDistanceKm(origin, { lat: item.latitude, lng: item.longitude }))
                : ''
              const status = nowStatus(item)
              return (
                <li key={item.id} className={styles.card}>
                  <div className={styles.photo}>
                    {item.photoUrl ? <img src={item.photoUrl} alt="" loading="lazy" /> : <span>{item.name.charAt(0)}</span>}
                  </div>
                  <div className={styles.body}>
                    <h2>{item.name}</h2>
                    <p className={styles.meta}>{[item.municipality, distance].filter(Boolean).join(' · ')}</p>
                    <p className={item.state === 'book' ? styles.slot : styles.maybe}>{status.title}</p>
                    <p className={styles.meta}>{status.detail}</p>
                    <div className={styles.cardActions}>
                      {item.state === 'book' && item.now ? (
                        <Link className={styles.primary} to={nowBookingHref(item, pax)}>Reservar a las {item.now.time}</Link>
                      ) : (
                        <>
                          {item.phone ? <a className={styles.primary} href={`tel:${item.phone.replace(/[^\d+]/g, '')}`}>Llamar</a> : null}
                          <Link className={styles.secondary} to={`/reservar/${encodeURIComponent(item.slug)}`}>Ver el local</Link>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div ref={sentinelRef} />
        {locating || loading ? (
          <p className={styles.status} role="status">
            {locating ? 'Buscando dónde estás…' : items.length > 0 ? 'Cargando más…' : 'Buscando sitios abiertos…'}
          </p>
        ) : null}
        {done && !loading && items.length > 0 ? <p className={styles.note}>No hay más sitios abiertos cerca.</p> : null}
      </main>
    </div>
  )
}

export default EatNowPage
