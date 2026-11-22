import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import CustomerReviewModal, { type CustomerReviewSubmitInput } from '../CustomerReviewModal'
import AdelinaRating from '../AdelinaRating'
import ReviewCommentBody from '../ReviewCommentBody'
import { useAuth } from '../../context/AuthContext'
import { getIdToken } from '../../services/auth'
import {
  deleteCustomerReview,
  submitCustomerReview,
  updateCustomerReview,
} from '../../services/companyReviews'
import { getPublicCompanyMenuNodes } from '../../services/companyMenu'
import type { PublicBookingCompany } from '../../services/publicApi'
import type { PublicPromotion } from '../../services/publicPromotions'
import type { MenuNode, Reservation } from '../../types'
import type { CompanyReview, ReviewMediaItem, ReviewTaggedProduct, ReviewTaggedPromotion } from '../../types/review'
import { REVIEW_BOOST_ITEM_ID } from '../../data/inventoryItems'
import styles from './WriteReviewButton.module.css'
import { friendlyErrorMessage } from '../../utils/friendlyError'

// «Escribir reseña» en la ficha (igual que la app): solo si fuiste al local, con
// una reserva asistida o un consumo validado. Lo decide el servidor al pulsar.
// Si ya tienes reseña, sale arriba como «Tu reseña» con «Editar»; se pide solo
// en los locales que tu progreso marca como reseñados (sin lecturas de más).

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const NEEDS_VISIT =
  'Para escribir una reseña tienes que haber ido con una reserva (y que el local la haya completado) o haber registrado un consumo en este local.'

interface Eligibility {
  canReview: boolean
  message: string | null
  review: CompanyReview | null
}

async function fetchEligibility(companyId: string, uid: string, customerName: string): Promise<Eligibility> {
  const token = await getIdToken()
  const response = await fetch(`${API_BASE}/api/customer/reviews/eligibility/${encodeURIComponent(companyId)}`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  const data = (await response.json().catch(() => ({}))) as {
    canReview?: boolean
    message?: string | null
    review?: Record<string, unknown> | null
    error?: string
  }
  if (!response.ok) throw new Error(data.error ?? 'No se pudo comprobar si puedes reseñar.')
  const raw = data.review
  const review: CompanyReview | null =
    raw && typeof raw.rating === 'number'
      ? {
          id: uid,
          companyId,
          reservationId: typeof raw.reservationId === 'string' ? raw.reservationId : '',
          customerUid: uid,
          customerName,
          rating: raw.rating,
          comment: typeof raw.comment === 'string' ? raw.comment : '',
          mediaItems: (Array.isArray(raw.mediaItems) ? raw.mediaItems : []) as ReviewMediaItem[],
          hasPhoto: Array.isArray(raw.mediaItems) && raw.mediaItems.length > 0,
          taggedProducts: (Array.isArray(raw.taggedProducts) ? raw.taggedProducts : []) as ReviewTaggedProduct[],
          taggedPromotions: (Array.isArray(raw.taggedPromotions) ? raw.taggedPromotions : []) as ReviewTaggedPromotion[],
          adelinasEarned: 0,
          createdAt: typeof raw.createdAt === 'string' ? new Date(raw.createdAt) : new Date(),
        }
      : null
  return { canReview: data.canReview === true, message: data.message ?? null, review }
}

interface ReviewWriter {
  /** Botón para la cabecera de las reseñas. */
  button: ReactNode
  /** «Tu reseña» para poner encima de la lista (o null). */
  pinned: ReactNode
  /** Aviso y formulario (van fuera del flujo). */
  overlays: ReactNode
  /** Tu reseña ya sale arriba: que no se repita en la lista. */
  hiddenReviewId: string | null
}

export function useReviewWriter(
  company: PublicBookingCompany,
  promotions: PublicPromotion[],
  onChanged: () => void,
): ReviewWriter {
  const { user, profile, patchProfileGamification, refreshProfile } = useAuth()
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [myReview, setMyReview] = useState<CompanyReview | null>(null)
  const [modal, setModal] = useState<{ existing: CompanyReview | null; menu: MenuNode[] } | null>(null)
  const isCustomer = profile?.role === 'customer'
  const author = profile?.displayName || 'Cliente'
  const reviewedHere = Boolean(profile?.gamification?.reviewedCompanyIds?.includes(company.id))

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Tu reseña al abrir la ficha, solo si tu progreso dice que reseñaste este local.
  const uid = user?.uid ?? ''
  useEffect(() => {
    setMyReview(null)
    if (!uid || !reviewedHere) return
    let cancelled = false
    void fetchEligibility(company.id, uid, author)
      .then((result) => {
        if (!cancelled) setMyReview(result.review)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, uid, reviewedHere])

  const openEditor = useCallback(
    async (existing: CompanyReview | null) => {
      const menu = await getPublicCompanyMenuNodes(company.id).catch(() => [] as MenuNode[])
      setModal({ existing, menu })
    },
    [company.id],
  )

  const open = async () => {
    if (!user || !isCustomer || checking) return
    setChecking(true)
    try {
      const result = await fetchEligibility(company.id, user.uid, author)
      setMyReview(result.review)
      if (!result.canReview) {
        setNotice(result.message ?? NEEDS_VISIT)
        return
      }
      await openEditor(result.review)
    } catch (error) {
      setNotice(friendlyErrorMessage(error, 'No se pudo comprobar. Inténtalo de nuevo.'))
    } finally {
      setChecking(false)
    }
  }

  const refreshMine = () => {
    if (!user) return
    void fetchEligibility(company.id, user.uid, author)
      .then((result) => setMyReview(result.review))
      .catch(() => undefined)
  }

  const handleSubmit = async (input: CustomerReviewSubmitInput) => {
    if (!user || !profile?.gamification) throw new Error('Debes iniciar sesión como cliente.')
    const next = await submitCustomerReview(profile.gamification, {
      ...input,
      // Sin reserva concreta: el servidor busca la prueba (reserva asistida o consumo).
      reservationId: '',
      customerUid: user.uid,
      customerName: author,
    })
    patchProfileGamification({ inventory: next.inventory, xp: next.xp, adelinas: next.adelinas })
    void refreshProfile()
    refreshMine()
    onChanged()
  }

  const handleUpdate = async (input: CustomerReviewSubmitInput) => {
    if (!user || !profile?.gamification) throw new Error('Debes iniciar sesión como cliente.')
    await updateCustomerReview(profile.gamification, {
      ...input,
      reservationId: '',
      customerUid: user.uid,
      customerName: author,
    })
    refreshMine()
    onChanged()
  }

  const handleDelete = async (companyId: string) => {
    if (!user || !profile?.gamification) throw new Error('Debes iniciar sesión como cliente.')
    await deleteCustomerReview(profile.gamification, companyId, user.uid)
    setMyReview(null)
    void refreshProfile()
    onChanged()
  }

  const label = myReview ? 'Editar mi reseña' : 'Escribir reseña'
  const button = isCustomer ? (
    <button type="button" className={styles.button} onClick={() => void open()} disabled={checking} aria-busy={checking}>
      <PenLine size={16} aria-hidden="true" />
      {checking ? 'Comprobando…' : label}
    </button>
  ) : (
    <Link to="/cuenta/entrar" className={styles.button}>
      <PenLine size={16} aria-hidden="true" />
      Escribir reseña
    </Link>
  )

  const pinned = myReview ? (
    <article className={styles.mine} aria-label="Tu reseña">
      <header className={styles.mineHead}>
        <span className={styles.mineLabel}>Tu reseña</span>
        <button type="button" className={styles.mineEdit} onClick={() => void openEditor(myReview)}>
          Editar
        </button>
      </header>
      <AdelinaRating value={myReview.rating} size="sm" showValue />
      <ReviewCommentBody
        comment={myReview.comment}
        slug={company.slug}
        taggedProducts={myReview.taggedProducts}
        taggedPromotions={myReview.taggedPromotions}
      />
    </article>
  ) : null

  const overlays = (
    <>
      {notice ? (
        <div className={styles.toast} role="alert">
          <strong>Todavía no puedes reseñar este local</strong>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      ) : null}
      <CustomerReviewModal
        reservation={modal ? ({ id: '', companyId: company.id } as Reservation) : null}
        restaurantName={company.name}
        restaurantSlug={company.slug}
        existingReview={modal?.existing ?? null}
        menuProducts={modal?.menu ?? []}
        promotions={promotions}
        onClose={() => setModal(null)}
        onSubmit={handleSubmit}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        reviewBoostPending={(profile?.gamification?.inventory?.[REVIEW_BOOST_ITEM_ID] ?? 0) > 0}
      />
    </>
  )

  return { button, pinned, overlays, hiddenReviewId: myReview ? uid : null }
}
