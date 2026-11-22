import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import CustomerReviewModal, { type CustomerReviewSubmitInput } from '../CustomerReviewModal'
import { useAuth } from '../../context/AuthContext'
import { getIdToken } from '../../services/auth'
import {
  deleteCustomerReview,
  getCustomerReviewForCompany,
  submitCustomerReview,
  updateCustomerReview,
} from '../../services/companyReviews'
import { getPublicCompanyMenuNodes } from '../../services/companyMenu'
import type { PublicBookingCompany } from '../../services/publicApi'
import type { PublicPromotion } from '../../services/publicPromotions'
import type { MenuNode, Reservation } from '../../types'
import type { CompanyReview } from '../../types/review'
import { REVIEW_BOOST_ITEM_ID } from '../../data/inventoryItems'
import styles from './WriteReviewButton.module.css'

// «Escribir reseña» en la ficha (igual que la app): solo si fuiste al local, con
// una reserva asistida o un consumo validado. Lo decide el servidor al pulsar,
// así no se gasta una lectura en cada visita a la ficha.

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const NEEDS_VISIT =
  'Para escribir una reseña tienes que haber ido con una reserva (y que el local la haya completado) o haber registrado un consumo en este local.'

interface WriteReviewButtonProps {
  company: PublicBookingCompany
  promotions: PublicPromotion[]
  /** Se ha escrito, editado o borrado la reseña: recargar la lista. */
  onChanged: () => void
}

export default function WriteReviewButton({ company, promotions, onChanged }: WriteReviewButtonProps) {
  const { user, profile, patchProfileGamification, refreshProfile } = useAuth()
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [modal, setModal] = useState<{ existing: CompanyReview | null; menu: MenuNode[] } | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const isCustomer = profile?.role === 'customer'

  const open = async () => {
    if (!user || !isCustomer || checking) return
    setChecking(true)
    try {
      const token = await getIdToken()
      const response = await fetch(`${API_BASE}/api/customer/reviews/eligibility/${encodeURIComponent(company.id)}`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      const data = (await response.json().catch(() => ({}))) as {
        canReview?: boolean
        hasReview?: boolean
        message?: string | null
        error?: string
      }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo comprobar si puedes reseñar.')
      if (!data.canReview) {
        setNotice(data.message ?? NEEDS_VISIT)
        return
      }
      const [existing, menu] = await Promise.all([
        data.hasReview ? getCustomerReviewForCompany(company.id, user.uid).catch(() => null) : Promise.resolve(null),
        getPublicCompanyMenuNodes(company.id).catch(() => [] as MenuNode[]),
      ])
      setModal({ existing, menu })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo comprobar. Inténtalo de nuevo.')
    } finally {
      setChecking(false)
    }
  }

  const author = () => profile?.displayName || 'Cliente'

  const handleSubmit = async (input: CustomerReviewSubmitInput) => {
    if (!user || !profile?.gamification) throw new Error('Debes iniciar sesión como cliente.')
    const next = await submitCustomerReview(profile.gamification, {
      ...input,
      // Sin reserva concreta: el servidor busca la prueba (reserva asistida o consumo).
      reservationId: '',
      customerUid: user.uid,
      customerName: author(),
    })
    patchProfileGamification({ inventory: next.inventory, xp: next.xp, adelinas: next.adelinas })
    void refreshProfile()
    onChanged()
  }

  const handleUpdate = async (input: CustomerReviewSubmitInput) => {
    if (!user || !profile?.gamification) throw new Error('Debes iniciar sesión como cliente.')
    await updateCustomerReview(profile.gamification, {
      ...input,
      reservationId: '',
      customerUid: user.uid,
      customerName: author(),
    })
    onChanged()
  }

  const handleDelete = async (companyId: string) => {
    if (!user || !profile?.gamification) throw new Error('Debes iniciar sesión como cliente.')
    await deleteCustomerReview(profile.gamification, companyId, user.uid)
    void refreshProfile()
    onChanged()
  }

  return (
    <>
      {isCustomer ? (
        <button type="button" className={styles.button} onClick={() => void open()} disabled={checking} aria-busy={checking}>
          <PenLine size={16} aria-hidden="true" />
          {checking ? 'Comprobando…' : 'Escribir reseña'}
        </button>
      ) : (
        <Link to="/cuenta/entrar" className={styles.button}>
          <PenLine size={16} aria-hidden="true" />
          Escribir reseña
        </Link>
      )}

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
}
