import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MenuPromotionsFab from '../components/MenuPromotionsFab'
import { fetchPublicMenu, type PublicBookingCompany } from '../services/publicApi'
import type { MenuBoard } from '../types/company'
import { trackAppEvent } from '../utils/appEvents'
import styles from './PublicMenuPage.module.css'

function PublicMenuPage() {
  const { slug = '' } = useParams()
  const reserveHref = `/reservar/${slug}`

  const [company, setCompany] = useState<PublicBookingCompany | null>(null)
  const [boards, setBoards] = useState<MenuBoard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchPublicMenu(slug)
        if (cancelled) {
          return
        }

        setCompany(data.company)
        setBoards(data.boards)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la carta.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (company?.id) {
      trackAppEvent('menu_zone_view', { companyId: company.id })
    }
  }, [company?.id])

  if (isLoading) {
    return (
      <div className={styles.loadingPage}>
        <p>Cargando cartas…</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className={styles.errorPage}>
        <p>{error ?? 'Restaurante no encontrado.'}</p>
        <Link to={reserveHref}>Volver</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={reserveHref} className={styles.backLink}>
          ← Volver
        </Link>
        <div className={styles.headerText}>
          <h1>{company.name}</h1>
          <p>Elige una carta</p>
        </div>
      </header>

      <main className={styles.main}>
        {boards.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Este restaurante aún no ha publicado su carta digital.</p>
            <Link to={reserveHref}>Volver</Link>
          </div>
        ) : (
          <ul className={styles.boardList}>
            {boards.map((board) => (
              <li key={board.id}>
                <Link to={`/reservar/${slug}/carta/${board.id}`} className={styles.boardCard}>
                  <span className={styles.boardName}>{board.name}</span>
                  <span className={styles.boardAction}>Ver carta →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <MenuPromotionsFab slug={slug} />
    </div>
  )
}

export default PublicMenuPage
