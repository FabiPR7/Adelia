import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import MenuPromotionsFab from '../components/MenuPromotionsFab'
import { fetchPublicMenu, type PublicBookingCompany } from '../services/publicApi'
import type { MenuBoard } from '../types/company'
import { trackAppEvent } from '../utils/appEvents'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import { getCompanyMainPhotoUrl } from '../utils/companyPhotos'
import styles from './PublicMenuPage.module.css'
import { friendlyErrorMessage } from '../utils/friendlyError'

function PublicMenuPage() {
  const { slug = '' } = useParams()
  const reserveHref = `/reservar/${slug}`

  const [company, setCompany] = useState<PublicBookingCompany | null>(null)

  // Título con el nombre del local (el genérico de RouteTitle no lo sabe).
  useEffect(() => {
    if (company?.name) {
      document.title = `Carta de ${company.name} · Adelia`
    }
  }, [company?.name, company?.municipality])
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
          setError(friendlyErrorMessage(err, 'No se pudo cargar la carta.'))
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
        <p>{error ? 'Este restaurante no está disponible ahora mismo.' : 'Restaurante no encontrado.'}</p>
        <Link to="/">Buscar otros restaurantes</Link>
      </div>
    )
  }

  const coverPhoto = getCompanyMainPhotoUrl(company.photos ?? [], company.mainPhotoIndex ?? 0)
  const coverUrl = coverPhoto ? optimizeCloudinaryUrl(coverPhoto, CLOUDINARY_DISPLAY.photoGallery) : ''

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {coverUrl ? <img src={coverUrl} alt="" className={styles.headerImage} /> : null}
        <div className={styles.headerShade} aria-hidden="true" />
        <div className={styles.headerInner}>
          <Link to={reserveHref} className={styles.backLink}>
            ← Volver
          </Link>
          <div className={styles.headerText}>
            <p className={styles.eyebrow}>La carta</p>
            <h1>{company.name}</h1>
            {boards.length > 1 ? <p>Elige qué carta quieres ver.</p> : null}
          </div>
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
                  <span className={styles.boardIcon}>
                    <BookOpen size={24} aria-hidden="true" />
                  </span>
                  <span className={styles.boardName}>{board.name}</span>
                  <span className={styles.boardAction}>
                    Ver
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className={styles.reserveCard} aria-label="Reservar mesa">
          <div>
            <h2>¿Te apetece?</h2>
            <p>Reserva tu mesa en {company.name} en un momento.</p>
          </div>
          <Link to={`${reserveHref}?reservar=1`} className={styles.reserveButton}>
            Reservar mesa
          </Link>
        </section>
      </main>

      <MenuPromotionsFab slug={slug} />
    </div>
  )
}

export default PublicMenuPage
