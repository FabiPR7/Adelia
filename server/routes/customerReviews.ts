import { Router, type Request, type Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { readGamificationFromDocs, userGamificationRef, writeGamification } from '../data/userGamification.ts'
import { applyReviewBoostIfOwned, numberRecord } from '../gamification/inventory.ts'
import { REVIEW_BOOST_ITEM_ID } from '../gamification/inventoryItems.ts'
import { notifyCompanyReviewScoreChange } from '../notifications/companyNotifications.ts'
import { syncCompanyGamificationDoc } from '../gamification/syncCompany.ts'

const router = Router()
const PRODUCT_TAG = /\[\[p\|([^|]+)\|([^|]+)\|([^\]]+)\]\]/g
const PROMOTION_TAG = /\[\[r\|([^|]+)\|([^\]]+)\]\]/g

function extractTagsFromComment(comment: string) {
  const taggedProducts = [...comment.matchAll(PRODUCT_TAG)].map((match) => ({
    boardId: match[1],
    nodeId: match[2],
    name: match[3],
  }))
  const taggedPromotions = [...comment.matchAll(PROMOTION_TAG)].map((match) => ({
    promotionId: match[1],
    name: match[2],
  }))
  return { taggedProducts, taggedPromotions }
}

function ratingValue(value: unknown): number {
  const rating = Math.round(Number(value))
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('Selecciona una puntuación entre 1 y 5 Adelinas.')
  }
  return rating
}

function mediaItems(value: unknown): Array<{ url: string; type: 'image' | 'video' }> {
  if (!Array.isArray(value)) return []
  return value.slice(0, 5).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const url = typeof record.url === 'string' ? record.url.trim() : ''
    const type = record.type === 'video' ? 'video' : record.type === 'image' ? 'image' : null
    if (!url || !type) return []
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      const allowed = parsed.protocol === 'https:'
        && (host === 'res.cloudinary.com' || host.endsWith('.cloudinary.com'))
      return allowed ? [{ url: parsed.toString(), type }] : []
    } catch {
      return []
    }
  })
}

function reviewInput(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const companyId = String(data.companyId ?? '').trim()
  const reservationId = String(data.reservationId ?? '').trim()
  const comment = String(data.comment ?? '').trim().slice(0, 2000)
  const rating = ratingValue(data.rating)
  const media = mediaItems(data.mediaItems)
  if (!companyId || !reservationId || comment.length < 10) {
    throw new Error('Completa los datos de la reseña y escribe al menos 10 caracteres.')
  }
  const hasPhoto = media.some((item) => item.type === 'image')
  const tags = extractTagsFromComment(comment)
  return {
    companyId,
    reservationId,
    comment,
    rating,
    mediaItems: media,
    hasPhoto,
    adelinasEarned: rating + (hasPhoto ? 2 : 0),
    taggedProducts: tags.taggedProducts,
    taggedPromotions: tags.taggedPromotions,
  }
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

async function assertReservationOwnership(
  reservationId: string,
  companyId: string,
  uid: string,
  email: string,
) {
  const snap = await adminDb.collection('reservations').doc(reservationId).get()
  const data = snap.data()
  const ownedByUid = typeof data?.customerUid === 'string' && data.customerUid === uid
  const ownedByUnlinkedEmail = !data?.customerUid
    && String(data?.clientEmail ?? '').trim().toLowerCase() === email
  if (
    !snap.exists
    || data?.companyId !== companyId
    || (!ownedByUid && !ownedByUnlinkedEmail)
    || data?.status !== 'confirmed'
  ) {
    throw new Error('Solo puedes reseñar una reserva confirmada que pertenezca a tu cuenta.')
  }
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const input = reviewInput(req.body)
    await assertReservationOwnership(
      input.reservationId,
      input.companyId,
      customer.uid,
      customer.email,
    )

    const companyRef = adminDb.collection('companies').doc(input.companyId)
    const reviewRef = companyRef.collection('reviews').doc(customer.uid)
    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    const reviewIndexRef = adminDb.collection('reviewIndex').doc(`${input.companyId}_${customer.uid}`)

    const written = await adminDb.runTransaction(async (transaction) => {
      const [companySnap, reviewSnap, userSnap, statsSnap] = await Promise.all([
        transaction.get(companyRef),
        transaction.get(reviewRef),
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      if (!companySnap.exists) throw new Error('Restaurante no encontrado.')
      if (reviewSnap.exists) throw new Error('Ya tienes una reseña en este restaurante.')

      const company = companySnap.data()!
      const user = userSnap.data()!
      const gamification = readGamificationFromDocs(statsSnap.data(), user)
      const boosted = applyReviewBoostIfOwned(gamification, REVIEW_BOOST_ITEM_ID)
      const reviewedCompanies = Array.isArray(boosted.state.reviewedCompanyIds)
        ? boosted.state.reviewedCompanyIds as string[]
        : []
      const reviewedReservations = Array.isArray(boosted.state.reviewedReservationIds)
        ? boosted.state.reviewedReservationIds as string[]
        : []

      transaction.create(reviewRef, {
        ...input,
        customerUid: customer.uid,
        customerName: String(user.displayName ?? 'Cliente'),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.update(companyRef, {
        reviewCount: count(company.reviewCount) + 1,
        reviewRatingSum: count(company.reviewRatingSum) + input.rating,
        reviewAdelinas: count(company.reviewAdelinas) + input.adelinasEarned,
      })
      const nextXp = count(boosted.state.xp) + boosted.xpGained
      const nextAdelinas = count(boosted.state.adelinas) + boosted.adelinasGained
      writeGamification(transaction, customer.uid, {
        ...boosted.state,
        xp: nextXp,
        adelinas: nextAdelinas,
        reviewsCount: count(boosted.state.reviewsCount) + 1,
        reviewsWithPhotoCount: count(boosted.state.reviewsWithPhotoCount) + (input.hasPhoto ? 1 : 0),
        textReviewsCount: count(boosted.state.textReviewsCount) + (input.hasPhoto ? 0 : 1),
        reviewedCompanyIds: reviewedCompanies.includes(input.companyId)
          ? reviewedCompanies
          : [...reviewedCompanies, input.companyId],
        reviewedReservationIds: reviewedReservations.includes(input.reservationId)
          ? reviewedReservations
          : [...reviewedReservations, input.reservationId],
      })
      transaction.set(reviewIndexRef, {
        companyId: input.companyId,
        companyName: String(company.name ?? 'Restaurante'),
        companySlug: String(company.slug ?? ''),
        customerUid: customer.uid,
        reservationId: input.reservationId,
        rating: input.rating,
        hasPhoto: input.hasPhoto,
        commentExcerpt: input.comment.slice(0, 180),
        createdAt: FieldValue.serverTimestamp(),
      })
      return {
        inventory: numberRecord(boosted.state.inventory),
        xp: nextXp,
        adelinas: nextAdelinas,
        customerName: String(user.displayName ?? 'Cliente'),
        previous: {
          reviewCount: count(company.reviewCount),
          reviewRatingSum: count(company.reviewRatingSum),
          reviewAdelinas: count(company.reviewAdelinas),
        },
        next: {
          reviewCount: count(company.reviewCount) + 1,
          reviewRatingSum: count(company.reviewRatingSum) + input.rating,
          reviewAdelinas: count(company.reviewAdelinas) + input.adelinasEarned,
        },
      }
    })

    void notifyCompanyReviewScoreChange({
      companyId: input.companyId,
      kind: 'created',
      customerName: written.customerName,
      rating: input.rating,
      previous: written.previous,
      next: written.next,
    }).catch(() => undefined)
    void syncCompanyGamificationDoc(input.companyId).catch(() => undefined)

    res.status(201).json({
      success: true,
      inventory: written.inventory,
      xp: written.xp,
      adelinas: written.adelinas,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la reseña.'
    const status = message.includes('cliente') ? 401 : message.includes('Solo puedes') ? 403 : 400
    res.status(status).json({ error: message })
  }
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    let snapshot
    try {
      snapshot = await adminDb
        .collection('reviewIndex')
        .where('customerUid', '==', customer.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
    } catch {
      snapshot = await adminDb
        .collection('reviewIndex')
        .where('customerUid', '==', customer.uid)
        .limit(50)
        .get()
    }

    res.json({
      reviews: snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          companyId: String(data.companyId ?? ''),
          companyName: String(data.companyName ?? 'Restaurante'),
          companySlug: String(data.companySlug ?? ''),
          rating: typeof data.rating === 'number' ? data.rating : 0,
          hasPhoto: data.hasPhoto === true,
          commentExcerpt: String(data.commentExcerpt ?? ''),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        }
      }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las reseñas.'
    res.status(message.includes('cliente') ? 401 : 500).json({ error: message })
  }
})

router.put('/:companyId', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const input = reviewInput({ ...req.body, companyId: req.params.companyId })
    await assertReservationOwnership(
      input.reservationId,
      input.companyId,
      customer.uid,
      customer.email,
    )
    const companyRef = adminDb.collection('companies').doc(input.companyId)
    const reviewRef = companyRef.collection('reviews').doc(customer.uid)
    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)
    const reviewIndexRef = adminDb.collection('reviewIndex').doc(`${input.companyId}_${customer.uid}`)

    const scoreChange = await adminDb.runTransaction(async (transaction) => {
      const [companySnap, reviewSnap, userSnap, statsSnap] = await Promise.all([
        transaction.get(companyRef),
        transaction.get(reviewRef),
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      if (!companySnap.exists || !reviewSnap.exists) {
        throw new Error('No encontramos tu reseña para editar.')
      }
      const company = companySnap.data()!
      const previous = reviewSnap.data()!
      const gamification = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      const photoDelta = Number(input.hasPhoto) - Number(previous.hasPhoto === true)
      const previousScore = {
        reviewCount: count(company.reviewCount),
        reviewRatingSum: count(company.reviewRatingSum),
        reviewAdelinas: count(company.reviewAdelinas),
      }
      const nextScore = {
        reviewCount: previousScore.reviewCount,
        reviewRatingSum: Math.max(0, previousScore.reviewRatingSum - count(previous.rating) + input.rating),
        reviewAdelinas: Math.max(0, previousScore.reviewAdelinas - count(previous.adelinasEarned) + input.adelinasEarned),
      }
      transaction.update(reviewRef, {
        reservationId: input.reservationId,
        rating: input.rating,
        comment: input.comment,
        mediaItems: input.mediaItems,
        hasPhoto: input.hasPhoto,
        adelinasEarned: input.adelinasEarned,
        taggedProducts: input.taggedProducts,
        taggedPromotions: input.taggedPromotions,
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.update(companyRef, {
        reviewRatingSum: Math.max(
          0,
          count(company.reviewRatingSum) - count(previous.rating) + input.rating,
        ),
        reviewAdelinas: Math.max(
          0,
          count(company.reviewAdelinas) - count(previous.adelinasEarned) + input.adelinasEarned,
        ),
      })
      if (photoDelta !== 0) {
        writeGamification(transaction, customer.uid, {
          ...gamification,
          reviewsWithPhotoCount: Math.max(0, count(gamification.reviewsWithPhotoCount) + photoDelta),
          textReviewsCount: Math.max(0, count(gamification.textReviewsCount) - photoDelta),
        })
      }
      transaction.set(reviewIndexRef, {
        companyId: input.companyId,
        companyName: String(company.name ?? 'Restaurante'),
        companySlug: String(company.slug ?? ''),
        customerUid: customer.uid,
        reservationId: input.reservationId,
        rating: input.rating,
        hasPhoto: input.hasPhoto,
        commentExcerpt: input.comment.slice(0, 180),
        createdAt: previous.createdAt ?? FieldValue.serverTimestamp(),
      }, { merge: true })
      return { previousScore, nextScore, rating: input.rating }
    })
    void notifyCompanyReviewScoreChange({
      companyId: input.companyId,
      kind: 'updated',
      customerName: 'Un comensal',
      rating: scoreChange.rating,
      previous: scoreChange.previousScore,
      next: scoreChange.nextScore,
    }).catch(() => undefined)
    void syncCompanyGamificationDoc(input.companyId).catch(() => undefined)
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo editar la reseña.'
    res.status(message.includes('cliente') ? 401 : 400).json({ error: message })
  }
})

router.delete('/:companyId', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const companyId = String(req.params.companyId ?? '').trim()
    const companyRef = adminDb.collection('companies').doc(companyId)
    const reviewRef = companyRef.collection('reviews').doc(customer.uid)
    const userRef = adminDb.collection('users').doc(customer.uid)
    const statsRef = userGamificationRef(customer.uid)

    const scoreChange = await adminDb.runTransaction(async (transaction) => {
      const [companySnap, reviewSnap, userSnap, statsSnap] = await Promise.all([
        transaction.get(companyRef),
        transaction.get(reviewRef),
        transaction.get(userRef),
        transaction.get(statsRef),
      ])
      if (!companySnap.exists || !reviewSnap.exists) {
        throw new Error('No encontramos tu reseña para eliminar.')
      }
      const company = companySnap.data()!
      const review = reviewSnap.data()!
      const gamification = readGamificationFromDocs(statsSnap.data(), userSnap.data())
      const reviewedCompanies = Array.isArray(gamification.reviewedCompanyIds)
        ? gamification.reviewedCompanyIds as string[]
        : []

      const previousScore = {
        reviewCount: count(company.reviewCount),
        reviewRatingSum: count(company.reviewRatingSum),
        reviewAdelinas: count(company.reviewAdelinas),
      }
      const nextScore = {
        reviewCount: Math.max(0, previousScore.reviewCount - 1),
        reviewRatingSum: Math.max(0, previousScore.reviewRatingSum - count(review.rating)),
        reviewAdelinas: Math.max(0, previousScore.reviewAdelinas - count(review.adelinasEarned)),
      }

      transaction.delete(reviewRef)
      transaction.delete(adminDb.collection('reviewIndex').doc(`${companyId}_${customer.uid}`))
      transaction.update(companyRef, {
        reviewCount: nextScore.reviewCount,
        reviewRatingSum: nextScore.reviewRatingSum,
        reviewAdelinas: nextScore.reviewAdelinas,
      })
      writeGamification(transaction, customer.uid, {
        ...gamification,
        reviewsCount: Math.max(0, count(gamification.reviewsCount) - 1),
        reviewsWithPhotoCount: Math.max(
          0,
          count(gamification.reviewsWithPhotoCount) - (review.hasPhoto === true ? 1 : 0),
        ),
        textReviewsCount: Math.max(
          0,
          count(gamification.textReviewsCount) - (review.hasPhoto === true ? 0 : 1),
        ),
        reviewedCompanyIds: reviewedCompanies.filter((id) => id !== companyId),
      })
      return {
        previousScore,
        nextScore,
        rating: count(review.rating),
      }
    })
    void notifyCompanyReviewScoreChange({
      companyId,
      kind: 'deleted',
      customerName: 'Un comensal',
      rating: scoreChange.rating,
      previous: scoreChange.previousScore,
      next: scoreChange.nextScore,
    }).catch(() => undefined)
    void syncCompanyGamificationDoc(companyId).catch(() => undefined)
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la reseña.'
    res.status(message.includes('cliente') ? 401 : 400).json({ error: message })
  }
})

export default router
