import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import MenuPdfViewer from '../components/menu/MenuPdfViewer'
import MenuPreview from '../components/menu/MenuPreview'
import MenuPromotionsFab from '../components/MenuPromotionsFab'
import { fetchPublicMenu, type PublicBookingCompany } from '../services/publicApi'
import { companyAcceptsReservations, restaurantReserveCtaShortLabel } from '../data/companyReservationMode'
import { hasMenuPdf, type MenuBoard, type MenuNode } from '../types/company'
import { trackAppEvent } from '../utils/appEvents'
import styles from './PublicMenuViewPage.module.css'

function PublicMenuViewPage() {
  const { slug = '', boardId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const highlightProductId = searchParams.get('producto')
  const menuHref = `/reservar/${slug}/carta`

  const [company, setCompany] = useState<PublicBookingCompany | null>(null)
  const [boards, setBoards] = useState<MenuBoard[]>([])
  const [nodes, setNodes] = useState<MenuNode[]>([])
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
        setNodes(data.nodes)
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

  const board = useMemo(
    () => boards.find((item) => item.id === boardId) ?? null,
    [boards, boardId],
  )

  useEffect(() => {
    if (company?.id && board?.id) {
      trackAppEvent('menu_board_view', {
        companyId: company.id,
        entityId: board.id,
        entityKind: 'menuBoard',
      })
    }
  }, [company?.id, board?.id])

  const boardNodes = useMemo(
    () => (board ? nodes.filter((node) => node.boardId === board.id) : []),
    [nodes, board],
  )

  if (isLoading) {
    return (
      <div className={styles.loadingPage}>
        <p>Cargando carta…</p>
      </div>
    )
  }

  if (!company || !board) {
    return (
      <div className={styles.errorPage}>
        <p>{error ?? 'Carta no encontrada.'}</p>
        <Link to={menuHref}>Elegir otra carta</Link>
      </div>
    )
  }

  const reserveHref = companyAcceptsReservations(company.reservationMode)
    ? `/reservar/${slug}?reservar=1`
    : `/reservar/${slug}`

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <Link to={menuHref} className={styles.backLink}>
          ← Cartas
        </Link>
        <Link to={reserveHref} className={styles.reserveLink}>
          {restaurantReserveCtaShortLabel(company.reservationMode)}
        </Link>
      </header>

      {hasMenuPdf(board) ? (
        <main className={styles.pdfMain}>
          <MenuPdfViewer
            pdfUrl={board.pdfUrl}
            pdfPages={board.pdfPages}
            fileName={board.pdfFileName}
            title={board.name}
          />
        </main>
      ) : (
        <MenuPreview
          board={board}
          nodes={boardNodes}
          restaurantName={company.name}
          fullscreen
          highlightProductId={highlightProductId}
        />
      )}

      <MenuPromotionsFab slug={slug} />
    </div>
  )
}

export default PublicMenuViewPage
